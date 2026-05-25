<template>
  <div class="ops-page">
    <header class="page-head">
      <div>
        <span>Link Topology</span>
        <h1>链路拓扑</h1>
      </div>
      <div class="head-actions">
        <el-tag :type="linkStore.dataSource === 'mock-server' ? 'success' : 'warning'">
          {{ linkStore.dataSource === 'mock-server' ? '后端数据' : '本地演示' }}
        </el-tag>
        <el-button size="small" :loading="refreshing" @click="refresh">刷新</el-button>
        <el-button size="small" type="primary" @click="addFastLink">快速建链</el-button>
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
      <main class="panel map-panel">
        <div class="panel-head">
          <h3>拓扑视图</h3>
          <div class="filters">
            <el-input v-model="keyword" size="small" clearable placeholder="搜索链路 / 端点" />
            <el-select v-model="typeFilter" size="small" class="select-filter">
              <el-option label="全部类型" value="all" />
              <el-option v-for="type in linkTypes" :key="type" :label="type" :value="type" />
            </el-select>
          </div>
        </div>
        <div class="topology-canvas">
          <button
            v-for="node in nodes"
            :key="node.id"
            class="topology-node"
            :class="node.kind"
            :style="{ left: `${node.x}%`, top: `${node.y}%` }"
          >
            <strong>{{ node.label }}</strong>
            <span>{{ node.id }}</span>
          </button>
          <button
            v-for="line in visibleLines"
            :key="line.id"
            class="topology-line"
            :class="[line.status, { disabled: !line.enabled }]"
            :style="lineStyle(line)"
            @click="openDetail(line)"
          >
            <span>{{ line.id }}</span>
          </button>
        </div>
      </main>

      <aside class="panel side-panel">
        <div class="panel-head">
          <h3>链路质量</h3>
          <el-tag size="small" type="info">{{ filteredRows.length }}</el-tag>
        </div>
        <div class="quality-list">
          <button v-for="row in filteredRows.slice(0, 8)" :key="row.id" class="quality-row" @click="openDetail(row)">
            <div>
              <strong>{{ row.id }}</strong>
              <span>{{ row.endpoints[0] }} → {{ row.endpoints[1] }}</span>
            </div>
            <el-tag size="small" :type="statusType(row.status)">{{ row.status }}</el-tag>
          </button>
        </div>
      </aside>
    </section>

    <section class="panel table-panel">
      <div class="panel-head">
        <h3>链路列表</h3>
        <el-button size="small" text @click="keyword = ''; typeFilter = 'all'">重置筛选</el-button>
      </div>
      <el-table :data="filteredRows" height="100%" size="small" border>
        <el-table-column prop="id" label="链路 ID" width="130" />
        <el-table-column prop="type" label="类型" width="140" />
        <el-table-column label="端点" min-width="220">
          <template #default="{ row }">{{ row.endpoints[0] }} → {{ row.endpoints[1] }}</template>
        </el-table-column>
        <el-table-column label="吞吐" width="180">
          <template #default="{ row }">{{ formatBps(row.recvBps + row.sendBps) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="statusType(row.status)">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <el-switch :model-value="row.enabled" size="small" @change="toggleLocal(row.id)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="openDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-drawer v-model="detailVisible" title="链路详情" size="420px">
      <div v-if="selected" class="detail-stack">
        <section class="detail-card">
          <span>链路</span>
          <strong>{{ selected.id }} / {{ selected.type }}</strong>
        </section>
        <section class="detail-card">
          <span>端点</span>
          <strong>{{ selected.endpoints[0] }} → {{ selected.endpoints[1] }}</strong>
        </section>
        <section class="detail-card">
          <span>收发速率</span>
          <strong>{{ formatBps(selected.recvBps) }} / {{ formatBps(selected.sendBps) }}</strong>
        </section>
        <section class="detail-card">
          <span>链路控制</span>
          <el-switch :model-value="selected.enabled" active-text="启用" inactive-text="停用" @change="toggleLocal(selected.id)" />
        </section>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useLinkStore, type LinkDisplay } from '../../stores/link'

interface TopologyNode {
  id: string
  label: string
  kind: 'satellite' | 'ground'
  x: number
  y: number
}

const linkStore = useLinkStore()
const keyword = ref('')
const typeFilter = ref('all')
const refreshing = ref(false)
const detailVisible = ref(false)
const selected = ref<LinkDisplay | null>(null)

const nodes = computed<TopologyNode[]>(() => {
  const ids = [...new Set(linkStore.links.flatMap((item) => item.connect_instance))]
  return ids.slice(0, 18).map((id, index) => {
    const angle = (index / Math.max(ids.length, 1)) * Math.PI * 2
    const isGround = id.includes('ground')
    return {
      id,
      label: isGround ? '地面站' : id.startsWith('geo') ? 'GEO' : 'LEO',
      kind: isGround ? 'ground' : 'satellite',
      x: 50 + Math.cos(angle) * (isGround ? 39 : 31),
      y: 50 + Math.sin(angle) * (isGround ? 33 : 27)
    }
  })
})

const nodeMap = computed(() => Object.fromEntries(nodes.value.map((node) => [node.id, node])))
const linkTypes = computed(() => [...new Set(linkStore.linksForDisplay.map((item) => item.type))])

const filteredRows = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  return linkStore.linksForDisplay.filter((item) => {
    const matchKeyword =
      !q ||
      item.id.toLowerCase().includes(q) ||
      item.endpoints.some((endpoint) => endpoint.toLowerCase().includes(q))
    const matchType = typeFilter.value === 'all' || item.type === typeFilter.value
    return matchKeyword && matchType
  })
})

const visibleLines = computed(() =>
  filteredRows.value.filter((line) => nodeMap.value[line.endpoints[0]] && nodeMap.value[line.endpoints[1]])
)

const metrics = computed(() => {
  const rows = linkStore.linksForDisplay
  const enabled = rows.filter((item) => item.enabled).length
  const abnormal = rows.filter((item) => item.status !== 'normal').length
  const throughput = rows.reduce((sum, item) => sum + item.recvBps + item.sendBps, 0)
  return [
    { label: '链路总数', value: rows.length, desc: `${linkTypes.value.length} 类链路` },
    { label: '已启用', value: enabled, desc: `${rows.length - enabled} 条停用` },
    { label: '异常链路', value: abnormal, desc: abnormal ? '存在丢包或错误' : '质量稳定' },
    { label: '总吞吐', value: formatBps(throughput), desc: '收发合计' }
  ]
})

onMounted(refresh)

async function refresh() {
  refreshing.value = true
  await Promise.all([linkStore.fetchLinks(), linkStore.fetchAllResources()])
  refreshing.value = false
}

function openDetail(row: LinkDisplay) {
  selected.value = row
  detailVisible.value = true
}

function toggleLocal(id: string) {
  const link = linkStore.links.find((item) => item.link_id === id)
  if (link) {
    link.enable = !link.enable
    ElMessage.success(link.enable ? '链路已启用' : '链路已停用')
  }
}

function addFastLink() {
  const satellites = [...new Set(linkStore.links.flatMap((item) => item.connect_instance).filter((id) => id.startsWith('sat')))]
  const source = satellites[0] || 'sat-001'
  const target = satellites[1] || 'sat-002'
  const id = `link-local-${String(linkStore.links.length + 1).padStart(2, '0')}`
  linkStore.links.push({
    link_id: id,
    type: 'manual-fast-line',
    enable: true,
    connect_instance: [source, target],
    node_index: 0
  })
  ElMessage.success('已创建本地快速链路')
}

function lineStyle(line: LinkDisplay) {
  const start = nodeMap.value[line.endpoints[0]]
  const end = nodeMap.value[line.endpoints[1]]
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.sqrt(dx * dx + dy * dy)
  const angle = Math.atan2(dy, dx) * 180 / Math.PI
  return {
    left: `${start.x}%`,
    top: `${start.y}%`,
    width: `${length}%`,
    transform: `rotate(${angle}deg)`
  }
}

function statusType(status: LinkDisplay['status']) {
  if (status === 'normal') return 'success'
  if (status === 'warning') return 'warning'
  if (status === 'danger') return 'danger'
  return 'info'
}

function formatBps(value: number) {
  if (!value) return '0 bps'
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} Gbps`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} Mbps`
  return `${Math.round(value / 1_000)} Kbps`
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
.metric-card em,
.detail-card span {
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

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 330px;
  gap: 14px;
  flex: 1.15;
  min-height: 0;
  margin-bottom: 12px;
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
  width: 135px;
}

.topology-canvas {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--vscode-border);
  border-radius: 8px;
  background:
    linear-gradient(90deg, rgba(37, 99, 235, 0.08) 1px, transparent 1px),
    linear-gradient(rgba(37, 99, 235, 0.08) 1px, transparent 1px);
  background-size: 36px 36px;
}

.topology-node {
  position: absolute;
  z-index: 2;
  width: 92px;
  min-height: 54px;
  transform: translate(-50%, -50%);
  border: 1px solid var(--vscode-border);
  border-radius: 8px;
  background: var(--vscode-sidebar-bg);
  color: var(--vscode-text);
  cursor: default;
}

.topology-node span {
  display: block;
  margin-top: 4px;
  color: var(--vscode-text-muted);
  font-size: 11px;
}

.topology-node.ground {
  border-color: #16a34a;
}

.topology-line {
  position: absolute;
  z-index: 1;
  height: 2px;
  transform-origin: left center;
  border: 0;
  background: #22c55e;
  cursor: pointer;
}

.topology-line.warning {
  background: #f59e0b;
}

.topology-line.danger,
.topology-line.offline {
  background: #ef4444;
}

.topology-line.disabled {
  opacity: 0.35;
  background: var(--vscode-text-muted);
}

.topology-line span {
  position: absolute;
  left: 50%;
  top: -18px;
  transform: translateX(-50%);
  color: var(--vscode-text-muted);
  font-size: 11px;
  white-space: nowrap;
}

.quality-list,
.detail-stack {
  display: grid;
  gap: 10px;
}

.quality-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--vscode-border);
  border-radius: 8px;
  background: transparent;
  color: var(--vscode-text);
  text-align: left;
  cursor: pointer;
}

.quality-row span {
  display: block;
  margin-top: 4px;
  color: var(--vscode-text-muted);
  font-size: 12px;
}

.detail-card {
  padding: 14px;
}

.detail-card strong {
  display: block;
  margin-top: 8px;
}

.table-panel {
  flex: 0.85;
  min-height: 0;
}

@media (max-width: 1100px) {
  .metric-grid,
  .content-grid {
    grid-template-columns: 1fr;
  }
}
</style>
