<template>
  <div id="cesium-container" ref="cesiumContainer">
    <div class="cinematic-overlay">
      <div class="overlay-top">
        <div class="theater-badge">卫星群视图</div>
        <div class="legend">
          <span><i class="dot leo"></i>低轨卫星</span>
          <span><i class="dot geo"></i>高轨卫星</span>
          <span><i class="dot ground"></i>地面站</span>
          <span><i class="dot warn"></i>告警链路</span>
        </div>
      </div>

      <div class="overlay-bottom">
        <div class="hud-card">
          <span class="hud-label">可视卫星</span>
          <strong>{{ satelliteCount }}</strong>
          <small>当前三维场景卫星数量</small>
        </div>
        <div class="hud-card">
          <span class="hud-label">当前焦点</span>
          <strong>{{ focusedSatelliteName }}</strong>
          <small>{{ focusedSatelliteStatus }}</small>
        </div>
        <div class="hud-card">
          <span class="hud-label">场景模式</span>
          <strong>{{ sceneMode }}</strong>
          <small>自动巡航与手动查看切换</small>
        </div>
      </div>
    </div>

    <transition name="fade-panel">
      <div
        v-if="showAllStatus"
        class="status-drawer"
        @wheel.stop
        @mousedown.stop
        @touchmove.stop
      >
        <div class="status-drawer-head">
          <strong>卫星状态</strong>
          <span>{{ satelliteStore.satellites.length }} 颗</span>
        </div>
        <div
          class="status-drawer-list"
          @wheel.stop
          @mousedown.stop
          @touchmove.stop
          @pointerdown.stop
        >
          <button
            v-for="sat in satelliteStore.satellites"
            :key="sat.id"
            class="status-chip"
            :class="sat.status"
            @click="focusSatelliteFromPanel(sat.id)"
          >
            <div>
              <strong>{{ sat.name }}</strong>
              <span>{{ sat.instanceId }}</span>
            </div>
            <div class="status-chip-meta">
              <span class="status-badge" :class="sat.status">{{ getStatusLabel(sat.status) }}</span>
              <span>{{ sat.cpu.toFixed(1) }}%</span>
            </div>
          </button>
        </div>
      </div>
    </transition>

    <transition name="fade-panel">
      <div v-if="selectedSatelliteCard" class="satellite-float-card">
        <div class="float-card-head">
          <div>
            <strong>{{ selectedSatelliteCard.name }}</strong>
            <span>{{ selectedSatelliteCard.instanceId }}</span>
          </div>
          <el-button class="collapse-btn" plain @click="clearSelection">收起状态</el-button>
        </div>
        <div class="float-card-grid">
          <div class="float-item">
            <label>状态</label>
            <strong class="detail-status" :class="selectedSatelliteCard.status">{{ getStatusLabel(selectedSatelliteCard.status) }}</strong>
          </div>
          <div class="float-item">
            <label>CPU</label>
            <strong>{{ selectedSatelliteCard.cpu.toFixed(1) }}%</strong>
          </div>
          <div class="float-item">
            <label>温度</label>
            <strong>{{ selectedSatelliteCard.temp.toFixed(1) }}°C</strong>
          </div>
          <div class="float-item">
            <label>高度</label>
            <strong>{{ Math.round((selectedSatelliteCard.alt || 0) / 1000) }} km</strong>
          </div>
          <div v-if="selectedOrbitMetrics" class="float-item">
            <label>速度</label>
            <strong>{{ selectedOrbitMetrics.speedKps.toFixed(2) }} km/s</strong>
          </div>
          <div v-if="selectedOrbitMetrics" class="float-item">
            <label>周期</label>
            <strong>{{ selectedOrbitMetrics.periodMinutes.toFixed(1) }} min</strong>
          </div>
        </div>
        <div v-if="selectedSatelliteCard.status !== 'normal'" class="float-item anomaly-box" style="margin-top: 10px; background: rgba(255, 107, 107, 0.1); border: 1px solid rgba(255, 107, 107, 0.2);">
          <label style="color: #ff8c8c">异常情况</label>
          <strong style="color: #fff; font-size: 13px; font-weight: normal; margin-top: 4px;">
            {{ selectedSatelliteCard.status === 'danger' ? '严重故障：链路断开或组件离线' : '告警：性能指标超限' }}
          </strong>
        </div>
        <div style="margin-top: 12px; display: flex; gap: 8px;">
           <el-button type="primary" size="small" style="flex: 1;" @click="openEditDialog(selectedSatelliteCard)">编辑此卫星</el-button>
        </div>
      </div>
    </transition>

    <el-button 
      v-if="!isEditMode && !selectedSatelliteCard" 
      class="floating-edit-btn" 
      type="primary" 
      plain
      @click="isEditMode = true"
    >
      编辑卫星菜单
    </el-button>

    <transition name="fade-panel">
      <div v-if="isEditMode" class="edit-drawer" @wheel.stop @mousedown.stop @touchmove.stop>
        <div class="edit-drawer-head">
          <strong>卫星编辑</strong>
          <el-button size="small" plain @click="isEditMode = false">关闭</el-button>
        </div>
        <div style="margin-bottom: 12px;">
          <el-button type="primary" size="small" style="width: 100%;" @click="openAddDialog">
            + 添加自定义卫星
          </el-button>
        </div>
        <div class="edit-drawer-list">
          <div v-for="sat in satelliteStore.satellites" :key="sat.id" class="edit-list-item">
            <div class="edit-item-info">
              <strong>{{ sat.name }}</strong>
              <span class="status-badge" :class="sat.status" style="transform: scale(0.8); transform-origin: left center;">{{ getStatusLabel(sat.status) }}</span>
            </div>
            <div class="edit-item-actions">
              <el-button size="small" link type="primary" @click="openEditDialog(sat)">编辑</el-button>
              <el-button size="small" link type="danger" @click="deleteSat(sat.id)">删除</el-button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <el-dialog v-model="showEditDialog" :title="editForm.id ? '编辑卫星' : '添加卫星'" width="400px" append-to-body>
      <el-form :model="editForm" label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="editForm.name" />
        </el-form-item>
        <el-form-item label="高度 (m)">
          <el-input-number v-model="editForm.alt" :step="1000" style="width: 100%" />
        </el-form-item>
        <el-form-item label="倾角 (°)">
          <el-input-number v-model="editForm.inclination" :step="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="基础经度">
          <el-input-number v-model="editForm.baseLon" :step="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="editForm.status" style="width: 100%">
            <el-option label="正常" value="normal" />
            <el-option label="告警" value="warning" />
            <el-option label="严重" value="danger" />
            <el-option label="离线" value="offline" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">确定</el-button>
      </template>
    </el-dialog>

    <div v-if="webglUnavailable" class="cesium-placeholder">
      <div class="placeholder-content">
        <div class="placeholder-icon">3D</div>
        <div class="placeholder-title">三维场景暂不可用</div>
        <div class="placeholder-message">
          当前环境没有可用的 WebGL，系统已切换到降级展示模式，其余功能仍可继续使用。
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { useCesium } from '../../composables/useCesium'
import { useInstanceStore } from '../../stores/instance'
import { useLinkStore } from '../../stores/link'
import { useSatelliteStore } from '../../stores/satellite'
import { useUIStore } from '../../stores/ui'

const props = withDefaults(
  defineProps<{
    showAllStatus?: boolean
    showFloatCard?: boolean
  }>(),
  {
    showAllStatus: false,
    showFloatCard: true
  }
)

const cesiumContainer = ref<HTMLElement | null>(null)
const { initCesium, viewer } = useCesium()
const instanceStore = useInstanceStore()
const linkStore = useLinkStore()
const satelliteStore = useSatelliteStore()
const uiStore = useUIStore()

const isPaused = ref(false)
const webglUnavailable = ref(false)
const sceneMode = ref('自动巡航')
let interactionTimeout: number | null = null
let selectionHandler: Cesium.ScreenSpaceEventHandler | null = null
let satelliteSpriteImage = ''

const EARTH_RADIUS_METERS = 6378137
const EARTH_MU = 3.986004418e14
const EARTH_ROTATION_RAD_PER_SEC = (2 * Math.PI) / 86164.0905
const SATELLITE_SCALE_BY_DISTANCE = new Cesium.NearFarScalar(9000000, 1.05, 90000000, 0.42)

const satelliteCount = computed(() => satelliteStore.satellites.length)
const focusedSatelliteName = computed(() => satelliteStore.selectedSatellite?.name || '未选择')
const focusedSatelliteStatus = computed(() =>
  satelliteStore.selectedSatellite ? getStatusLabel(satelliteStore.selectedSatellite.status) : '全局自由视角'
)
const showAllStatus = computed(() => props.showAllStatus)
const selectedSatelliteCard = computed(() => satelliteStore.selectedSatellite)
const selectedOrbitMetrics = computed(() =>
  selectedSatelliteCard.value ? getOrbitMetrics(selectedSatelliteCard.value.alt || 500000) : null
)
const isEditMode = ref(false)
const showEditDialog = ref(false)
const editForm = ref({
  id: 0,
  name: '',
  alt: 550000,
  inclination: 53,
  baseLon: 0,
  status: 'normal' as 'normal' | 'warning' | 'danger' | 'offline'
})

function getStatusLabel(status: string) {
  if (status === 'warning') return '告警'
  if (status === 'danger') return '严重'
  if (status === 'offline') return '离线'
  return '正常'
}

function statusColor(status: string) {
  if (status === 'warning') return Cesium.Color.fromCssColorString('#ffd04b')
  if (status === 'danger') return Cesium.Color.fromCssColorString('#ff6b6b')
  if (status === 'offline') return Cesium.Color.fromCssColorString('#7b8794')
  return Cesium.Color.fromCssColorString('#00d2ff')
}

function getSatelliteLayer(altitudeMeters: number) {
  if (altitudeMeters >= 30000000) return 'GEO'
  if (altitudeMeters >= 20000000) return 'MEO'
  return 'LEO'
}

function satelliteSpriteSize(sat: any, selected = false) {
  const layer = getSatelliteLayer(sat.alt || 0)
  const isAbnormal = sat.status === 'warning' || sat.status === 'danger' || sat.status === 'offline'
  if (selected) return layer === 'GEO' ? 52 : 46
  if (isAbnormal) return layer === 'GEO' ? 44 : 40
  if (layer === 'GEO') return 36
  if (layer === 'MEO') return 34
  return 30
}

function satelliteSpriteColor(sat: any, selected = false) {
  if (selected) return Cesium.Color.fromCssColorString('#ffffff').withAlpha(0.96)
  if (sat.status === 'warning') return Cesium.Color.fromCssColorString('#ffd36f').withAlpha(0.82)
  if (sat.status === 'danger') return Cesium.Color.fromCssColorString('#ff8a8a').withAlpha(0.82)
  if (sat.status === 'offline') return Cesium.Color.fromCssColorString('#7f8b96').withAlpha(0.68)
  const layer = getSatelliteLayer(sat.alt || 0)
  if (layer === 'GEO') return Cesium.Color.fromCssColorString('#f1dc93').withAlpha(0.8)
  if (layer === 'MEO') return Cesium.Color.fromCssColorString('#8ddff5').withAlpha(0.84)
  return Cesium.Color.fromCssColorString('#b8f0ff').withAlpha(0.78)
}

function createSatelliteSprite() {
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 200
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const cx = canvas.width / 2
  const cy = canvas.height / 2
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const halo = ctx.createRadialGradient(cx, cy, 8, cx, cy, 96)
  halo.addColorStop(0, 'rgba(70, 220, 255, 0.38)')
  halo.addColorStop(0.35, 'rgba(48, 120, 255, 0.13)')
  halo.addColorStop(0.68, 'rgba(124, 92, 255, 0.08)')
  halo.addColorStop(1, 'rgba(48, 120, 255, 0)')
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const leftPanel = { x: 28, y: 74, w: 96, h: 48 }
  const rightPanel = { x: 196, y: 74, w: 96, h: 48 }
  const panelGradient = ctx.createLinearGradient(28, 74, 124, 122)
  panelGradient.addColorStop(0, 'rgba(8, 18, 39, 0.98)')
  panelGradient.addColorStop(0.46, 'rgba(28, 70, 118, 0.94)')
  panelGradient.addColorStop(1, 'rgba(6, 12, 24, 0.98)')
  ctx.fillStyle = panelGradient
  ctx.beginPath()
  ctx.roundRect(leftPanel.x, leftPanel.y, leftPanel.w, leftPanel.h, 7)
  ctx.fill()
  const rightGradient = ctx.createLinearGradient(196, 74, 292, 122)
  rightGradient.addColorStop(0, 'rgba(6, 12, 24, 0.98)')
  rightGradient.addColorStop(0.54, 'rgba(28, 70, 118, 0.94)')
  rightGradient.addColorStop(1, 'rgba(8, 18, 39, 0.98)')
  ctx.fillStyle = rightGradient
  ctx.beginPath()
  ctx.roundRect(rightPanel.x, rightPanel.y, rightPanel.w, rightPanel.h, 7)
  ctx.fill()

  ctx.strokeStyle = 'rgba(92, 235, 255, 0.42)'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.roundRect(leftPanel.x + 1, leftPanel.y + 1, leftPanel.w - 2, leftPanel.h - 2, 7)
  ctx.stroke()
  ctx.beginPath()
  ctx.roundRect(rightPanel.x + 1, rightPanel.y + 1, rightPanel.w - 2, rightPanel.h - 2, 7)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(130, 205, 255, 0.22)'
  ctx.lineWidth = 1
  for (let x = leftPanel.x + 12; x < leftPanel.x + leftPanel.w; x += 14) {
    ctx.beginPath()
    ctx.moveTo(x, leftPanel.y + 4)
    ctx.lineTo(x, leftPanel.y + leftPanel.h - 4)
    ctx.stroke()
  }
  for (let x = rightPanel.x + 12; x < rightPanel.x + rightPanel.w; x += 14) {
    ctx.beginPath()
    ctx.moveTo(x, rightPanel.y + 4)
    ctx.lineTo(x, rightPanel.y + rightPanel.h - 4)
    ctx.stroke()
  }
  for (let y = leftPanel.y + 12; y < leftPanel.y + leftPanel.h; y += 12) {
    ctx.beginPath()
    ctx.moveTo(leftPanel.x + 4, y)
    ctx.lineTo(leftPanel.x + leftPanel.w - 4, y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(rightPanel.x + 4, y)
    ctx.lineTo(rightPanel.x + rightPanel.w - 4, y)
    ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(198, 218, 234, 0.72)'
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(124, 98)
  ctx.lineTo(143, 98)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(177, 98)
  ctx.lineTo(196, 98)
  ctx.stroke()

  const bodyGradient = ctx.createLinearGradient(132, 52, 188, 146)
  bodyGradient.addColorStop(0, 'rgba(220, 232, 244, 0.96)')
  bodyGradient.addColorStop(0.28, 'rgba(78, 96, 118, 0.98)')
  bodyGradient.addColorStop(0.7, 'rgba(21, 30, 46, 0.98)')
  bodyGradient.addColorStop(1, 'rgba(180, 194, 208, 0.92)')
  ctx.fillStyle = bodyGradient
  ctx.beginPath()
  ctx.moveTo(160, 46)
  ctx.lineTo(184, 62)
  ctx.lineTo(190, 101)
  ctx.lineTo(176, 143)
  ctx.lineTo(144, 143)
  ctx.lineTo(130, 101)
  ctx.lineTo(136, 62)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = 'rgba(227, 246, 255, 0.7)'
  ctx.lineWidth = 1.8
  ctx.beginPath()
  ctx.moveTo(160, 49)
  ctx.lineTo(181, 64)
  ctx.lineTo(186, 100)
  ctx.lineTo(173, 139)
  ctx.lineTo(147, 139)
  ctx.lineTo(134, 100)
  ctx.lineTo(139, 64)
  ctx.closePath()
  ctx.stroke()

  const bodyGlow = ctx.createRadialGradient(160, 94, 4, 160, 94, 44)
  bodyGlow.addColorStop(0, 'rgba(100, 232, 255, 0.68)')
  bodyGlow.addColorStop(0.34, 'rgba(84, 170, 255, 0.2)')
  bodyGlow.addColorStop(1, 'rgba(84, 170, 255, 0)')
  ctx.fillStyle = bodyGlow
  ctx.beginPath()
  ctx.roundRect(139, 58, 42, 76, 12)
  ctx.fill()

  ctx.fillStyle = 'rgba(220, 248, 255, 0.88)'
  ctx.beginPath()
  ctx.arc(160, 86, 12, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(28, 80, 122, 0.94)'
  ctx.beginPath()
  ctx.arc(160, 86, 5, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = 'rgba(170, 236, 255, 0.72)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(160, 46)
  ctx.lineTo(160, 25)
  ctx.stroke()
  ctx.fillStyle = 'rgba(150, 236, 255, 0.82)'
  ctx.beginPath()
  ctx.arc(160, 22, 4.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = 'rgba(130, 218, 255, 0.55)'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(147, 128)
  ctx.lineTo(132, 154)
  ctx.moveTo(173, 128)
  ctx.lineTo(188, 154)
  ctx.stroke()

  const engineGlow = ctx.createRadialGradient(160, 142, 2, 160, 142, 34)
  engineGlow.addColorStop(0, 'rgba(72, 226, 255, 0.72)')
  engineGlow.addColorStop(0.45, 'rgba(58, 130, 255, 0.24)')
  engineGlow.addColorStop(1, 'rgba(58, 130, 255, 0)')
  ctx.fillStyle = engineGlow
  ctx.fillRect(126, 126, 68, 48)

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.52)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(145, 67)
  ctx.lineTo(175, 67)
  ctx.moveTo(142, 116)
  ctx.lineTo(178, 116)
  ctx.stroke()

  return canvas.toDataURL('image/png')
}

function clearSelection() {
  satelliteStore.selectedSatelliteId = null
  isPaused.value = false
  sceneMode.value = '自动巡航'
  if (viewer.value && !viewer.value.isDestroyed()) {
    viewer.value.trackedEntity = undefined
    viewer.value.clock.shouldAnimate = true
    viewer.value.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(108, 24, 18500000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0
      },
      duration: 1.2
    })
  }
}

function resetEditForm() {
  editForm.value = {
    id: 0,
    name: '',
    alt: 550000,
    inclination: 53,
    baseLon: 0,
    status: 'normal'
  }
}

function openAddDialog() {
  resetEditForm()
  showEditDialog.value = true
}

function openEditDialog(sat: any) {
  if (!sat) return
  editForm.value = {
    id: sat.id || 0,
    name: sat.name || '',
    alt: sat.alt || 550000,
    inclination: sat.inclination || 0,
    baseLon: sat.baseLon || 0,
    status: sat.status || 'normal'
  }
  showEditDialog.value = true
}

function saveEdit() {
  const payload = {
    name: editForm.value.name,
    alt: editForm.value.alt,
    inclination: editForm.value.inclination,
    baseLon: editForm.value.baseLon,
    status: editForm.value.status
  }

  if (editForm.value.id) {
    satelliteStore.updateSatellite(editForm.value.id, payload)
    if (satelliteStore.selectedSatelliteId === editForm.value.id) {
      satelliteStore.selectedSatelliteId = editForm.value.id
    }
  } else {
    satelliteStore.addSatellite(payload)
  }

  showEditDialog.value = false
}

function deleteSat(id: number) {
  satelliteStore.deleteSatellite(id)
  if (selectedSatelliteCard.value?.id === id) {
    clearSelection()
  }
}

function getOrbitMetrics(altitudeMeters: number) {
  const altitude = Math.max(Number(altitudeMeters || 0), 0)
  const orbitalRadius = EARTH_RADIUS_METERS + altitude
  const speedMps = Math.sqrt(EARTH_MU / orbitalRadius)
  const periodSeconds = 2 * Math.PI * Math.sqrt((orbitalRadius ** 3) / EARTH_MU)

  return {
    altitudeMeters: altitude,
    orbitalRadius,
    speedMps,
    speedKps: speedMps / 1000,
    periodSeconds,
    periodMinutes: periodSeconds / 60
  }
}

function getSatellitePosition(sat: any, time: Cesium.JulianDate, startTime: Cesium.JulianDate) {
  const seconds = Cesium.JulianDate.secondsDifference(time, startTime)
  const orbit = getOrbitMetrics(sat.alt || 500000)
  const phase0 = Cesium.Math.toRadians(sat.phase || 0)
  const inclination = Cesium.Math.toRadians(sat.inclination || 0)
  const raan = Cesium.Math.toRadians(sat.baseLon || 0)
  const trueAnomaly = phase0 + (seconds / orbit.periodSeconds) * 2 * Math.PI

  const xOrbital = orbit.orbitalRadius * Math.cos(trueAnomaly)
  const yOrbital = orbit.orbitalRadius * Math.sin(trueAnomaly)

  const cosRaan = Math.cos(raan)
  const sinRaan = Math.sin(raan)
  const cosInclination = Math.cos(inclination)
  const sinInclination = Math.sin(inclination)

  const xEci = cosRaan * xOrbital - sinRaan * cosInclination * yOrbital
  const yEci = sinRaan * xOrbital + cosRaan * cosInclination * yOrbital
  const zEci = sinInclination * yOrbital

  const earthRotation = EARTH_ROTATION_RAD_PER_SEC * seconds
  const cosEarthRotation = Math.cos(earthRotation)
  const sinEarthRotation = Math.sin(earthRotation)

  const xEcef = cosEarthRotation * xEci + sinEarthRotation * yEci
  const yEcef = -sinEarthRotation * xEci + cosEarthRotation * yEci
  const zEcef = zEci

  const longitude = Math.atan2(yEcef, xEcef)
  const latitude = Math.atan2(zEcef, Math.sqrt(xEcef ** 2 + yEcef ** 2))

  return Cesium.Cartesian3.fromRadians(longitude, latitude, sat.alt || 500000)
}

function makeOrbitPositions(inclination: number, baseLon: number, altitude: number) {
  const points: Cesium.Cartesian3[] = []
  const orbit = getOrbitMetrics(altitude || 500000)
  const inclRad = Cesium.Math.toRadians(inclination || 0)
  const raan = Cesium.Math.toRadians(baseLon || 0)
  const cosRaan = Math.cos(raan)
  const sinRaan = Math.sin(raan)
  const cosInclination = Math.cos(inclRad)
  const sinInclination = Math.sin(inclRad)
  for (let i = 0; i <= 360; i += 2) {
    const trueAnomaly = Cesium.Math.toRadians(i)
    const xOrbital = orbit.orbitalRadius * Math.cos(trueAnomaly)
    const yOrbital = orbit.orbitalRadius * Math.sin(trueAnomaly)

    const xEcef = cosRaan * xOrbital - sinRaan * cosInclination * yOrbital
    const yEcef = sinRaan * xOrbital + cosRaan * cosInclination * yOrbital
    const zEcef = sinInclination * yOrbital

    const longitude = Math.atan2(yEcef, xEcef)
    const latitude = Math.atan2(zEcef, Math.sqrt(xEcef ** 2 + yEcef ** 2))

    points.push(Cesium.Cartesian3.fromRadians(longitude, latitude, altitude))
  }
  return points
}

function focusSatellite(id: number) {
  const v = viewer.value
  if (!v || v.isDestroyed()) return

  const sat = satelliteStore.satellites.find((item) => item.id === id)
  if (!sat) return

  satelliteStore.selectedSatelliteId = id
  isPaused.value = false
  sceneMode.value = '聚焦查看'
  v.clock.shouldAnimate = true
  const entity = v.entities.getById(String(id))
  if (!entity) return
  const followDistance = Math.max((sat.alt || 500000) * 2.4, 1800000)
  entity.viewFrom = new Cesium.ConstantPositionProperty(
    new Cesium.Cartesian3(0, -followDistance, followDistance * 0.42)
  ) as any
  v.trackedEntity = entity

  v.flyTo(entity, {
    duration: 1.2,
    offset: new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(0),
      Cesium.Math.toRadians(-20),
      followDistance
    )
  })
}

function focusSatelliteFromPanel(id: number) {
  focusSatellite(id)
}

function buildScene(v: Cesium.Viewer) {
  if (!v || !v.entities || v.isDestroyed()) return

  v.entities.removeAll()
  if (!satelliteSpriteImage) {
    satelliteSpriteImage = createSatelliteSprite()
  }

  const startTime = v.clock.startTime
  const positionMap = satelliteStore.positions
  const satellites = satelliteStore.satellites
  const groundInstances = instanceStore.instancesForDisplay.filter(
    (item) => !item.type.toLowerCase().includes('satellite')
  )

  satellites.forEach((sat) => {
    const isGeo = (sat.alt || 0) > 10000000
    const color = statusColor(sat.status)
    const isAbnormal = sat.status === 'warning' || sat.status === 'danger' || sat.status === 'offline'

    v.entities.add({
      id: String(sat.id),
      name: sat.name,
      position: new Cesium.CallbackPositionProperty(
        () => getSatellitePosition(sat, v.clock.currentTime, startTime),
        false
      ),
      billboard: {
        image: satelliteSpriteImage,
        width: satelliteSpriteSize(sat, satelliteStore.selectedSatelliteId === sat.id),
        height: Math.round(satelliteSpriteSize(sat, satelliteStore.selectedSatelliteId === sat.id) * 0.62),
        color: satelliteSpriteColor(sat, satelliteStore.selectedSatelliteId === sat.id),
        scaleByDistance: SATELLITE_SCALE_BY_DISTANCE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.CENTER
      },
      path: {
        show: isAbnormal || satelliteStore.selectedSatelliteId === sat.id,
        leadTime: 0,
        trailTime: isGeo ? 3600 : 1800,
        width: isAbnormal ? (isGeo ? 2.4 : 2) : 1.2,
        material: color.withAlpha(isAbnormal ? 0.72 : 0.45)
      },
      label: {
        text: `${isAbnormal ? '异常 · ' : ''}${sat.name}`,
        font: '600 11px "Microsoft YaHei", sans-serif',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        pixelOffset: new Cesium.Cartesian2(0, -10),
        fillColor: isAbnormal ? color.withAlpha(0.98) : Cesium.Color.WHITE.withAlpha(0.85),
        outlineColor: Cesium.Color.fromCssColorString('#020713').withAlpha(0.72),
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        show: isAbnormal || satelliteStore.selectedSatelliteId === sat.id
      }
    })

    if (isAbnormal) {
      v.entities.add({
        id: `sat-halo-${sat.instanceId}`,
        position: new Cesium.CallbackPositionProperty(
          () => getSatellitePosition(sat, v.clock.currentTime, startTime),
          false
        ),
        ellipsoid: {
          radii: new Cesium.Cartesian3(
            isGeo ? 700000 : 240000,
            isGeo ? 700000 : 240000,
            isGeo ? 700000 : 240000
          ),
          material: color.withAlpha(sat.status === 'danger' ? 0.18 : 0.1),
          outline: false
        }
      })
    }

    v.entities.add({
      id: `orbit-${sat.instanceId}`,
      polyline: {
        positions: makeOrbitPositions(sat.inclination || 0, sat.baseLon || 0, sat.alt || 500000),
        width: isAbnormal ? 1.5 : 0.8,
        material: color.withAlpha(isAbnormal ? 0.35 : 0.05)
      }
    })
  })

  if (satelliteStore.selectedSatelliteId !== null) {
    const tracked = v.entities.getById(String(satelliteStore.selectedSatelliteId))
    if (tracked) {
      v.trackedEntity = tracked
    }
  }

  groundInstances.forEach((ground) => {
    const position = positionMap[ground.id]
    if (!position) return

    const groundCartesian = Cesium.Cartesian3.fromDegrees(
      position.longitude,
      position.latitude,
      position.altitude || 30
    )

    v.entities.add({
      id: `ground-${ground.id}`,
      name: ground.name,
      position: groundCartesian,
      cylinder: {
        length: 180000,
        topRadius: 0,
        bottomRadius: 45000,
        material: Cesium.Color.fromCssColorString('#7dcfff').withAlpha(0.55)
      },
      label: {
        text: ground.name,
        font: '600 12px "Microsoft YaHei", sans-serif',
        pixelOffset: new Cesium.Cartesian2(0, -24),
        fillColor: Cesium.Color.WHITE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    })
  })

  linkStore.linksForDisplay.forEach((link) => {
    const [startId, endId] = link.endpoints
    const startSatellite = satellites.find((item) => item.instanceId === startId)
    const endSatellite = satellites.find((item) => item.instanceId === endId)
    const startGround = positionMap[startId]
    const endGround = positionMap[endId]

    const lineColor =
      link.status === 'danger'
        ? Cesium.Color.fromCssColorString('#ff6b6b')
        : link.status === 'warning'
          ? Cesium.Color.fromCssColorString('#ffd04b')
          : link.enabled
            ? Cesium.Color.fromCssColorString('#7dcfff')
            : Cesium.Color.fromCssColorString('#6b7480')
    const isAbnormalLink = link.status === 'danger' || link.status === 'warning' || !link.enabled

    v.entities.add({
      id: `link-${link.id}`,
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          const positions: Cesium.Cartesian3[] = []

          if (startSatellite) positions.push(getSatellitePosition(startSatellite, v.clock.currentTime, startTime))
          else if (startGround) {
            positions.push(Cesium.Cartesian3.fromDegrees(startGround.longitude, startGround.latitude, startGround.altitude))
          }

          if (endSatellite) positions.push(getSatellitePosition(endSatellite, v.clock.currentTime, startTime))
          else if (endGround) {
            positions.push(Cesium.Cartesian3.fromDegrees(endGround.longitude, endGround.latitude, endGround.altitude))
          }

          return positions
        }, false),
        width: link.status === 'danger' ? 3.8 : link.status === 'warning' ? 3 : 1.5,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: isAbnormalLink ? 0.32 : 0.15,
          taperPower: 0.35,
          color: lineColor.withAlpha(link.enabled ? (isAbnormalLink ? 0.95 : 0.68) : 0.55)
        }),
        arcType: Cesium.ArcType.NONE
      }
    })
  })
}

onMounted(() => {
  if (!cesiumContainer.value) return
  const isElectron = typeof window !== 'undefined' && (window as any).electronAPI

  setTimeout(async () => {
    try {
      await Promise.all([
        instanceStore.fetchInstances(),
        instanceStore.fetchAllResources(),
        linkStore.fetchLinks(),
        linkStore.fetchAllResources(),
        satelliteStore.fetchPositions()
      ])

      const v = await initCesium(cesiumContainer.value as HTMLElement)
      const canvasElement = v.canvas

      if (canvasElement) {
        canvasElement.addEventListener('webglcontextlost', (event: Event) => {
          event.preventDefault()
        })
        canvasElement.addEventListener('webglcontextrestored', () => {
          location.reload()
        })
      }

      v.scene.globe.show = true
      v.scene.globe.enableLighting = false
      v.scene.globe.showGroundAtmosphere = true
      v.scene.globe.atmosphereLightIntensity = 18
      v.scene.globe.baseColor = Cesium.Color.fromCssColorString('#10253f')
      v.scene.backgroundColor = Cesium.Color.fromCssColorString('#020811')
      v.scene.postProcessStages.fxaa.enabled = true
      v.shadowMap.enabled = false

      if (!v.imageryLayers.length) {
        try {
          const highResMap = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
            'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
            { enablePickFeatures: false }
          )
          v.imageryLayers.addImageryProvider(highResMap)
        } catch (imageryError) {
          // Keep the scene usable when the external imagery service is blocked or unavailable.
          console.warn('[Cesium] Failed to load ArcGIS imagery, continuing without satellite basemap.', imageryError)
        }
      }

      if (v.imageryLayers.length > 0) {
        const imageryLayer = v.imageryLayers.get(0)
        imageryLayer.brightness = 0.5
        imageryLayer.gamma = 0.7
        imageryLayer.saturation = 0.2
      }

      const earthCenter = Cesium.Cartesian3.fromDegrees(108, 24, 0)
      v.camera.lookAt(
        earthCenter,
        new Cesium.HeadingPitchRange(Cesium.Math.toRadians(0), Cesium.Math.toRadians(-90), 18500000)
      )
      v.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
      v.clock.shouldAnimate = true
      v.clock.multiplier = 1

      selectionHandler = new Cesium.ScreenSpaceEventHandler(v.scene.canvas)
      selectionHandler.setInputAction((movement: any) => {
        const pickedObject = v.scene.pick(movement.position)
        if (Cesium.defined(pickedObject) && pickedObject.id) {
          const entity = pickedObject.id
          if (entity instanceof Cesium.Entity && entity.id && /^\d+$/.test(entity.id)) {
            focusSatellite(parseInt(entity.id, 10))
            return
          }
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

      v.camera.moveStart.addEventListener(() => {
        if (interactionTimeout) clearTimeout(interactionTimeout)
        sceneMode.value = '手动控制'
        if (!v.trackedEntity && !isPaused.value) v.clock.shouldAnimate = false
      })

      v.camera.moveEnd.addEventListener(() => {
        if (interactionTimeout) clearTimeout(interactionTimeout)
        interactionTimeout = window.setTimeout(() => {
          if (!v.trackedEntity && !isPaused.value) {
            v.clock.shouldAnimate = true
            sceneMode.value = '自动巡航'
          }
        }, 2200)
      })

      buildScene(v)

      watch(
        () => [
          satelliteStore.satellites,
          satelliteStore.positions,
          instanceStore.instancesForDisplay,
          linkStore.linksForDisplay
        ],
        () => buildScene(v),
        { deep: true }
      )
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'unknown error'
      const isWebGLError =
        errorMessage.includes('WebGL') ||
        errorMessage.includes('webgl') ||
        errorMessage.includes('context') ||
        errorMessage.includes('initialization failed')
      if (isWebGLError) webglUnavailable.value = true
      else if (cesiumContainer.value) {
        cesiumContainer.value.innerHTML = `
          <div style="color:#8B92B9;padding:20px;text-align:center;font-size:14px;">
            <p style="color:#FFD04B;margin-bottom:12px;">三维场景初始化失败</p>
            <p style="font-size:12px;margin-top:8px;color:#5A6178;">${errorMessage}</p>
          </div>
        `
      }
    }
  }, isElectron ? 1500 : 500)
})

watch(
  () => uiStore.isImmersiveMode,
  (isImmersive) => {
    if (!isImmersive && viewer.value && !viewer.value.isDestroyed() && !webglUnavailable.value) {
      clearSelection()
    }
  }
)

onBeforeUnmount(() => {
  if (interactionTimeout) clearTimeout(interactionTimeout)
  if (selectionHandler) {
    selectionHandler.destroy()
    selectionHandler = null
  }
  if (viewer.value && !viewer.value.isDestroyed()) {
    viewer.value.trackedEntity = undefined
    viewer.value.destroy()
    viewer.value = null
  }
})
</script>

<style scoped>
#cesium-container {
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 0;
  background:
    radial-gradient(circle at 50% 50%, rgba(125, 207, 255, 0.08), transparent 28%),
    linear-gradient(180deg, #020712 0%, #07101c 100%);
}

.cinematic-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 24px 28px;
  pointer-events: none;
  background:
    radial-gradient(circle at 50% 50%, transparent 20%, rgba(2, 8, 17, 0.22) 100%),
    linear-gradient(180deg, rgba(2, 8, 17, 0.5), transparent 25%, transparent 76%, rgba(2, 8, 17, 0.48));
}

.overlay-top,
.overlay-bottom {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.theater-badge,
.legend,
.hud-card,
.status-drawer,
.satellite-float-card {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(7, 14, 23, 0.58);
  backdrop-filter: blur(16px);
}

.theater-badge,
.legend {
  padding: 10px 14px;
  border-radius: 999px;
  color: #eef3f8;
  font-size: 12px;
  letter-spacing: 0.08em;
}

.legend {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.legend span {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #d8e5f2;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.dot.leo { background: #00d2ff; box-shadow: 0 0 6px rgba(0,210,255,0.6); }
.dot.geo { background: #ff7d7d; }
.dot.ground { background: #7dcfff; }
.dot.warn { background: #ffd04b; }

.overlay-bottom {
  align-items: flex-end;
}

.hud-card {
  min-width: 180px;
  padding: 14px 16px;
  border-radius: 20px;
  pointer-events: none;
}

.hud-label,
.hud-card small {
  display: block;
  color: #99b0c5;
}

.hud-card strong {
  display: block;
  margin: 6px 0;
  color: #f6fbff;
  font-size: 1.5rem;
}

.status-drawer {
  position: absolute;
  top: 92px;
  bottom: 24px;
  left: 24px;
  z-index: 12;
  width: 320px;
  display: flex;
  flex-direction: column;
  border-radius: 24px;
  padding: 16px;
  overflow: hidden;
  pointer-events: auto;
  touch-action: pan-y;
}

.status-drawer-head,
.float-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.collapse-btn {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #eaf3fb;
}

.status-drawer-head strong,
.float-card-head strong,
.status-chip strong,
.float-item strong {
  color: #f5f9fd;
}

.status-drawer-head span,
.float-card-head span,
.status-chip span,
.float-item label {
  color: #9cb3c7;
}

.status-drawer-list {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
  pointer-events: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  scrollbar-width: thin;
  scrollbar-color: rgba(143, 220, 255, 0.45) transparent;
}

.status-drawer-list::-webkit-scrollbar {
  width: 8px;
}

.status-drawer-list::-webkit-scrollbar-track {
  background: transparent;
}

.status-drawer-list::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(143, 220, 255, 0.34);
}

.status-chip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 14px 16px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  text-align: left;
  cursor: pointer;
}

.status-chip.normal { box-shadow: inset 0 0 0 1px rgba(0, 210, 255, 0.16); }
.status-chip.warning { box-shadow: inset 0 0 0 1px rgba(255, 208, 75, 0.14); }
.status-chip.danger { box-shadow: inset 0 0 0 1px rgba(255, 107, 107, 0.14); }
.status-chip.offline { box-shadow: inset 0 0 0 1px rgba(123, 135, 148, 0.14); }
.status-chip.warning { background: rgba(255, 208, 75, 0.08); }
.status-chip.danger { background: rgba(255, 107, 107, 0.1); }
.status-chip.offline { background: rgba(123, 135, 148, 0.1); }

.status-chip-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.status-badge,
.detail-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.status-badge.normal,
.detail-status.normal {
  color: #00d2ff;
  background: rgba(0, 210, 255, 0.15);
}

.status-badge.warning,
.detail-status.warning {
  color: #ffd04b;
  background: rgba(255, 208, 75, 0.14);
}

.status-badge.danger,
.detail-status.danger {
  color: #ff8c8c;
  background: rgba(255, 107, 107, 0.16);
}

.status-badge.offline,
.detail-status.offline {
  color: #b6c2cf;
  background: rgba(123, 135, 148, 0.18);
}

.satellite-float-card {
  position: absolute;
  right: 24px;
  bottom: 126px;
  z-index: 12;
  width: 340px;
  border-radius: 24px;
  padding: 16px;
  pointer-events: auto;
}

.float-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.float-item {
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
}

.float-item label,
.float-item strong {
  display: block;
}

.float-item strong {
  margin-top: 6px;
}

.cesium-placeholder {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(3, 9, 15, 0.78);
}

.placeholder-content {
  width: min(420px, calc(100% - 32px));
  padding: 28px;
  border-radius: 28px;
  text-align: center;
  background: rgba(9, 18, 30, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.placeholder-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(125, 207, 255, 0.12);
  color: #8edcff;
  font-size: 1.3rem;
  font-weight: 700;
}

.placeholder-title {
  color: #f4f8fc;
  font-size: 1.05rem;
  margin-bottom: 10px;
}

.placeholder-message {
  color: #9cb3c7;
  line-height: 1.7;
}

.fade-panel-enter-active,
.fade-panel-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.fade-panel-enter-from,
.fade-panel-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.floating-edit-btn {
  position: absolute;
  top: 80px;
  right: 24px;
  z-index: 12;
  pointer-events: auto;
  background: rgba(14, 25, 43, 0.85) !important;
  backdrop-filter: blur(16px);
  border-color: rgba(64, 158, 255, 0.4) !important;
}

.edit-drawer {
  position: absolute;
  top: 80px;
  right: 24px;
  bottom: 24px;
  z-index: 12;
  width: 320px;
  display: flex;
  flex-direction: column;
  border-radius: 24px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(7, 14, 23, 0.75);
  backdrop-filter: blur(16px);
  pointer-events: auto;
}

.edit-drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  color: #f5f9fd;
  font-size: 1.1rem;
}

.edit-drawer-list {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
  pointer-events: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(143, 220, 255, 0.45) transparent;
}

.edit-drawer-list::-webkit-scrollbar { width: 8px; }
.edit-drawer-list::-webkit-scrollbar-track { background: transparent; }
.edit-drawer-list::-webkit-scrollbar-thumb { border-radius: 999px; background: rgba(143, 220, 255, 0.34); }

.edit-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
}

.edit-item-info strong {
  display: block;
  color: #f5f9fd;
  margin-bottom: 4px;
}

@media (max-width: 960px) {
  .cinematic-overlay {
    padding: 16px;
  }

  .overlay-top,
  .overlay-bottom {
    flex-direction: column;
    align-items: flex-start;
  }

  .status-drawer,
  .satellite-float-card {
    left: 16px;
    right: 16px;
    width: auto;
  }

  .status-drawer {
    top: 120px;
    max-height: 260px;
  }

  .satellite-float-card {
    bottom: 96px;
  }
}
</style>
