<template>
  <div class="ops-page">
    <header class="page-head">
      <div>
        <span>DAG Pipeline</span>
        <h1>执行流图</h1>
      </div>
      <div class="head-actions">
        <el-tag :type="backendOnline ? 'success' : 'warning'">{{ backendOnline ? '后端数据' : '本地编排' }}</el-tag>
        <el-button size="small" :loading="loading" @click="refresh">刷新</el-button>
        <el-button size="small" type="primary" @click="createFromSelectedTemplate">从模板创建</el-button>
      </div>
    </header>

    <section class="metric-grid">
      <article v-for="item in metrics" :key="item.label" class="metric-card">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <em>{{ item.desc }}</em>
      </article>
    </section>

    <section class="workflow-workspace">
      <aside class="left-stack">
        <section class="panel list-panel">
        <div class="panel-head">
          <h3>流程列表</h3>
          <el-select v-model="statusFilter" size="small" class="filter">
            <el-option label="全部状态" value="all" />
            <el-option label="ready" value="ready" />
            <el-option label="running" value="running" />
            <el-option label="completed" value="completed" />
            <el-option label="failed" value="failed" />
          </el-select>
        </div>
        <div class="workflow-list">
          <button
            v-for="workflow in filteredWorkflows"
            :key="workflow.workflow_id"
            class="workflow-row"
            :class="{ active: selectedWorkflow?.workflow_id === workflow.workflow_id }"
            @click="selectWorkflow(workflow)"
          >
            <div>
              <strong>{{ workflow.name }}</strong>
              <span>{{ workflow.workflow_id }} · {{ workflow.steps_count }} 步 · {{ formatTime(workflow.created_at) }}</span>
            </div>
            <el-tag size="small" :type="statusType(workflow.status)">{{ workflow.status }}</el-tag>
          </button>
        </div>
        </section>

        <section class="panel template-panel">
        <div class="panel-head">
          <h3>模板库</h3>
          <el-tag size="small" type="info">{{ templates.length }}</el-tag>
        </div>
        <div class="template-list">
          <button
            v-for="template in templates"
            :key="template.template_id"
            class="template-row"
            :class="{ active: selectedTemplateId === template.template_id }"
            @click="selectedTemplateId = template.template_id"
          >
            <strong>{{ template.name }}</strong>
            <span>{{ template.category }} · {{ template.description }}</span>
          </button>
        </div>
        </section>
      </aside>

      <main class="panel dag-panel">
      <div class="panel-head">
        <h3>{{ detail?.name || selectedWorkflow?.name || '流程详情' }}</h3>
        <div class="head-actions">
          <el-tag size="small" :type="statusType(detail?.status || selectedWorkflow?.status || 'ready')">
            {{ detail?.status || selectedWorkflow?.status || 'ready' }}
          </el-tag>
          <el-button size="small" type="primary" :disabled="!selectedWorkflow" :loading="executing" @click="executeWorkflow">
            执行
          </el-button>
        </div>
      </div>

      <div class="dag-canvas">
        <div v-for="(step, index) in dagSteps" :key="step.id" class="dag-node" :class="step.status">
          <span>{{ index + 1 }}</span>
          <strong>{{ step.name }}</strong>
          <em>{{ step.tool }}</em>
        </div>
        <div v-if="!dagSteps.length" class="empty-state">选择一个流程查看 DAG 节点</div>
      </div>
      </main>

      <aside class="panel execution-panel">
      <div class="panel-head">
        <h3>执行记录</h3>
        <el-tag size="small" type="info">{{ executions.length }}</el-tag>
      </div>
      <el-table :data="executions" height="100%" size="small" border>
        <el-table-column prop="execution_id" label="执行 ID" min-width="160" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="statusType(row.status)">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="进度" width="180">
          <template #default="{ row }">
            <el-progress :percentage="row.progress ?? 0" :stroke-width="8" />
          </template>
        </el-table-column>
        <el-table-column label="开始时间" width="170">
          <template #default="{ row }">{{ formatTime(row.started_at) }}</template>
        </el-table-column>
      </el-table>
      </aside>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { workflowApi } from '../api'
import type { WorkflowDetail, WorkflowExecution, WorkflowSummary, WorkflowTemplate } from '../api/types'

const loading = ref(false)
const executing = ref(false)
const backendOnline = ref(true)
const statusFilter = ref('all')
const workflows = ref<WorkflowSummary[]>([])
const templates = ref<WorkflowTemplate[]>([])
const executions = ref<WorkflowExecution[]>([])
const selectedWorkflow = ref<WorkflowSummary | null>(null)
const detail = ref<WorkflowDetail | null>(null)
const selectedTemplateId = ref('')

const filteredWorkflows = computed(() =>
  workflows.value.filter((item) => statusFilter.value === 'all' || item.status === statusFilter.value)
)

const metrics = computed(() => {
  const running = workflows.value.filter((item) => item.status === 'running').length
  const completed = workflows.value.filter((item) => item.status === 'completed').length
  const avgSteps = workflows.value.length
    ? Math.round(workflows.value.reduce((sum, item) => sum + item.steps_count, 0) / workflows.value.length)
    : 0
  return [
    { label: '流程总数', value: workflows.value.length, desc: '已登记 DAG' },
    { label: '运行中', value: running, desc: '当前执行' },
    { label: '已完成', value: completed, desc: '最近任务闭环' },
    { label: '平均步数', value: avgSteps || '-', desc: '诊断链路复杂度' }
  ]
})

const dagSteps = computed(() => {
  if (!detail.value) return []
  const execution = executions.value.find((item) => item.workflow_id === detail.value?.workflow_id && item.status === 'running')
  return detail.value.steps.map((step, index) => {
    const progress = execution?.progress ?? (detail.value?.status === 'completed' ? 100 : 0)
    const threshold = ((index + 1) / detail.value!.steps.length) * 100
    return {
      ...step,
      status: progress >= threshold ? 'completed' : progress > (index / detail.value!.steps.length) * 100 ? 'running' : 'pending'
    }
  })
})

onMounted(refresh)

async function refresh() {
  loading.value = true
  try {
    const [workflowRows, templateRows] = await Promise.all([workflowApi.list(), workflowApi.listTemplates()])
    workflows.value = workflowRows
    templates.value = templateRows
    backendOnline.value = true
  } catch {
    backendOnline.value = false
    workflows.value = seedWorkflows()
    templates.value = seedTemplates()
  } finally {
    if (!selectedWorkflow.value && workflows.value.length) await selectWorkflow(workflows.value[0])
    if (!selectedTemplateId.value && templates.value.length) selectedTemplateId.value = templates.value[0].template_id
    loading.value = false
  }
}

async function selectWorkflow(workflow: WorkflowSummary) {
  selectedWorkflow.value = workflow
  try {
    detail.value = await workflowApi.getDetail(workflow.workflow_id)
    backendOnline.value = true
  } catch {
    backendOnline.value = false
    detail.value = seedDetail(workflow)
  }
}

async function createFromSelectedTemplate() {
  const template = templates.value.find((item) => item.template_id === selectedTemplateId.value)
  if (!template) return
  try {
    const created = await workflowApi.instantiateTemplate(template.template_id)
    workflows.value.unshift({
      workflow_id: created.workflow_id,
      name: created.name,
      status: created.status,
      steps_count: created.steps.length,
      created_at: created.created_at
    })
    await selectWorkflow(workflows.value[0])
    backendOnline.value = true
  } catch {
    const workflow: WorkflowSummary = {
      workflow_id: `wf-local-${Date.now().toString().slice(-5)}`,
      name: template.name,
      status: 'ready',
      steps_count: 4,
      created_at: new Date().toISOString()
    }
    workflows.value.unshift(workflow)
    await selectWorkflow(workflow)
    backendOnline.value = false
    ElMessage.warning('后端不可用，已创建本地流程')
  }
}

async function executeWorkflow() {
  if (!selectedWorkflow.value) return
  executing.value = true
  try {
    const execution = await workflowApi.execute(selectedWorkflow.value.workflow_id)
    executions.value.unshift(execution)
    selectedWorkflow.value.status = 'running'
    backendOnline.value = true
  } catch {
    const execution: WorkflowExecution = {
      execution_id: `exec-local-${Date.now().toString().slice(-5)}`,
      workflow_id: selectedWorkflow.value.workflow_id,
      status: 'running',
      progress: 40,
      started_at: new Date().toISOString()
    }
    executions.value.unshift(execution)
    selectedWorkflow.value.status = 'running'
    backendOnline.value = false
  } finally {
    executing.value = false
  }
}

function seedWorkflows(): WorkflowSummary[] {
  return [
    { workflow_id: 'wf-anomaly-001', name: '卫星离线根因分析', status: 'running', steps_count: 5, created_at: dayjs().subtract(8, 'minute').toISOString() },
    { workflow_id: 'wf-link-002', name: '骨干链路恢复编排', status: 'ready', steps_count: 4, created_at: dayjs().subtract(35, 'minute').toISOString() },
    { workflow_id: 'wf-rs-003', name: '遥感任务应急重规划', status: 'completed', steps_count: 6, created_at: dayjs().subtract(2, 'hour').toISOString() }
  ]
}

function seedTemplates(): WorkflowTemplate[] {
  return [
    { template_id: 'tpl-anomaly', name: '异常检测闭环', category: '诊断', description: '采集、分析、审批、恢复' },
    { template_id: 'tpl-link', name: '链路重路由', category: '网络', description: '评估链路质量并生成绕行方案' },
    { template_id: 'tpl-security', name: '高危操作审计', category: '安全', description: '审批和审计自动化操作' }
  ]
}

function seedDetail(workflow: WorkflowSummary): WorkflowDetail {
  return {
    workflow_id: workflow.workflow_id,
    name: workflow.name,
    description: '本地演示流程',
    status: workflow.status,
    created_at: workflow.created_at,
    steps: [
      { id: 'collect', name: '采集遥测', tool: 'telemetry.collect', params: {} },
      { id: 'detect', name: '异常检测', tool: 'agent.detect', params: {} },
      { id: 'reason', name: '根因分析', tool: 'agent.reason', params: {} },
      { id: 'approve', name: '人工审批', tool: 'approval.request', params: {} },
      { id: 'recover', name: '恢复执行', tool: 'ops.recover', params: {} }
    ].slice(0, workflow.steps_count)
  }
}

function statusType(status: string) {
  if (status === 'completed') return 'success'
  if (status === 'running') return 'warning'
  if (status === 'failed') return 'danger'
  return 'info'
}

function formatTime(value?: string) {
  return value ? dayjs(value).format('MM-DD HH:mm:ss') : '-'
}
</script>

<style scoped>
.ops-page {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 18px;
  background: var(--vscode-bg);
  color: var(--vscode-text);
}

.page-head,
.panel-head,
.head-actions {
  display: flex;
  align-items: center;
}

.page-head {
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.page-head span {
  color: var(--vscode-text-muted);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.page-head h1 {
  margin: 4px 0 0;
  font-size: 24px;
}

.head-actions {
  gap: 8px;
}

.metric-grid {
  display: grid;
  gap: 12px;
  margin-bottom: 12px;
}

.metric-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.workflow-workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 310px minmax(0, 1fr) 350px;
  gap: 12px;
}

.left-stack {
  min-height: 0;
  display: grid;
  grid-template-rows: 1.2fr 0.8fr;
  gap: 12px;
}

.metric-card,
.panel {
  border: 1px solid var(--vscode-border);
  border-radius: 8px;
  background: var(--vscode-sidebar-bg);
}

.metric-card {
  padding: 12px 14px;
}

.metric-card span,
.metric-card em {
  color: var(--vscode-text-muted);
  font-size: 12px;
}

.metric-card strong {
  display: block;
  margin-top: 6px;
  font-size: 24px;
}

.metric-card em {
  display: block;
  margin-top: 6px;
  font-style: normal;
}

.panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 14px;
}

.panel-head {
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.panel-head h3 {
  margin: 0;
  font-size: 16px;
}

.filter {
  width: 130px;
}

.workflow-list,
.template-list {
  display: grid;
  gap: 8px;
  overflow: hidden;
}

.workflow-row,
.template-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px;
  border: 1px solid var(--vscode-border);
  border-radius: 8px;
  background: transparent;
  color: var(--vscode-text);
  text-align: left;
  cursor: pointer;
}

.template-row {
  display: block;
}

.workflow-row.active,
.template-row.active {
  border-color: var(--vscode-primary);
  background: var(--vscode-active);
}

.workflow-row span,
.template-row span {
  display: block;
  margin-top: 5px;
  color: var(--vscode-text-muted);
  font-size: 12px;
}

.dag-canvas {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  align-content: center;
  gap: 14px;
  overflow-x: auto;
}

.dag-node {
  position: relative;
  padding: 16px;
  border: 1px solid var(--vscode-border);
  border-radius: 8px;
  background: var(--vscode-bg);
}

.dag-node:not(:last-child)::after {
  content: '';
  position: absolute;
  right: -14px;
  top: 50%;
  width: 14px;
  height: 2px;
  background: var(--vscode-border);
}

.dag-node span {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  margin-bottom: 12px;
  border-radius: 50%;
  background: var(--vscode-hover);
  color: var(--vscode-text-muted);
  font-size: 12px;
}

.dag-node strong,
.dag-node em {
  display: block;
}

.dag-node em {
  margin-top: 6px;
  color: var(--vscode-text-muted);
  font-size: 12px;
  font-style: normal;
}

.dag-node.completed {
  border-color: #22c55e;
}

.dag-node.running {
  border-color: #f59e0b;
}

.empty-state {
  color: var(--vscode-text-muted);
}

.execution-panel :deep(.el-table) {
  flex: 1;
}

@media (max-width: 1100px) {
  .metric-grid,
  .workflow-workspace {
    grid-template-columns: 1fr;
  }
}
</style>
