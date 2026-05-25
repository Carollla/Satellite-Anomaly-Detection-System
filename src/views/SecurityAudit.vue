<template>
  <div class="ops-page">
    <header class="page-head">
      <div>
        <span>Security Audit</span>
        <h1>安全审计</h1>
      </div>
      <div class="head-actions">
        <el-tag :type="backendOnline ? 'success' : 'warning'">{{ backendOnline ? '后端数据' : '本地审计' }}</el-tag>
        <el-button size="small" :loading="loading" @click="loadLogs">刷新</el-button>
        <el-button size="small" type="primary" :loading="scanning" @click="runScan">执行扫描</el-button>
      </div>
    </header>

    <section class="metric-grid">
      <article v-for="item in metrics" :key="item.label" class="metric-card">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <em>{{ item.desc }}</em>
      </article>
    </section>

    <section class="audit-workspace">
      <main class="panel audit-panel">
        <div class="panel-head">
          <h3>审计日志</h3>
          <div class="filters">
            <el-input v-model="keyword" size="small" clearable placeholder="搜索用户 / 操作 / 目标" />
            <el-select v-model="resultFilter" size="small" class="filter">
              <el-option label="全部结果" value="all" />
              <el-option label="success" value="success" />
              <el-option label="denied" value="denied" />
              <el-option label="failed" value="failed" />
            </el-select>
          </div>
        </div>
        <el-table :data="filteredLogs" height="100%" size="small" border>
          <el-table-column label="时间" width="170">
            <template #default="{ row }">{{ formatTime(row.timestamp) }}</template>
          </el-table-column>
          <el-table-column prop="user" label="用户" width="120" />
          <el-table-column prop="action" label="操作" min-width="160" />
          <el-table-column prop="target" label="目标" min-width="180" />
          <el-table-column label="结果" width="110">
            <template #default="{ row }">
              <el-tag size="small" :type="resultType(row.result)">{{ row.result }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="ip_address" label="来源 IP" width="140" />
          <el-table-column label="详情" width="90" fixed="right">
            <template #default="{ row }">
              <el-button size="small" text type="primary" @click="openLog(row)">查看</el-button>
            </template>
          </el-table-column>
        </el-table>
      </main>

      <aside class="side-stack">
        <section class="panel risk-panel">
        <div class="panel-head">
          <h3>高危操作</h3>
          <el-tag size="small" type="danger">{{ riskyLogs.length }}</el-tag>
        </div>
        <div class="risk-list">
          <button v-for="log in riskyLogs" :key="log.log_id" class="risk-row" @click="openLog(log)">
            <strong>{{ log.action }}</strong>
            <span>{{ log.user }} · {{ log.target }}</span>
          </button>
          <div v-if="!riskyLogs.length" class="empty-state">当前没有高危记录</div>
        </div>
        </section>

        <section class="panel action-panel">
          <div class="panel-head">
            <h3>处置动作</h3>
            <el-tag size="small" type="info">人工确认</el-tag>
          </div>
          <div class="action-grid">
            <article class="action-card">
              <strong>凭据轮换</strong>
              <span>轮换 Agent、链路控制和审批令牌。</span>
              <el-button size="small" type="primary" plain :loading="rotating" @click="rotateCredentials">轮换</el-button>
            </article>
            <article class="action-card">
              <strong>策略复核</strong>
              <span>检查角色访问边界。</span>
              <el-button size="small" plain :loading="accessLoading" @click="loadAccess">复核</el-button>
            </article>
            <article class="action-card">
              <strong>高危扫描</strong>
              <span>扫描自动化工具调用。</span>
              <el-button size="small" plain :loading="scanning" @click="runScan">扫描</el-button>
            </article>
          </div>
        </section>
      </aside>
    </section>

    <el-drawer v-model="detailVisible" title="审计详情" size="420px">
      <pre class="detail-json">{{ selectedLog ? JSON.stringify(selectedLog, null, 2) : '' }}</pre>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { securityApi } from '../api'
import type { AuditLog } from '../api/types'

const loading = ref(false)
const scanning = ref(false)
const rotating = ref(false)
const accessLoading = ref(false)
const backendOnline = ref(true)
const keyword = ref('')
const resultFilter = ref('all')
const logs = ref<AuditLog[]>([])
const selectedLog = ref<AuditLog | null>(null)
const detailVisible = ref(false)

const filteredLogs = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  return logs.value.filter((item) => {
    const matchKeyword =
      !q ||
      item.user.toLowerCase().includes(q) ||
      item.action.toLowerCase().includes(q) ||
      item.target.toLowerCase().includes(q)
    const matchResult = resultFilter.value === 'all' || item.result === resultFilter.value
    return matchKeyword && matchResult
  })
})

const riskyLogs = computed(() =>
  logs.value.filter((item) =>
    ['credential.rotate', 'fault.inject', 'satellite.reset', 'approval.override'].some((key) => item.action.includes(key)) ||
    ['denied', 'failed'].includes(item.result)
  )
)

const metrics = computed(() => {
  const denied = logs.value.filter((item) => item.result === 'denied').length
  const failed = logs.value.filter((item) => item.result === 'failed').length
  const users = new Set(logs.value.map((item) => item.user)).size
  return [
    { label: '日志总数', value: logs.value.length, desc: '最近审计事件' },
    { label: '高危记录', value: riskyLogs.value.length, desc: '需要复核' },
    { label: '拒绝/失败', value: denied + failed, desc: `${denied} 拒绝，${failed} 失败` },
    { label: '活跃用户', value: users, desc: '操作主体' }
  ]
})

onMounted(loadLogs)

async function loadLogs() {
  loading.value = true
  try {
    logs.value = await securityApi.getAuditLogs()
    backendOnline.value = true
  } catch {
    backendOnline.value = false
    logs.value = seedLogs()
  } finally {
    loading.value = false
  }
}

async function runScan() {
  scanning.value = true
  try {
    await securityApi.scan({ scope: 'operations', include_recent_actions: true })
    backendOnline.value = true
    ElMessage.success('安全扫描已提交')
  } catch {
    backendOnline.value = false
    logs.value.unshift({
      log_id: `audit-local-${Date.now().toString().slice(-5)}`,
      timestamp: new Date().toISOString(),
      user: 'security-agent',
      action: 'security.scan',
      target: 'operations',
      result: 'success',
      ip_address: '127.0.0.1',
      details: { mode: 'local-fallback' }
    })
    ElMessage.warning('后端不可用，已记录本地扫描结果')
  } finally {
    scanning.value = false
  }
}

async function rotateCredentials() {
  rotating.value = true
  try {
    await securityApi.rotateCredentials({ scope: 'agent-tools', reason: 'manual security rotation' })
    backendOnline.value = true
    ElMessage.success('凭据轮换请求已提交')
  } catch {
    backendOnline.value = false
    ElMessage.warning('后端不可用，未执行真实凭据轮换')
  } finally {
    rotating.value = false
  }
}

async function loadAccess() {
  accessLoading.value = true
  try {
    await securityApi.getAccess({ include_roles: true })
    backendOnline.value = true
    ElMessage.success('访问策略已加载')
  } catch {
    backendOnline.value = false
    ElMessage.warning('后端不可用，保留当前本地策略视图')
  } finally {
    accessLoading.value = false
  }
}

function openLog(row: AuditLog) {
  selectedLog.value = row
  detailVisible.value = true
}

function seedLogs(): AuditLog[] {
  return [
    {
      log_id: 'audit-local-004',
      timestamp: dayjs().subtract(3, 'minute').toISOString(),
      user: 'admin',
      action: 'fault.inject',
      target: 'link-016',
      result: 'success',
      ip_address: '10.34.0.201',
      details: { severity: 6 }
    },
    {
      log_id: 'audit-local-003',
      timestamp: dayjs().subtract(14, 'minute').toISOString(),
      user: 'operator',
      action: 'approval.override',
      target: 'sat-006 recovery',
      result: 'denied',
      ip_address: '10.34.0.118'
    },
    {
      log_id: 'audit-local-002',
      timestamp: dayjs().subtract(28, 'minute').toISOString(),
      user: 'agent-coordinator',
      action: 'workflow.execute',
      target: 'wf-anomaly-001',
      result: 'success',
      ip_address: '127.0.0.1'
    },
    {
      log_id: 'audit-local-001',
      timestamp: dayjs().subtract(1, 'hour').toISOString(),
      user: 'viewer',
      action: 'security.open',
      target: '/security',
      result: 'denied',
      ip_address: '10.34.0.90'
    }
  ]
}

function resultType(result: string) {
  if (result === 'success') return 'success'
  if (result === 'denied') return 'warning'
  if (result === 'failed') return 'danger'
  return 'info'
}

function formatTime(value: string) {
  return dayjs(value).format('MM-DD HH:mm:ss')
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
.head-actions,
.filters {
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

.head-actions,
.filters {
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

.audit-workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 330px;
  gap: 12px;
}

.metric-card,
.panel,
.action-card {
  border: 1px solid var(--vscode-border);
  border-radius: 8px;
  background: var(--vscode-sidebar-bg);
}

.metric-card {
  padding: 12px 14px;
}

.metric-card span,
.metric-card em,
.risk-row span,
.action-card span {
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

.audit-panel :deep(.el-table) {
  flex: 1;
}

.side-stack {
  min-height: 0;
  display: grid;
  grid-template-rows: 1fr 0.95fr;
  gap: 12px;
}

.panel-head h3 {
  margin: 0;
  font-size: 16px;
}

.filter {
  width: 120px;
}

.risk-list {
  flex: 1;
  min-height: 0;
  display: grid;
  gap: 8px;
  overflow: hidden;
}

.risk-row {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--vscode-border);
  border-radius: 8px;
  background: transparent;
  color: var(--vscode-text);
  text-align: left;
  cursor: pointer;
}

.risk-row span,
.action-card span {
  display: block;
  margin-top: 6px;
}

.action-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.action-card {
  padding: 10px;
}

.action-card .el-button {
  margin-top: 8px;
}

.detail-json {
  margin: 0;
  padding: 14px;
  border: 1px solid var(--vscode-border);
  border-radius: 8px;
  background: var(--vscode-bg);
  color: var(--vscode-text);
  white-space: pre-wrap;
}

.empty-state {
  color: var(--vscode-text-muted);
}

@media (max-width: 1100px) {
  .metric-grid,
  .audit-workspace,
  .action-grid {
    grid-template-columns: 1fr;
  }
}
</style>
