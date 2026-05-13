<template>
  <div class="rs-page">
    <section class="header-row">
      <div>
        <div class="eyebrow">Remote Sensing</div>
        <h1>遥感工作台</h1>
      </div>
      <div class="header-actions">
        <el-button plain @click="router.push('/earth')">返回卫星群</el-button>
        <el-button type="primary" @click="submitTask">生成任务</el-button>
      </div>
    </section>

    <section class="summary-row">
      <article v-for="item in summaryCards" :key="item.label" class="summary-card">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <em>{{ item.desc }}</em>
      </article>
    </section>

    <section class="workbench-grid">
      <div class="preview-col">
        <el-card class="panel preview-panel" shadow="never">
          <template #header>
            <div class="panel-head">
              <div>
                <h3>影像预览</h3>
                <p>实时产品、目标与成像结果</p>
              </div>
              <el-tag type="success">{{ activeProduct?.status === 'ready' ? '已完成' : '处理中' }}</el-tag>
            </div>
          </template>

          <div v-if="activeProduct" class="preview-layout">
            <img v-if="activeProduct.imageUrl" :src="activeProduct.imageUrl" :alt="activeProduct.target" class="preview-image" />
            <div v-else class="preview-empty">等待后端遥感图像</div>
            <div class="preview-meta">
              <div class="preview-title">
                <strong>{{ activeProduct.target || '未选择遥感目标' }}</strong>
                <span>{{ activeProduct.satelliteName }} · {{ activeProduct.capturedAt }}</span>
              </div>
              <div class="preview-tags">
                <el-tag size="small">{{ activeProduct.type.toUpperCase() }}</el-tag>
                <el-tag v-if="activeProduct.confidence !== null" size="small" type="success">{{ activeProduct.confidence }}%</el-tag>
                <el-tag v-if="activeProduct.cloudCover !== null" size="small" type="info">{{ activeProduct.cloudCover }}% 云量</el-tag>
                <el-tag v-if="activeProduct.resolution" size="small">{{ activeProduct.resolution }}</el-tag>
              </div>
              <div v-if="activeProduct.findings.length" class="finding-list">
                <div v-for="item in activeProduct.findings" :key="item" class="finding-item">{{ item }}</div>
              </div>
              <div v-else class="finding-item">等待后端返回识别结果</div>
            </div>
          </div>
          <div v-else class="preview-empty">暂无遥感产品</div>
        </el-card>

        <div class="compare-row">
          <el-card class="panel compare-panel" shadow="never">
            <template #header>
              <div class="panel-head">
                <div>
                  <h3>成像类型</h3>
                  <p>光学、SAR、热红外</p>
                </div>
              </div>
            </template>
            <div class="type-grid">
              <button
                v-for="item in typeCards"
                :key="item.label"
                class="type-card"
                :class="{ active: taskForm.type === item.value }"
                @click="taskForm.type = item.value"
              >
                <strong>{{ item.label }}</strong>
                <span>{{ item.desc }}</span>
              </button>
            </div>
          </el-card>

          <el-card class="panel compare-panel" shadow="never">
            <template #header>
              <div class="panel-head">
                <div>
                  <h3>产品队列</h3>
                  <p>按时间查看最新影像</p>
                </div>
                <el-tag type="info">{{ products.length }} 项</el-tag>
              </div>
            </template>
            <div class="product-list">
              <button
                v-for="item in products.slice(0, 4)"
                :key="item.id"
                class="product-chip"
                :class="{ active: item.id === activeProduct?.id }"
                @click="remoteStore.selectProduct(item.id)"
              >
                <div>
                  <strong>{{ item.target || '未命名遥感任务' }}</strong>
                  <span>{{ item.area }}</span>
                </div>
                <el-tag size="small" :type="item.status === 'ready' ? 'success' : 'warning'">
                  {{ item.status === 'ready' ? '已完成' : '处理中' }}
                </el-tag>
              </button>
            </div>
          </el-card>
        </div>
      </div>

      <div class="control-col">
        <el-card class="panel control-panel" shadow="never">
          <template #header>
            <div class="panel-head">
              <div>
                <h3>任务配置</h3>
                <p>先选卫星，再选区域和优先级</p>
              </div>
              <el-tag type="success">可接后端</el-tag>
            </div>
          </template>

          <el-form label-position="top" :model="taskForm" class="task-form">
            <el-form-item label="卫星">
              <el-select v-model="taskForm.satelliteId" filterable class="full">
                <el-option
                  v-for="sat in satelliteOptions"
                  :key="sat.id"
                  :label="sat.name"
                  :value="sat.instanceId"
                />
              </el-select>
            </el-form-item>
            <div class="form-row">
              <el-form-item label="目标区域">
                <el-input v-model="taskForm.area" />
              </el-form-item>
              <el-form-item label="任务目标">
                <el-input v-model="taskForm.target" />
              </el-form-item>
            </div>
            <div class="form-row">
              <el-form-item label="纬度">
                <el-input-number v-model="taskForm.latitude" :min="-90" :max="90" :step="0.1" class="full" />
              </el-form-item>
              <el-form-item label="经度">
                <el-input-number v-model="taskForm.longitude" :min="-180" :max="180" :step="0.1" class="full" />
              </el-form-item>
            </div>
            <div class="form-row">
              <el-form-item label="优先级">
                <el-select v-model="taskForm.priority" class="full">
                  <el-option label="低" value="low" />
                  <el-option label="中" value="medium" />
                  <el-option label="高" value="high" />
                </el-select>
              </el-form-item>
              <el-form-item label="模式">
                <el-select v-model="taskForm.type" class="full">
                  <el-option label="光学遥感" value="optical" />
                  <el-option label="SAR 成像" value="sar" />
                  <el-option label="热红外" value="thermal" />
                </el-select>
              </el-form-item>
            </div>
            <div class="form-actions">
              <el-button @click="fillExample">填入示例</el-button>
              <el-button type="primary" :loading="remoteStore.loading" @click="submitTask">生成产品</el-button>
            </div>
          </el-form>
        </el-card>

        <el-card class="panel notes-panel" shadow="never">
          <template #header>
            <div class="panel-head">
              <div>
                <h3>工作流</h3>
                <p>区域、时间、类型、优先级</p>
              </div>
            </div>
          </template>
            <div class="flow-list">
            <div v-for="step in flowSteps" :key="step.title" class="flow-step">
              <strong>{{ step.title }}</strong>
              <span>{{ step.desc }}</span>
            </div>
          </div>
        </el-card>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useRemoteSensingStore } from '../stores/remoteSensing'
import { useSatelliteStore } from '../stores/satellite'

const router = useRouter()
const satelliteStore = useSatelliteStore()
const remoteStore = useRemoteSensingStore()

const taskForm = reactive({
  satelliteId: satelliteStore.satellites[0]?.instanceId || '',
  area: '西太平洋海域',
  target: '',
  latitude: 12.4,
  longitude: 132.8,
  type: 'optical' as 'optical' | 'sar' | 'thermal',
  priority: 'high' as 'low' | 'medium' | 'high'
})

const satelliteOptions = computed(() => satelliteStore.satellites.slice(0, 20))
const selectedSatellite = computed(() =>
  satelliteStore.satellites.find((item) => item.instanceId === taskForm.satelliteId) || satelliteStore.satellites[0]
)
const products = computed(() =>
  remoteStore.products.filter((item) => !taskForm.satelliteId || item.satelliteId === taskForm.satelliteId)
)
const activeProduct = computed(() => products.value.find((item) => item.id === remoteStore.selectedProductId) || products.value[0] || remoteStore.selectedProduct)

const summaryCards = computed(() => [
  { label: '当前卫星', value: selectedSatellite.value?.name || '-', desc: '任务下发对象' },
  { label: '待处理', value: remoteStore.processingCount, desc: '仍在生成中的产品' },
  { label: '已完成', value: remoteStore.readyCount, desc: '可直接查看的结果' },
  { label: '当前模式', value: typeLabel(taskForm.type), desc: '任务成像模式' }
])

const typeCards = [
  { value: 'optical', label: '光学', desc: '直观识别地物' },
  { value: 'sar', label: 'SAR', desc: '穿云观测' },
  { value: 'thermal', label: '热红外', desc: '看温度异常' }
] as const

const flowSteps = [
  { title: '1. 选卫星', desc: '确定观测窗口和任务载体' },
  { title: '2. 选区域', desc: '输入经纬度或目标区域' },
  { title: '3. 选类型', desc: '光学 / SAR / 热红外' },
  { title: '4. 看结果', desc: '查看影像、置信度和发现' }
]

watch(
  () => taskForm.satelliteId,
  (id) => {
    const sat = satelliteStore.satellites.find((item) => item.instanceId === id)
    if (!sat) return
    taskForm.area = sat.alt >= 30000000 ? '全球广域覆盖区' : '目标观测区'
    taskForm.target = ''
  },
  { immediate: true }
)

watch(
  () => taskForm.type,
  (type) => {
    if (type === 'sar') {
      taskForm.target = ''
    } else if (type === 'thermal') {
      taskForm.target = ''
    }
  }
)

function typeLabel(type: string) {
  if (type === 'sar') return 'SAR'
  if (type === 'thermal') return '热红外'
  return '光学'
}

function fillExample() {
  taskForm.area = '西太平洋海域'
  taskForm.target = ''
  taskForm.latitude = 11.8
  taskForm.longitude = 134.2
  taskForm.type = 'optical'
  taskForm.priority = 'high'
}

async function submitTask() {
  const sat = selectedSatellite.value
  if (!sat) {
    ElMessage.warning('未找到对应卫星')
    return
  }

  await remoteStore.createTask({
    satelliteId: sat.instanceId,
    satelliteName: sat.name,
    area: taskForm.area,
    target: taskForm.target,
    latitude: taskForm.latitude,
    longitude: taskForm.longitude,
    type: taskForm.type,
    priority: taskForm.priority
  })

  ElMessage.success('遥感任务已生成')
}
</script>

<style scoped>
.rs-page {
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
.finding-item,
.flow-step span {
  color: var(--vscode-text-muted);
}

.summary-card strong {
  font-size: 20px;
}

.summary-card em {
  font-style: normal;
  font-size: 12px;
}

.workbench-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.8fr);
  gap: 12px;
}

.preview-col,
.control-col {
  min-height: 0;
  min-width: 0;
  display: grid;
  gap: 12px;
}

.preview-col {
  grid-template-rows: minmax(0, 1fr) 176px;
}

.compare-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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

.preview-panel,
.control-panel,
.notes-panel,
.compare-panel {
  min-height: 0;
}

.preview-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(260px, 0.8fr);
  gap: 12px;
}

.preview-image {
  width: 100%;
  height: 100%;
  min-height: 280px;
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
.form-actions,
.remote-tags {
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

.product-list {
  display: grid;
  gap: 8px;
}

.product-chip,
.type-card {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: #fff;
  text-align: left;
  cursor: pointer;
  color: inherit;
}

.product-chip.active,
.type-card.active {
  border-color: var(--vscode-primary);
  background: color-mix(in srgb, var(--vscode-primary) 10%, #fff);
}

.product-chip strong,
.product-chip span,
.type-card strong,
.type-card span {
  display: block;
}

.product-chip span,
.type-card span {
  margin-top: 4px;
  font-size: 12px;
  color: var(--vscode-text-muted);
}

.type-grid {
  display: grid;
  gap: 8px;
}

.flow-list {
  display: grid;
  gap: 10px;
}

.flow-step {
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.04);
  display: grid;
  gap: 4px;
}

@media (max-width: 1280px) {
  .summary-row,
  .workbench-grid,
  .compare-row,
  .preview-layout,
  .form-row {
    grid-template-columns: 1fr;
  }

  .preview-col {
    grid-template-rows: auto auto;
  }
}
</style>
