<template>
  <div v-if="satellite" class="sat-detail-page">
    <section class="header-row">
      <div>
        <div class="eyebrow">Satellite Detail</div>
        <h1>{{ satellite.name }}</h1>
      </div>
      <div class="header-actions">
        <el-tag :type="statusTagType(satellite.status)" effect="dark">{{ statusLabel(satellite.status) }}</el-tag>
        <el-button type="primary" plain @click="router.push('/remote-sensing')">遥感工作台</el-button>
      </div>
    </section>

    <section class="summary-row">
      <article v-for="item in summaryCards" :key="item.label" class="summary-card">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <em>{{ item.desc }}</em>
      </article>
    </section>

    <section class="detail-grid">
      <el-card class="panel preview-panel" shadow="never">
        <template #header>
          <div class="panel-head">
            <div>
              <h3>单星遥感</h3>
              <p>当前卫星的最新产品</p>
            </div>
            <el-tag type="success">{{ selectedProduct?.status === 'ready' ? '已完成' : '处理中' }}</el-tag>
          </div>
        </template>

        <div v-if="selectedProduct" class="preview-layout">
          <img v-if="selectedProduct.imageUrl" :src="selectedProduct.imageUrl" :alt="selectedProduct.target" class="preview-image" />
          <div v-else class="preview-empty">等待后端遥感图像</div>
          <div class="preview-meta">
            <div class="preview-title">
              <strong>{{ selectedProduct.target || '未选择遥感目标' }}</strong>
              <span>{{ selectedProduct.capturedAt }}</span>
            </div>
            <div class="preview-tags">
              <el-tag size="small">{{ selectedProduct.type.toUpperCase() }}</el-tag>
              <el-tag v-if="selectedProduct.confidence !== null" size="small" type="success">{{ selectedProduct.confidence }}%</el-tag>
              <el-tag v-if="selectedProduct.cloudCover !== null" size="small" type="info">{{ selectedProduct.cloudCover }}% 云量</el-tag>
            </div>
            <div v-if="selectedProduct.findings.length" class="finding-list">
              <div v-for="item in selectedProduct.findings" :key="item" class="finding-item">{{ item }}</div>
            </div>
            <div v-else class="finding-item">等待后端返回识别结果</div>
          </div>
        </div>
      </el-card>

      <div class="side-stack">
        <el-card class="panel metric-panel" shadow="never">
          <template #header>
            <div class="panel-head">
              <div>
                <h3>运行状态</h3>
                <p>轨道、资源和链接</p>
              </div>
            </div>
          </template>
          <div class="metric-grid">
            <div v-for="item in metricCards" :key="item.label" class="metric-item">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </el-card>

        <el-card class="panel task-panel" shadow="never">
          <template #header>
            <div class="panel-head">
              <div>
                <h3>任务入口</h3>
                <p>直接发起新任务</p>
              </div>
            </div>
          </template>

          <el-form label-position="top" :model="taskForm" class="task-form">
            <el-form-item label="目标区域">
              <el-input v-model="taskForm.area" />
            </el-form-item>
            <el-form-item label="目标描述">
              <el-input v-model="taskForm.target" />
            </el-form-item>
            <div class="form-row">
              <el-form-item label="任务类型">
                <el-select v-model="taskForm.type" class="full">
                  <el-option label="光学遥感" value="optical" />
                  <el-option label="SAR 成像" value="sar" />
                  <el-option label="热红外" value="thermal" />
                </el-select>
              </el-form-item>
              <el-form-item label="优先级">
                <el-select v-model="taskForm.priority" class="full">
                  <el-option label="低" value="low" />
                  <el-option label="中" value="medium" />
                  <el-option label="高" value="high" />
                </el-select>
              </el-form-item>
            </div>
            <div class="form-actions">
              <el-button @click="fillExample">填入示例</el-button>
              <el-button type="primary" :loading="remoteStore.loading" @click="submitTask">生成产品</el-button>
            </div>
          </el-form>
        </el-card>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useRemoteSensingStore } from '../stores/remoteSensing'
import { useSatelliteStore } from '../stores/satellite'

const props = defineProps<{ id: string }>()
const route = useRoute()
const router = useRouter()
const satelliteStore = useSatelliteStore()
const remoteStore = useRemoteSensingStore()

const satelliteId = computed(() => (props.id || String(route.params.id || '')).trim())
const satellite = computed(() => satelliteStore.satellites.find((item) => item.instanceId === satelliteId.value))
const selectedProduct = computed(() =>
  remoteStore.products.find((item) => item.satelliteId === satelliteId.value) || remoteStore.selectedProduct
)

const taskForm = reactive({
  area: '西太平洋海域',
  target: '',
  type: 'optical' as 'optical' | 'sar' | 'thermal',
  priority: 'high' as 'low' | 'medium' | 'high'
})

watch(
  satellite,
  (sat) => {
    if (!sat) return
    taskForm.area = sat.alt >= 30000000 ? '全球覆盖区' : '目标观测区'
    taskForm.target = ''
  },
  { immediate: true }
)

const summaryCards = computed(() => [
  { label: '轨道类型', value: (satellite.value?.alt ?? 0) >= 20000000 ? 'MEO / GEO' : 'LEO', desc: '观测和回传策略' },
  { label: '运行状态', value: satellite.value ? statusLabel(satellite.value.status) : '-', desc: '卫星当前健康状态' },
  { label: '产品数量', value: String(remoteStore.products.filter((item) => item.satelliteId === satelliteId.value).length), desc: '该星遥感结果' },
  { label: '当前任务', value: selectedProduct.value?.target || '未选择', desc: '当前聚焦目标' }
])

const metricCards = computed(() => [
  { label: '高度', value: `${Math.round((satellite.value?.alt || 0) / 1000)} km` },
  { label: '倾角', value: `${(satellite.value?.inclination || 0).toFixed(1)}°` },
  { label: '经度', value: `${(satellite.value?.baseLon || 0).toFixed(1)}°` },
  { label: 'CPU', value: `${(satellite.value?.cpu || 0).toFixed(1)}%` }
])

function statusLabel(status: string) {
  if (status === 'warning') return '告警'
  if (status === 'danger') return '严重'
  if (status === 'offline') return '离线'
  return '正常'
}

function statusTagType(status: string) {
  if (status === 'warning') return 'warning'
  if (status === 'danger') return 'danger'
  if (status === 'offline') return 'info'
  return 'success'
}

function fillExample() {
  taskForm.area = '西太平洋海域'
  taskForm.target = ''
  taskForm.type = 'optical'
  taskForm.priority = 'high'
}

async function submitTask() {
  if (!satellite.value) {
    ElMessage.warning('未找到对应卫星')
    return
  }

  await remoteStore.createTask({
    satelliteId: satellite.value.instanceId,
    satelliteName: satellite.value.name,
    area: taskForm.area,
    target: taskForm.target,
    latitude: 0,
    longitude: 0,
    type: taskForm.type,
    priority: taskForm.priority
  })

  ElMessage.success('遥感任务已生成')
}
</script>

<style scoped>
.sat-detail-page {
  height: 100%;
  min-height: 0;
  padding: 16px 18px 18px;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 12px;
  overflow: hidden;
  background: #ffffff;
  color: var(--vscode-text);
}

.header-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.eyebrow {
  color: var(--vscode-text-muted);
  font-size: 12px;
}

.header-row h1 {
  margin: 4px 0 0;
  font-size: 24px;
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.summary-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.summary-card,
.panel {
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: linear-gradient(180deg, #ffffff, #f8fbff);
  box-shadow: none;
  overflow: hidden;
}

.summary-card {
  padding: 12px;
  display: grid;
  gap: 6px;
}

.summary-card span,
.summary-card em,
.panel-head p,
.preview-title span,
.finding-item {
  color: var(--vscode-text-muted);
}

.summary-card strong {
  font-size: 20px;
}

.summary-card em {
  font-style: normal;
  font-size: 12px;
}

.detail-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.75fr);
  gap: 12px;
}

.panel :deep(.el-card__header),
.panel :deep(.el-card__body) {
  padding: 12px;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.panel-head h3 {
  margin: 0;
  font-size: 16px;
}

.panel-head p {
  margin: 4px 0 0;
  font-size: 12px;
}

.preview-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(260px, 0.8fr);
  gap: 12px;
}

.preview-image {
  width: 100%;
  height: 100%;
  min-height: 260px;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.preview-empty {
  width: 100%;
  height: 100%;
  min-height: 220px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  border: 1px dashed rgba(15, 23, 42, 0.18);
  background: rgba(15, 23, 42, 0.035);
  color: var(--vscode-text-muted);
}

.preview-meta {
  display: grid;
  gap: 12px;
}

.preview-title {
  display: grid;
  gap: 4px;
}

.preview-title strong {
  font-size: 16px;
}

.preview-tags,
.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.finding-list {
  display: grid;
  gap: 8px;
}

.finding-item {
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.04);
  color: var(--vscode-text);
  line-height: 1.5;
}

.side-stack {
  display: grid;
  grid-template-rows: 160px 1fr;
  gap: 12px;
  min-height: 0;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.metric-item {
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.04);
}

.metric-item span,
.metric-item strong {
  display: block;
}

.metric-item span {
  color: var(--vscode-text-muted);
  font-size: 12px;
}

.metric-item strong {
  margin-top: 6px;
}

.task-form {
  display: grid;
  gap: 10px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.full {
  width: 100%;
}

@media (max-width: 1280px) {
  .summary-row,
  .detail-grid,
  .preview-layout,
  .form-row {
    grid-template-columns: 1fr;
  }

  .side-stack {
    grid-template-rows: auto auto;
  }
}
</style>
