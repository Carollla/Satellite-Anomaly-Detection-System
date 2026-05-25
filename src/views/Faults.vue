<template>
  <div class="ops-page">
    <header class="page-head">
      <div>
        <span>Fault Injection</span>
        <h1>故障注入</h1>
      </div>
      <div class="head-actions">
        <el-tag :type="backendOnline ? 'success' : 'warning'">{{ backendOnline ? '后端联动' : '本地演练' }}</el-tag>
        <el-button size="small" :loading="loading" @click="refresh">刷新</el-button>
        <el-button size="small" type="primary" @click="injectFault">注入故障</el-button>
      </div>
    </header>

    <section class="metric-grid">
      <article v-for="item in metrics" :key="item.label" class="metric-card">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <em>{{ item.desc }}</em>
      </article>
    </section>

    <section class="fault-workspace">
      <main class="panel inject-panel">
        <div class="panel-head">
          <h3>注入配置</h3>
          <el-tag size="small" type="info">仿真环境</el-tag>
        </div>
        <el-form label-position="top" class="fault-form">
          <el-form-item label="故障类型">
            <el-select v-model="form.type" class="full">
              <el-option label="链路中断" value="link_down" />
              <el-option label="节点离线" value="node_offline" />
              <el-option label="高延迟抖动" value="latency_jitter" />
              <el-option label="资源耗尽" value="resource_exhaustion" />
              <el-option label="载荷异常" value="payload_error" />
            </el-select>
          </el-form-item>
          <el-form-item label="目标对象">
            <el-input v-model="form.target" placeholder="sat-001 / link-003 / ground-mcs-001" />
          </el-form-item>
          <div class="form-grid">
            <el-form-item label="持续时间">
              <el-input-number v-model="form.duration" :min="1" :max="120" class="full" />
            </el-form-item>
            <el-form-item label="强度">
              <el-slider v-model="form.severity" :min="1" :max="10" />
            </el-form-item>
          </div>
          <el-form-item label="备注">
            <el-input v-model="form.reason" type="textarea" :rows="2" resize="none" />
          </el-form-item>
        </el-form>
      </main>

      <section class="panel active-panel">
        <div class="panel-head">
          <h3>活动故障</h3>
          <el-tag size="small" type="danger">{{ activeFaults.length }}</el-tag>
        </div>
        <el-table :data="activeFaults" height="100%" size="small" border>
          <el-table-column prop="fault_id" label="故障 ID" width="130" />
          <el-table-column label="类型" width="120">
            <template #default="{ row }">{{ typeLabel(row.type) }}</template>
          </el-table-column>
          <el-table-column prop="target" label="目标" min-width="130" />
          <el-table-column label="强度" width="80">
            <template #default="{ row }">{{ row.parameters?.severity || '-' }}</template>
          </el-table-column>
          <el-table-column label="注入时间" width="120">
            <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="86" fixed="right">
            <template #default="{ row }">
              <el-button size="small" type="primary" text :loading="resolvingId === row.fault_id" @click="resolveFault(row)">
                恢复
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </section>

      <aside class="side-stack">
        <section class="panel scenario-panel">
        <div class="panel-head">
          <h3>预置场景</h3>
          <el-button size="small" text @click="resetForm">重置</el-button>
        </div>
        <div class="scenario-list">
          <button v-for="item in scenarios" :key="item.name" class="scenario-row" @click="applyScenario(item)">
            <strong>{{ item.name }}</strong>
            <span>{{ item.desc }}</span>
          </button>
        </div>
        </section>

        <section class="panel history-panel">
          <div class="panel-head">
            <h3>恢复记录</h3>
            <el-tag size="small" type="info">{{ resolvedFaults.length }}</el-tag>
          </div>
          <div class="history-list">
            <div v-for="row in resolvedFaults.slice(0, 4)" :key="row.fault_id" class="history-row">
              <strong>{{ typeLabel(row.type) }}</strong>
              <span>{{ row.target }} · {{ formatTime(row.resolved_at) }}</span>
            </div>
            <div v-if="!resolvedFaults.length" class="empty-state">暂无恢复记录</div>
          </div>
        </section>
      </aside>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { faultApi } from '../api'
import type { Fault } from '../api/types'

interface Scenario {
  name: string
  desc: string
  type: string
  target: string
  severity: number
  duration: number
}

const loading = ref(false)
const backendOnline = ref(true)
const resolvingId = ref('')
const faults = ref<Fault[]>([])

const form = reactive({
  type: 'link_down',
  target: 'link-003',
  duration: 10,
  severity: 5,
  reason: '验证 Agent 检测、定位和恢复闭环'
})

const scenarios: Scenario[] = [
  { name: '边界站链路中断', desc: '模拟地面回传链路短时不可达', type: 'link_down', target: 'link-021', severity: 8, duration: 12 },
  { name: 'LEO 节点离线', desc: '模拟星上计算节点失联', type: 'node_offline', target: 'sat-006', severity: 7, duration: 8 },
  { name: 'GEO 骨干抖动', desc: '模拟主干链路高延迟和丢包', type: 'latency_jitter', target: 'link-016', severity: 6, duration: 15 },
  { name: '载荷处理拥塞', desc: '模拟遥感载荷队列堆积', type: 'resource_exhaustion', target: 'sat-011', severity: 5, duration: 20 }
]

const activeFaults = computed(() => faults.value.filter((item) => item.status === 'active'))
const resolvedFaults = computed(() => faults.value.filter((item) => item.status === 'resolved'))
const metrics = computed(() => {
  const avgSeverity = activeFaults.value.length
    ? Math.round(activeFaults.value.reduce((sum, item) => sum + Number(item.parameters?.severity || 0), 0) / activeFaults.value.length)
    : 0
  return [
    { label: '活动故障', value: activeFaults.value.length, desc: '当前仍在影响拓扑' },
    { label: '已恢复', value: resolvedFaults.value.length, desc: '历史演练记录' },
    { label: '平均强度', value: avgSeverity || '-', desc: '1 到 10 级' },
    { label: '演练模式', value: backendOnline.value ? '联动' : '本地', desc: backendOnline.value ? 'API 已连接' : '使用前端 fallback' }
  ]
})

onMounted(refresh)

async function refresh() {
  loading.value = true
  try {
    const [active, history] = await Promise.all([faultApi.list('active'), faultApi.history()])
    faults.value = [...active, ...history]
    backendOnline.value = true
  } catch {
    backendOnline.value = false
    if (!faults.value.length) faults.value = seedFaults()
  } finally {
    loading.value = false
  }
}

async function injectFault() {
  const payload = {
    type: form.type,
    target: form.target,
    parameters: {
      duration_min: form.duration,
      severity: form.severity,
      reason: form.reason
    }
  }
  try {
    const created = await faultApi.inject(payload)
    faults.value.unshift(created)
    backendOnline.value = true
    ElMessage.success('故障注入请求已提交')
  } catch (error: any) {
    backendOnline.value = false
    faults.value.unshift({
      fault_id: `fault-local-${Date.now().toString().slice(-5)}`,
      type: payload.type,
      target: payload.target,
      status: 'active',
      parameters: payload.parameters,
      created_at: new Date().toISOString()
    })
    ElMessage.warning(error?.message ? `后端不可用，已创建本地演练：${error.message}` : '后端不可用，已创建本地演练')
  }
}

async function resolveFault(row: Fault) {
  resolvingId.value = row.fault_id
  try {
    const resolved = await faultApi.resolve(row.fault_id)
    replaceFault(resolved)
    backendOnline.value = true
  } catch {
    replaceFault({ ...row, status: 'resolved', resolved_at: new Date().toISOString() })
    backendOnline.value = false
  } finally {
    resolvingId.value = ''
  }
}

function replaceFault(next: Fault) {
  const index = faults.value.findIndex((item) => item.fault_id === next.fault_id)
  if (index >= 0) faults.value.splice(index, 1, next)
}

function applyScenario(item: Scenario) {
  form.type = item.type
  form.target = item.target
  form.severity = item.severity
  form.duration = item.duration
  form.reason = item.desc
}

function resetForm() {
  form.type = 'link_down'
  form.target = 'link-003'
  form.duration = 10
  form.severity = 5
  form.reason = '验证 Agent 检测、定位和恢复闭环'
}

function seedFaults(): Fault[] {
  return [
    {
      fault_id: 'fault-local-001',
      type: 'latency_jitter',
      target: 'link-016',
      status: 'active',
      parameters: { severity: 6, duration_min: 15, reason: 'GEO 骨干链路抖动演练' },
      created_at: dayjs().subtract(6, 'minute').toISOString()
    },
    {
      fault_id: 'fault-local-000',
      type: 'node_offline',
      target: 'sat-004',
      status: 'resolved',
      parameters: { severity: 5, duration_min: 7 },
      created_at: dayjs().subtract(1, 'hour').toISOString(),
      resolved_at: dayjs().subtract(46, 'minute').toISOString()
    }
  ]
}

function typeLabel(type: string) {
  const labels: Record<string, string> = {
    link_down: '链路中断',
    node_offline: '节点离线',
    latency_jitter: '高延迟抖动',
    resource_exhaustion: '资源耗尽',
    payload_error: '载荷异常'
  }
  return labels[type] || type
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

.fault-workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 330px minmax(0, 1fr) 310px;
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

.fault-form {
  min-height: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: 130px 1fr;
  gap: 12px;
}

.active-panel :deep(.el-table) {
  flex: 1;
}

.side-stack {
  min-height: 0;
  display: grid;
  grid-template-rows: 1fr 0.75fr;
  gap: 12px;
}

.scenario-list {
  display: grid;
  gap: 8px;
  overflow: hidden;
}

.scenario-row {
  padding: 10px;
  border: 1px solid var(--vscode-border);
  border-radius: 8px;
  background: transparent;
  color: var(--vscode-text);
  text-align: left;
  cursor: pointer;
}

.scenario-row span {
  display: block;
  margin-top: 6px;
  color: var(--vscode-text-muted);
  font-size: 12px;
}

.param-text {
  color: var(--vscode-text-muted);
  font-size: 12px;
}

.history-list {
  display: grid;
  gap: 8px;
}

.history-row {
  padding: 10px;
  border: 1px solid var(--vscode-border);
  border-radius: 8px;
}

.history-row span,
.empty-state {
  display: block;
  margin-top: 4px;
  color: var(--vscode-text-muted);
  font-size: 12px;
}

.full {
  width: 100%;
}

@media (max-width: 1100px) {
  .metric-grid,
  .fault-workspace,
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
