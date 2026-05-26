<template>
  <div class="ops-page">
    <header class="page-head">
      <div>
        <span>Agent Blackboard</span>
        <h1>黑板状态</h1>
        <p>集中展示 Agent 推理过程中的事实、证据文件、计划状态和最终复核。</p>
      </div>
      <div class="head-actions">
        <el-tag :type="backendOnline ? 'success' : 'warning'">{{ backendOnline ? '后端数据' : '本地快照' }}</el-tag>
        <el-input v-model="traceId" size="small" class="trace-input" placeholder="Trace ID" @keyup.enter="loadBlackboard" />
        <el-button size="small" :loading="loading" @click="loadBlackboard">查询</el-button>
      </div>
    </header>

    <section class="metric-grid">
      <article v-for="item in metrics" :key="item.label" class="metric-card">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <em>{{ item.desc }}</em>
      </article>
    </section>

    <section class="blackboard-workspace">
      <main class="panel facts-panel">
        <div class="panel-head">
          <h3>结构化事实</h3>
          <el-tag size="small" type="info">{{ findingRows.length }}</el-tag>
        </div>
        <div class="finding-grid">
          <article v-for="item in findingRows" :key="item.key" class="finding-card">
            <span>{{ formatFindingKey(item.key) }}</span>
            <strong>{{ item.value }}</strong>
          </article>
        </div>
      </main>

      <aside class="panel trace-panel">
        <div class="panel-head">
          <h3>Trace 计划</h3>
          <el-button size="small" text @click="loadTrace">刷新</el-button>
        </div>
        <div class="trace-list">
          <div v-for="item in trace?.plan || []" :key="`${item.assignee}-${item.task}`" class="trace-row">
            <div>
              <strong>{{ item.task }}</strong>
              <span>{{ item.assignee }}</span>
            </div>
            <el-tag size="small" :type="statusType(item.status)">{{ item.status }}</el-tag>
          </div>
          <div v-if="!trace?.plan?.length" class="empty-state">暂无 Trace 计划</div>
        </div>
      </aside>

      <main class="panel evidence-panel">
        <div class="panel-head">
          <h3>证据文件</h3>
          <div class="head-actions">
            <el-input v-model="sandboxPath" size="small" class="path-input" placeholder="/tmp/trace.csv" />
            <el-button size="small" @click="loadSandboxFile">读取</el-button>
          </div>
        </div>
        <pre class="evidence-box">{{ sandboxContent }}</pre>
      </main>

      <aside class="panel review-panel">
        <div class="panel-head">
          <h3>诊断复核</h3>
          <el-tag size="small" :type="trace?.final_review ? 'success' : 'info'">
            {{ trace?.final_review ? trace.final_review.verdict : '进行中' }}
          </el-tag>
        </div>
        <div class="review-box">
          <strong>{{ trace?.final_review?.summary || '等待各专家 Agent 汇总证据后生成最终复核结论。' }}</strong>
          <div class="review-tags">
            <el-tag v-for="item in trace?.final_review?.approved_actions || []" :key="item" size="small">
              {{ item }}
            </el-tag>
          </div>
        </div>
      </aside>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { satopsApi } from '../api'
import { mockBlackboard, mockSandboxFile, mockTrace } from '../api/mock-data'
import type { BlackboardState, TraceDetail } from '../api/types'

const loading = ref(false)
const backendOnline = ref(true)
const traceId = ref('tr-12345')
const sandboxPath = ref('/tmp/trace_tr-12345.csv')
const blackboard = ref<BlackboardState | null>(null)
const trace = ref<TraceDetail | null>(null)
const sandboxContent = ref('')

const findingRows = computed(() => {
  const findings = blackboard.value?.findings || {}
  return Object.entries(findings).map(([key, value]) => ({
    key,
    value: typeof value === 'object' ? JSON.stringify(value) : String(value)
  }))
})

const metrics = computed(() => {
  const phase = trace.value?.current_phase || 'idle'
  const completed = trace.value?.plan.filter((item) => item.status === 'completed').length || 0
  return [
    { label: 'Trace', value: blackboard.value?.trace_id || traceId.value, desc: '当前上下文' },
    { label: '事实数量', value: findingRows.value.length, desc: '黑板共享字段' },
    { label: '当前阶段', value: phase, desc: 'plan / execute / review' },
    { label: '完成任务', value: completed, desc: `${trace.value?.plan.length || 0} 个计划项` }
  ]
})

onMounted(async () => {
  await Promise.all([loadBlackboard(), loadTrace(), loadSandboxFile()])
})

async function loadBlackboard() {
  loading.value = true
  try {
    blackboard.value = await satopsApi.getBlackboard(traceId.value)
    backendOnline.value = true
  } catch (error: any) {
    backendOnline.value = false
    blackboard.value = { ...mockBlackboard, trace_id: traceId.value }
    ElMessage.warning(error?.message ? `使用本地黑板快照：${error.message}` : '使用本地黑板快照')
  } finally {
    loading.value = false
  }
}

async function loadTrace() {
  try {
    trace.value = await satopsApi.getTrace(traceId.value)
    backendOnline.value = true
  } catch {
    backendOnline.value = false
    trace.value = { ...mockTrace, trace_id: traceId.value }
  }
}

async function loadSandboxFile() {
  try {
    const file = await satopsApi.getSandboxFile(sandboxPath.value)
    sandboxContent.value = file.content
    backendOnline.value = true
  } catch {
    backendOnline.value = false
    sandboxContent.value = mockSandboxFile.content
  }
}

function statusType(status: string) {
  if (status === 'completed') return 'success'
  if (status === 'running') return 'warning'
  if (status === 'failed') return 'danger'
  return 'info'
}

function formatFindingKey(key: string) {
  const labels: Record<string, string> = {
    network_status: '网络状态',
    leo_constellation: 'LEO 星座',
    geo_backbone: 'GEO 骨干',
    log_pointer: '证据文件'
  }
  return labels[key] || key.replace(/_/g, ' ')
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

.page-head p {
  margin: 4px 0 0;
  color: var(--vscode-text-muted);
  font-size: 13px;
}

.page-head h1 {
  margin: 4px 0 0;
  font-size: 24px;
}

.head-actions {
  gap: 8px;
}

.trace-input,
.path-input {
  width: 220px;
}

.metric-grid {
  display: grid;
  gap: 12px;
  margin-bottom: 12px;
}

.metric-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.blackboard-workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  grid-template-rows: 1fr 0.95fr;
  grid-template-areas:
    "facts trace"
    "evidence review";
  gap: 12px;
}

.metric-card,
.panel,
.finding-card {
  border: 1px solid var(--vscode-border);
  border-radius: 8px;
  background: var(--vscode-sidebar-bg);
}

.metric-card {
  padding: 12px 14px;
}

.metric-card span,
.metric-card em,
.finding-card span,
.trace-row span {
  color: var(--vscode-text-muted);
  font-size: 12px;
}

.metric-card strong {
  display: block;
  margin-top: 6px;
  font-size: 22px;
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

.facts-panel {
  grid-area: facts;
}

.trace-panel {
  grid-area: trace;
}

.evidence-panel {
  grid-area: evidence;
}

.review-panel {
  grid-area: review;
}

.panel-head h3 {
  margin: 0;
  font-size: 16px;
}

.finding-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  overflow: hidden;
}

.finding-card {
  position: relative;
  padding: 14px;
  overflow: hidden;
}

.finding-card::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: #2563eb;
}

.finding-card strong {
  display: block;
  margin-top: 8px;
  line-height: 1.5;
  word-break: break-word;
}

.trace-list {
  flex: 1;
  min-height: 0;
  display: grid;
  gap: 10px;
  overflow: hidden;
}

.trace-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--vscode-border);
  border-radius: 8px;
}

.trace-row span {
  display: block;
  margin-top: 4px;
}

.evidence-box {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  margin: 0;
  padding: 14px;
  border: 1px solid var(--vscode-border);
  border-radius: 8px;
  background: var(--vscode-bg);
  color: var(--vscode-text);
  white-space: pre-wrap;
}

.review-box {
  line-height: 1.7;
}

.review-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.empty-state {
  color: var(--vscode-text-muted);
}

@media (max-width: 1100px) {
  .metric-grid,
  .blackboard-workspace,
  .finding-grid {
    grid-template-columns: 1fr;
  }

  .blackboard-workspace {
    grid-template-areas: none;
  }
}
</style>
