<template>
  <div class="ops-page">
    <header class="page-head">
      <div>
        <span>Node Instances</span>
        <h1>节点实例</h1>
      </div>
      <div class="head-actions">
        <el-tag :type="instanceStore.dataSource === 'mock-server' ? 'success' : 'warning'">
          {{ instanceStore.dataSource === 'mock-server' ? '后端数据' : '本地演示' }}
        </el-tag>
        <el-button size="small" :loading="refreshing" @click="refresh">刷新</el-button>
        <el-button size="small" type="primary" @click="createVisible = true">新增实例</el-button>
      </div>
    </header>

    <section class="metric-grid">
      <article v-for="item in metrics" :key="item.label" class="metric-card">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <em>{{ item.desc }}</em>
      </article>
    </section>

    <section class="content-grid">
      <main class="panel">
        <div class="panel-head">
          <h3>实例清单</h3>
          <div class="filters">
            <el-input v-model="keyword" size="small" clearable placeholder="搜索名称 / ID" />
            <el-select v-model="typeFilter" size="small" class="select-filter">
              <el-option label="全部类型" value="all" />
              <el-option label="卫星" value="satellite" />
              <el-option label="地面站" value="ground" />
            </el-select>
            <el-select v-model="statusFilter" size="small" class="select-filter">
              <el-option label="全部状态" value="all" />
              <el-option label="正常" value="normal" />
              <el-option label="告警" value="warning" />
              <el-option label="严重" value="danger" />
              <el-option label="离线" value="offline" />
            </el-select>
          </div>
        </div>

        <el-table :data="filteredRows" height="100%" size="small" border>
          <el-table-column prop="name" label="名称" min-width="180">
            <template #default="{ row }">
              <button class="link-button" @click="openDetail(row)">{{ row.name }}</button>
              <div class="sub-id">{{ row.id }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="typeLabel" label="类型" width="110" />
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <el-tag size="small" :type="statusType(row.status)">{{ row.statusLabel }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="CPU" width="170">
            <template #default="{ row }">
              <el-progress :percentage="Math.round(row.cpu)" :stroke-width="8" :show-text="false" />
              <span class="meter-text">{{ Math.round(row.cpu) }}%</span>
            </template>
          </el-table-column>
          <el-table-column label="内存" width="140">
            <template #default="{ row }">{{ formatBytes(row.memory) }}</template>
          </el-table-column>
          <el-table-column prop="nodeIndex" label="节点" width="80" />
          <el-table-column label="运行" width="90">
            <template #default="{ row }">
              <el-switch
                :model-value="row.running"
                size="small"
                :loading="busyId === row.id"
                @change="toggleInstance(row)"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="110" fixed="right">
            <template #default="{ row }">
              <el-button size="small" text type="primary" @click="openDetail(row)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
      </main>

      <aside class="panel side-panel">
        <div class="panel-head">
          <h3>资源热点</h3>
          <el-tag size="small" type="info">{{ hotRows.length }}</el-tag>
        </div>
        <div class="hot-list">
          <button v-for="row in hotRows" :key="row.id" class="hot-row" @click="openDetail(row)">
            <div>
              <strong>{{ row.name }}</strong>
              <span>{{ row.typeLabel }} / {{ row.id }}</span>
            </div>
            <b>{{ Math.round(row.cpu) }}%</b>
          </button>
        </div>
      </aside>
    </section>

    <el-drawer v-model="detailVisible" title="实例详情" size="420px">
      <div v-if="selected" class="detail-stack">
        <section class="detail-card">
          <span>实例 ID</span>
          <strong>{{ selected.id }}</strong>
        </section>
        <section class="detail-card">
          <span>运行状态</span>
          <strong>{{ selected.running ? '运行中' : '已停止' }}</strong>
        </section>
        <section class="detail-card">
          <span>资源占用</span>
          <strong>CPU {{ Math.round(selected.cpu) }}% · 内存 {{ formatBytes(selected.memory) }}</strong>
        </section>
        <section class="detail-card">
          <span>部署节点</span>
          <strong>Node {{ selected.nodeIndex }}</strong>
        </section>
      </div>
    </el-drawer>

    <el-dialog v-model="createVisible" title="新增实例" width="460px">
      <el-form label-position="top">
        <el-form-item label="实例名称">
          <el-input v-model="createForm.name" />
        </el-form-item>
        <el-form-item label="实例类型">
          <el-select v-model="createForm.type" class="full">
            <el-option label="卫星节点" value="satellite" />
            <el-option label="地面站" value="ground-station" />
            <el-option label="服务容器" value="service" />
          </el-select>
        </el-form-item>
        <el-form-item label="节点编号">
          <el-input-number v-model="createForm.nodeIndex" :min="0" class="full" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="createLocalInstance">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useInstanceStore, type InstanceDisplay } from '../../stores/instance'

const instanceStore = useInstanceStore()
const keyword = ref('')
const typeFilter = ref('all')
const statusFilter = ref('all')
const refreshing = ref(false)
const busyId = ref('')
const detailVisible = ref(false)
const createVisible = ref(false)
const selected = ref<InstanceDisplay | null>(null)

const createForm = reactive({
  name: '新建卫星节点',
  type: 'satellite',
  nodeIndex: 0
})

const metrics = computed(() => {
  const rows = instanceStore.instancesForDisplay
  const running = rows.filter((item) => item.running).length
  const abnormal = rows.filter((item) => item.status !== 'normal').length
  const satellites = rows.filter((item) => item.type.toLowerCase().includes('satellite')).length
  const avgCpu = rows.length ? Math.round(rows.reduce((sum, item) => sum + item.cpu, 0) / rows.length) : 0
  return [
    { label: '实例总数', value: rows.length, desc: `${satellites} 个卫星节点` },
    { label: '运行中', value: running, desc: `${rows.length - running} 个停止` },
    { label: '异常实例', value: abnormal, desc: abnormal ? '需要关注' : '全部正常' },
    { label: '平均 CPU', value: `${avgCpu}%`, desc: '最近一次采样' }
  ]
})

const filteredRows = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  return instanceStore.instancesForDisplay.filter((item) => {
    const matchKeyword = !q || item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)
    const matchType = typeFilter.value === 'all' || item.type.toLowerCase().includes(typeFilter.value)
    const matchStatus = statusFilter.value === 'all' || item.status === statusFilter.value
    return matchKeyword && matchType && matchStatus
  })
})

const hotRows = computed(() =>
  [...instanceStore.instancesForDisplay].sort((a, b) => b.cpu - a.cpu).slice(0, 6)
)

onMounted(refresh)

async function refresh() {
  refreshing.value = true
  await Promise.all([instanceStore.fetchInstances(), instanceStore.fetchAllResources()])
  refreshing.value = false
}

async function toggleInstance(row: InstanceDisplay) {
  busyId.value = row.id
  try {
    if (row.running) await instanceStore.stopInstance(row.nodeIndex, row.id)
    else await instanceStore.startInstance(row.nodeIndex, row.id)
    ElMessage.success(row.running ? '停止指令已下发' : '启动指令已下发')
  } catch (error: any) {
    const target = instanceStore.instances.find((item) => item.instance_id === row.id)
    if (target) target.start = !row.running
    ElMessage.warning(error?.message ? `后端不可用，已切换本地状态：${error.message}` : '后端不可用，已切换本地状态')
  } finally {
    busyId.value = ''
  }
}

function openDetail(row: InstanceDisplay) {
  selected.value = row
  detailVisible.value = true
}

function createLocalInstance() {
  const next = instanceStore.instances.length + 1
  instanceStore.instances.push({
    instance_id: `custom-${String(next).padStart(3, '0')}`,
    name: createForm.name,
    type: createForm.type,
    start: true,
    node_index: createForm.nodeIndex,
    extra: { source: 'local-ui' }
  })
  createVisible.value = false
  ElMessage.success('实例已加入当前拓扑视图')
}

function statusType(status: InstanceDisplay['status']) {
  if (status === 'normal') return 'success'
  if (status === 'warning') return 'warning'
  if (status === 'danger') return 'danger'
  return 'info'
}

function formatBytes(value: number) {
  if (!value) return '0 MB'
  const gb = value / 1024 / 1024 / 1024
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${Math.round(value / 1024 / 1024)} MB`
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.metric-card,
.panel,
.detail-card {
  border: 1px solid var(--vscode-border);
  border-radius: 8px;
  background: var(--vscode-sidebar-bg);
}

.metric-card {
  padding: 12px 14px;
}

.metric-card span,
.detail-card span,
.sub-id {
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
  color: var(--vscode-text-muted);
  font-size: 12px;
  font-style: normal;
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 14px;
  flex: 1;
  min-height: 0;
}

.panel {
  min-width: 0;
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

.select-filter {
  width: 120px;
}

.link-button,
.hot-row {
  border: 0;
  background: transparent;
  color: var(--vscode-primary);
  cursor: pointer;
  text-align: left;
}

.meter-text {
  margin-left: 8px;
  color: var(--vscode-text-muted);
  font-size: 12px;
}

.side-panel {
  align-self: start;
}

.hot-list,
.detail-stack {
  display: grid;
  gap: 10px;
}

.hot-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--vscode-border);
  border-radius: 8px;
  color: var(--vscode-text);
}

.hot-row span {
  display: block;
  margin-top: 4px;
  color: var(--vscode-text-muted);
  font-size: 12px;
}

.hot-row b {
  color: var(--vscode-primary);
}

.detail-card {
  padding: 14px;
}

.detail-card strong {
  display: block;
  margin-top: 8px;
}

.full {
  width: 100%;
}

@media (max-width: 1100px) {
  .metric-grid,
  .content-grid {
    grid-template-columns: 1fr;
  }
}
</style>
