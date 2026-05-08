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
            <label>閫熷害</label>
            <strong>{{ selectedOrbitMetrics.speedKps.toFixed(2) }} km/s</strong>
          </div>
          <div v-if="selectedOrbitMetrics" class="float-item">
            <label>鍛ㄦ湡</label>
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
const sceneMode = ref('自由查看')
let interactionTimeout: number | null = null
let selectionHandler: Cesium.ScreenSpaceEventHandler | null = null

const EARTH_RADIUS_METERS = 6378137
const EARTH_MU = 3.986004418e14
const EARTH_ROTATION_RAD_PER_SEC = (2 * Math.PI) / 86164.0905
const HOME_VIEW_RANGE = 14000000
const INITIAL_ORBIT_STEP = 4

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

function clearSelection() {
  satelliteStore.selectedSatelliteId = null
  isPaused.value = false
  sceneMode.value = '自由查看'
  if (viewer.value && !viewer.value.isDestroyed()) {
    viewer.value.trackedEntity = undefined
    viewer.value.clock.shouldAnimate = true
    focusFreeEarthView(viewer.value, HOME_VIEW_RANGE)
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
  for (let i = 0; i <= 360; i += INITIAL_ORBIT_STEP) {
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
      point: {
        pixelSize: isAbnormal ? (isGeo ? 12 : 9) : isGeo ? 5 : 3.5,
        color: isAbnormal ? color : Cesium.Color.WHITE,
        outlineColor: isAbnormal ? color.withAlpha(0.95) : color.withAlpha(0.6),
        outlineWidth: isAbnormal ? 2 : 1
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
        style: Cesium.LabelStyle.FILL,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        pixelOffset: new Cesium.Cartesian2(0, -10),
        fillColor: isAbnormal ? color.withAlpha(0.98) : Cesium.Color.WHITE.withAlpha(0.85),
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
        fillColor: Cesium.Color.WHITE
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

function focusFreeEarthView(v: Cesium.Viewer, range = HOME_VIEW_RANGE) {
  v.trackedEntity = undefined
  isPaused.value = false
  sceneMode.value = '自由查看'
  v.clock.shouldAnimate = true
  v.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(108, 24, range),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-88),
      roll: 0
    },
    duration: 1.4
  })
}

function tuneImageryLayer(layer: Cesium.ImageryLayer) {
  layer.brightness = 1.05
  layer.gamma = 1
  layer.saturation = 1.05
  layer.contrast = 1.02
}

async function applyWorldImageryStyle(style: Cesium.IonWorldImageryStyle) {
  return Cesium.createWorldImageryAsync({ style })
}

async function applyDefaultBingImagery(v: Cesium.Viewer) {
  const imageryStyles = [
    Cesium.IonWorldImageryStyle.AERIAL_WITH_LABELS,
    Cesium.IonWorldImageryStyle.AERIAL
  ]

  let imageryProvider: Cesium.ImageryProvider | null = null
  let lastError: unknown = null

  for (const style of imageryStyles) {
    try {
      imageryProvider = await applyWorldImageryStyle(style)
      break
    } catch (imageryError) {
      lastError = imageryError
      console.warn(`[Cesium] Failed to load world imagery style: ${style}`, imageryError)
    }
  }

  if (!imageryProvider) {
    console.warn('[Cesium] Failed to load all world imagery styles, keeping fallback globe color.', lastError)
    return
  }

  while (v.imageryLayers.length > 0) {
    v.imageryLayers.remove(v.imageryLayers.get(0), true)
  }

  const imageryLayer = v.imageryLayers.addImageryProvider(imageryProvider)
  tuneImageryLayer(imageryLayer)
}

onMounted(async () => {
  if (!cesiumContainer.value) return
  try {
      const v = await initCesium(cesiumContainer.value as HTMLElement)
      const canvasElement = v.canvas

      const initialDataLoad = Promise.all([
        instanceStore.fetchInstances(),
        instanceStore.fetchAllResources(),
        linkStore.fetchLinks(),
        linkStore.fetchAllResources(),
        satelliteStore.fetchPositions()
      ])

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

      applyDefaultBingImagery(v)
      focusFreeEarthView(v)
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
        if (v.trackedEntity) {
          v.trackedEntity = undefined
        }
      })

      await initialDataLoad
      buildScene(v)

      watch(
        () => [
          satelliteStore.satellites.map((sat) => `${sat.id}:${sat.alt}:${sat.inclination}:${sat.baseLon}:${sat.phase}:${sat.status}`).join('|'),
          JSON.stringify(satelliteStore.positions),
          instanceStore.instancesForDisplay.map((item) => `${item.id}:${item.name}:${item.type}:${item.status}`).join('|'),
          linkStore.linksForDisplay.map((link) => `${link.id}:${link.status}:${link.enabled}:${link.endpoints.join('>')}`).join('|')
        ],
        () => buildScene(v)
      )

      v.camera.moveEnd.addEventListener(() => {
        if (interactionTimeout) clearTimeout(interactionTimeout)
        interactionTimeout = window.setTimeout(() => {
          if (!v.trackedEntity && !isPaused.value) {
            sceneMode.value = '自由查看'
          }
        }, 400)
      })
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
