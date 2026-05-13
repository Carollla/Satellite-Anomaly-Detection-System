<template>
  <div class="editor-page">
    <header class="editor-head">
      <div>
        <span>Constellation Editor</span>
        <h1>可视化编辑</h1>
      </div>
      <div class="head-actions">
        <el-input v-model="keyword" size="small" clearable placeholder="输入卫星名称定位" @keyup.enter="focusByKeyword" />
        <el-button size="small" @click="focusByKeyword">定位</el-button>
        <el-button size="small" @click="addNewSatellite">新增卫星</el-button>
        <el-button size="small" type="primary" :disabled="!selectedSatellite" @click="applySelected">保存修改</el-button>
      </div>
    </header>

    <section class="editor-grid">
      <main class="scene-panel">
        <div class="scene">
          <i v-for="star in stars" :key="star" class="star" :style="starStyle(star)"></i>
          <div class="globe-stage">
            <div class="orbit orbit-leo"></div>
            <div class="orbit orbit-meo"></div>
            <div class="orbit orbit-geo"></div>
            <div class="earth">
              <div class="earth-map"></div>
              <div class="earth-light"></div>
            </div>
            <button
              v-for="sat in visibleSatellites"
              :key="sat.id"
              class="sat-dot"
              :class="[layerOf(sat), sat.status, { active: selectedSatellite?.id === sat.id, muted: !matchesFilter(sat) }]"
              :style="satStyle(sat)"
              :title="`${sat.name} · ${statusLabel(sat.status)}`"
              @click="selectSatellite(sat.id)"
            ></button>
          </div>
          <div class="scene-summary">
            <article v-for="item in sceneStats" :key="item.label">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </article>
          </div>
          <div class="legend-row">
            <span><i class="leo"></i>LEO</span>
            <span><i class="meo"></i>MEO</span>
            <span><i class="geo"></i>GEO</span>
            <span><i class="warning"></i>异常</span>
          </div>
        </div>
      </main>

      <aside class="control-area">
        <section class="panel selected-panel">
          <div class="panel-head">
            <h3>选中卫星</h3>
            <el-tag v-if="selectedSatellite" size="small" :type="statusTagType(editForm.status)">
              {{ statusLabel(editForm.status) }}
            </el-tag>
          </div>
          <div v-if="selectedSatellite" class="selected-card">
            <strong>{{ selectedSatellite.name }}</strong>
            <span>{{ layerOf(selectedSatellite) }} · {{ Math.round(selectedSatellite.alt / 1000) }} km · CPU {{ selectedSatellite.cpu.toFixed(1) }}%</span>
            <div class="selected-actions">
              <el-button size="small" @click="resetSelected">恢复</el-button>
              <el-button size="small" type="danger" plain @click="deleteSelected">删除</el-button>
            </div>
          </div>
          <div v-else class="empty-state">点击左侧卫星点进行编辑</div>
        </section>

        <section class="panel orbit-panel">
          <div class="panel-head">
            <h3>轨道与状态</h3>
            <el-tag size="small">{{ visibleSatellites.length }} 颗</el-tag>
          </div>
          <el-form v-if="selectedSatellite" label-position="top" :model="editForm" class="edit-form">
            <el-form-item label="名称">
              <el-input v-model="editForm.name" size="small" />
            </el-form-item>
            <div class="form-row">
              <el-form-item label="高度 m">
                <el-input-number v-model="editForm.alt" size="small" :step="1000" :min="100000" class="full" />
              </el-form-item>
              <el-form-item label="倾角">
                <el-input-number v-model="editForm.inclination" size="small" :step="0.1" :min="0" :max="180" class="full" />
              </el-form-item>
            </div>
            <div class="form-row">
              <el-form-item label="经度">
                <el-input-number v-model="editForm.baseLon" size="small" :step="1" :min="-180" :max="360" class="full" />
              </el-form-item>
              <el-form-item label="相位">
                <el-input-number v-model="editForm.phase" size="small" :step="1" :min="0" :max="360" class="full" />
              </el-form-item>
            </div>
            <el-form-item label="状态">
              <el-select v-model="editForm.status" size="small" class="full">
                <el-option label="正常" value="normal" />
                <el-option label="告警" value="warning" />
                <el-option label="严重" value="danger" />
                <el-option label="离线" value="offline" />
              </el-select>
            </el-form-item>
          </el-form>
        </section>

        <section class="panel fault-panel">
          <div class="panel-head">
            <h3>异常设置</h3>
            <el-button size="small" text type="primary" :disabled="!selectedSatellite" @click="clearFault">清除</el-button>
          </div>
          <div class="fault-grid">
            <button
              v-for="fault in faultOptions"
              :key="fault.value"
              class="fault-item"
              :class="{ active: editForm.faultType === fault.value }"
              :disabled="!selectedSatellite"
              @click="applyFault(fault)"
            >
              <strong>{{ fault.label }}</strong>
              <span>{{ fault.statusText }}</span>
            </button>
          </div>
        </section>

        <section class="panel scale-panel">
          <div class="panel-head">
            <h3>星座规模</h3>
            <el-tag size="small">{{ constellationCount }} 颗</el-tag>
          </div>
          <el-slider v-model="constellationCount" :min="1" :max="600" :step="1" />
          <div class="scale-actions">
            <el-button size="small" @click="applyCount">同步数量</el-button>
            <el-button size="small" @click="resetConstellation">恢复默认</el-button>
          </div>
        </section>
      </aside>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSatelliteStore, type Satellite } from '../stores/satellite'

type LayerKey = 'LEO' | 'MEO' | 'GEO'

const satelliteStore = useSatelliteStore()
const keyword = ref('')
const stars = Array.from({ length: 42 }, (_, index) => index)

const constellationCount = computed({
  get: () => satelliteStore.constellationCount,
  set: (value: number) => satelliteStore.setConstellationCount(value)
})

const editForm = reactive({
  name: '',
  alt: 550000,
  inclination: 53,
  baseLon: 0,
  phase: 0,
  status: 'normal' as Satellite['status'],
  faultType: 'none'
})

const faultOptions = [
  { value: 'link_loss', label: '星间链路脱锁', status: 'warning', statusText: '告警' },
  { value: 'gateway_loss', label: '信关站失联', status: 'danger', statusText: '严重' },
  { value: 'power_drop', label: '电量快速下降', status: 'warning', statusText: '告警' },
  { value: 'thermal_high', label: '热控异常', status: 'danger', statusText: '严重' },
  { value: 'payload_fault', label: '载荷故障', status: 'danger', statusText: '严重' },
  { value: 'attitude_drift', label: '姿态漂移', status: 'warning', statusText: '告警' },
  { value: 'compute_overload', label: '算力过载', status: 'warning', statusText: '告警' },
  { value: 'telemetry_loss', label: '遥测中断', status: 'offline', statusText: '离线' }
] as const

const selectedSatellite = computed(() => satelliteStore.selectedSatellite)
const visibleSatellites = computed(() => satelliteStore.satellites.slice(0, constellationCount.value))
const sceneStats = computed(() => [
  { label: '总数', value: visibleSatellites.value.length },
  { label: '正常', value: visibleSatellites.value.filter((item) => item.status === 'normal').length },
  { label: '异常', value: visibleSatellites.value.filter((item) => item.status !== 'normal').length },
  { label: '已选', value: selectedSatellite.value?.name || '-' }
])

watch(
  selectedSatellite,
  (sat) => {
    if (!sat) return
    editForm.name = sat.name
    editForm.alt = sat.alt
    editForm.inclination = sat.inclination
    editForm.baseLon = sat.baseLon
    editForm.phase = sat.phase
    editForm.status = sat.status
    editForm.faultType = sat.faultType || 'none'
  },
  { immediate: true }
)

function layerOf(sat: Satellite): LayerKey {
  if (sat.alt >= 30000000) return 'GEO'
  if (sat.alt >= 20000000) return 'MEO'
  return 'LEO'
}

function starStyle(index: number) {
  return {
    left: `${(index * 29) % 100}%`,
    top: `${(index * 41) % 100}%`,
    width: `${1 + (index % 3)}px`,
    height: `${1 + (index % 3)}px`,
    animationDelay: `${(index % 9) * 0.2}s`
  }
}

function satStyle(sat: Satellite) {
  const layer = layerOf(sat)
  const radius = layer === 'GEO' ? 300 : layer === 'MEO' ? 238 : 178
  const angle = (sat.baseLon + sat.phase + sat.id * 0.73) * (Math.PI / 180)
  const x = Math.cos(angle) * radius
  const y = Math.sin(angle) * radius * 0.44
  return {
    left: '50%',
    top: '50%',
    transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
    zIndex: String(layer === 'GEO' ? 7 : layer === 'MEO' ? 8 : 9)
  }
}

function matchesFilter(sat: Satellite) {
  const term = keyword.value.trim().toLowerCase()
  if (!term) return true
  return sat.name.toLowerCase().includes(term) || sat.code.toLowerCase().includes(term)
}

function statusLabel(status: Satellite['status']) {
  if (status === 'warning') return '告警'
  if (status === 'danger') return '严重'
  if (status === 'offline') return '离线'
  return '正常'
}

function statusTagType(status: Satellite['status']) {
  if (status === 'warning') return 'warning'
  if (status === 'danger') return 'danger'
  if (status === 'offline') return 'info'
  return 'success'
}

function selectSatellite(id: number) {
  satelliteStore.selectedSatelliteId = id
}

function focusByKeyword() {
  const term = keyword.value.trim().toLowerCase()
  if (!term) return
  const sat = visibleSatellites.value.find((item) => matchesFilter(item))
  if (!sat) {
    ElMessage.warning('未找到匹配卫星')
    return
  }
  selectSatellite(sat.id)
}

function applySelected() {
  if (!selectedSatellite.value) return
  satelliteStore.updateSatellite(selectedSatellite.value.id, {
    name: editForm.name,
    alt: editForm.alt,
    inclination: editForm.inclination,
    baseLon: editForm.baseLon,
    phase: editForm.phase,
    status: editForm.status,
    faultType: editForm.faultType
  })
  ElMessage.success('卫星参数已保存')
}

function applyFault(fault: (typeof faultOptions)[number]) {
  if (!selectedSatellite.value) return
  editForm.faultType = fault.value
  editForm.status = fault.status as Satellite['status']
  applySelected()
}

function clearFault() {
  if (!selectedSatellite.value) return
  editForm.faultType = 'none'
  editForm.status = 'normal'
  applySelected()
}

function resetSelected() {
  if (!selectedSatellite.value) return
  satelliteStore.restoreSatellite(selectedSatellite.value.id)
  ElMessage.success('选中卫星已恢复')
}

function deleteSelected() {
  if (!selectedSatellite.value) return
  const sat = selectedSatellite.value
  ElMessageBox.confirm(`确认删除 ${sat.name}？`, '删除卫星', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      satelliteStore.deleteSatellite(sat.id)
      ElMessage.success('卫星已删除')
    })
    .catch(() => {})
}

function addNewSatellite() {
  const sat = satelliteStore.addSatellite({
    name: `自定义卫星-${Date.now().toString().slice(-4)}`,
    alt: 550000,
    inclination: 53,
    baseLon: 0,
    phase: 0,
    status: 'normal',
    faultType: 'none'
  })
  satelliteStore.selectedSatelliteId = sat.id
  ElMessage.success('卫星已新增')
}

function applyCount() {
  satelliteStore.setConstellationCount(Number(constellationCount.value))
  if (!satelliteStore.selectedSatelliteId && satelliteStore.satellites[0]) {
    satelliteStore.selectedSatelliteId = satelliteStore.satellites[0].id
  }
  ElMessage.success('数量已同步')
}

function resetConstellation() {
  ElMessageBox.confirm('恢复默认后会重置当前星座编辑，是否继续？', '恢复默认', {
    confirmButtonText: '恢复',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      satelliteStore.normalizeAllAltitudes()
      satelliteStore.setConstellationCount(450)
      satelliteStore.selectedSatelliteId = satelliteStore.satellites[0]?.id || null
      ElMessage.success('已恢复默认配置')
    })
    .catch(() => {})
}

onMounted(() => {
  if (!satelliteStore.selectedSatelliteId) {
    satelliteStore.selectedSatelliteId = satelliteStore.satellites[0]?.id || null
  }
})
</script>

<style scoped>
.editor-page {
  height: 100%;
  min-height: 0;
  padding: 12px;
  display: grid;
  grid-template-rows: 38px minmax(0, 1fr);
  gap: 10px;
  overflow: hidden;
  background:
    radial-gradient(circle at 16% 8%, rgba(47, 109, 246, 0.18), transparent 26%),
    linear-gradient(180deg, #f8fbff 0%, #ffffff 42%, #f4f7fb 100%);
  color: #172033;
}

.editor-head,
.head-actions,
.panel-head,
.selected-actions,
.scale-actions,
.legend-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.editor-head span,
.scene-summary span,
.legend-row,
.selected-card span,
.fault-item span,
.empty-state {
  color: #667085;
  font-size: 12px;
}

.editor-head h1 {
  margin: 0;
  font-size: 22px;
}

.head-actions :deep(.el-input) {
  width: 210px;
}

.editor-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(360px, 0.7fr);
  gap: 10px;
}

.scene-panel,
.panel {
  border: 1px solid rgba(47, 109, 246, 0.14);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.07);
  overflow: hidden;
}

.scene {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 46%, rgba(37, 99, 235, 0.22), transparent 28%),
    linear-gradient(145deg, #07111f, #0d2450 58%, #121d35);
}

.star {
  position: absolute;
  border-radius: 50%;
  background: rgba(232, 240, 255, 0.88);
  box-shadow: 0 0 12px rgba(232, 240, 255, 0.72);
  animation: twinkle 3.6s ease-in-out infinite;
}

.globe-stage {
  position: absolute;
  left: 50%;
  top: 49%;
  width: min(760px, 94%);
  height: min(520px, 82%);
  transform: translate(-50%, -50%);
}

.orbit {
  position: absolute;
  left: 50%;
  top: 50%;
  border-radius: 50%;
  transform: translate(-50%, -50%) scaleY(0.44);
  border: 1px solid rgba(147, 197, 253, 0.24);
}

.orbit-leo {
  width: 356px;
  height: 356px;
}

.orbit-meo {
  width: 476px;
  height: 476px;
  border-color: rgba(45, 212, 191, 0.28);
}

.orbit-geo {
  width: 600px;
  height: 600px;
  border-color: rgba(251, 191, 36, 0.3);
}

.earth {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 190px;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  overflow: hidden;
  background: #0c3b7c;
  box-shadow: 0 0 48px rgba(70, 168, 255, 0.58), inset -24px -20px 34px rgba(3, 10, 31, 0.54);
  z-index: 5;
}

.earth-map {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, transparent 0 7%, rgba(49, 173, 111, 0.82) 8% 18%, transparent 19% 30%, rgba(93, 204, 142, 0.78) 31% 43%, transparent 44% 57%, rgba(53, 186, 122, 0.76) 58% 71%, transparent 72% 100%),
    repeating-linear-gradient(90deg, rgba(114, 196, 255, 0.2) 0 1px, transparent 1px 18px),
    radial-gradient(circle at 45% 40%, #1d9bf0 0, #1554c0 48%, #0b245a 100%);
  background-size: 230% 100%, 100% 100%, 100% 100%;
  animation: earthSpin 18s linear infinite;
}

.earth-light {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 32% 24%, rgba(255, 255, 255, 0.42), transparent 34%);
}

.sat-dot {
  position: absolute;
  width: 6px;
  height: 6px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #60a5fa;
  cursor: pointer;
  box-shadow: 0 0 10px rgba(96, 165, 250, 0.85);
  transition: transform 0.16s ease, opacity 0.16s ease, box-shadow 0.16s ease;
}

.sat-dot.MEO {
  background: #2dd4bf;
  box-shadow: 0 0 10px rgba(45, 212, 191, 0.85);
}

.sat-dot.GEO {
  width: 8px;
  height: 8px;
  background: #fbbf24;
  box-shadow: 0 0 12px rgba(251, 191, 36, 0.9);
}

.sat-dot.warning,
.sat-dot.danger,
.sat-dot.offline {
  width: 10px;
  height: 10px;
  background: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.18), 0 0 18px rgba(239, 68, 68, 0.9);
}

.sat-dot.active {
  width: 14px;
  height: 14px;
  background: #ffffff;
  box-shadow: 0 0 0 4px rgba(250, 204, 21, 0.28), 0 0 24px rgba(250, 204, 21, 0.95);
}

.sat-dot.muted {
  opacity: 0.18;
}

.scene-summary {
  position: absolute;
  left: 14px;
  top: 14px;
  display: grid;
  grid-template-columns: repeat(4, minmax(82px, auto));
  gap: 8px;
  z-index: 12;
}

.scene-summary article {
  padding: 8px 10px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.5);
  color: #f8fafc;
}

.scene-summary strong {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legend-row {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 12px;
  justify-content: flex-start;
  color: #cbd5e1;
}

.legend-row i {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 5px;
  border-radius: 50%;
  background: #60a5fa;
}

.legend-row .meo {
  background: #2dd4bf;
}

.legend-row .geo {
  background: #fbbf24;
}

.legend-row .warning {
  background: #ef4444;
}

.control-area {
  min-height: 0;
  display: grid;
  grid-template-rows: 104px minmax(0, 1.12fr) minmax(0, 0.86fr) 104px;
  gap: 10px;
}

.panel {
  min-height: 0;
  padding: 10px;
  display: flex;
  flex-direction: column;
}

.panel-head h3 {
  margin: 0;
  font-size: 15px;
}

.selected-card {
  min-height: 0;
  display: grid;
  gap: 6px;
}

.selected-card strong,
.selected-card span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.edit-form {
  min-height: 0;
  display: grid;
  gap: 7px;
}

.edit-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.full {
  width: 100%;
}

.fault-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.fault-item {
  min-width: 0;
  padding: 7px 8px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 9px;
  background: #fff;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.fault-item strong,
.fault-item span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fault-item strong {
  font-size: 12px;
}

.fault-item.active {
  border-color: #ef4444;
  background: #fff1f2;
}

.scale-actions {
  justify-content: flex-start;
}

.empty-state {
  height: 100%;
  display: grid;
  place-items: center;
}

@keyframes earthSpin {
  from {
    background-position: 0 0, 0 0, 0 0;
  }
  to {
    background-position: 230% 0, 0 0, 0 0;
  }
}

@keyframes twinkle {
  0%,
  100% {
    opacity: 0.28;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.5);
  }
}

:global(.is-dark) .editor-page {
  background:
    radial-gradient(circle at 14% 10%, rgba(96, 165, 250, 0.22), transparent 26%),
    radial-gradient(circle at 76% 18%, rgba(45, 212, 191, 0.1), transparent 24%),
    linear-gradient(180deg, #07111f 0%, #0d1524 46%, #101827 100%);
  color: #e5e7eb;
}

:global(.is-dark) .scene-panel,
:global(.is-dark) .panel {
  border-color: rgba(148, 163, 184, 0.2);
  background: rgba(15, 23, 42, 0.78);
  box-shadow: 0 16px 34px rgba(0, 0, 0, 0.34);
}

:global(.is-dark) .fault-item {
  border-color: rgba(148, 163, 184, 0.2);
  background: rgba(15, 23, 42, 0.74);
}

:global(.is-dark) .fault-item.active {
  border-color: rgba(248, 113, 113, 0.72);
  background: rgba(127, 29, 29, 0.38);
}

:global(.is-dark) .editor-head span,
:global(.is-dark) .scene-summary span,
:global(.is-dark) .selected-card span,
:global(.is-dark) .fault-item span,
:global(.is-dark) .empty-state {
  color: #a9b6c8;
}
</style>
