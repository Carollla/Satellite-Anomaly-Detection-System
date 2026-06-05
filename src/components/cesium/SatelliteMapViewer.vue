<template>
  <div id="satmap-container" ref="containerRef">
    <div
      ref="cesiumContainer"
      class="cesium-imagery-layer"
      :class="{ active: true }"
    ></div>
    <iframe
      ref="iframeRef"
      :key="iframeSrc"
      class="satmap-iframe"
      :class="{ ready: false }"
      :src="iframeSrc"
      frameborder="0"
      allowfullscreen
      @load="onIframeLoad"
    />

    <div class="ground-overlay" aria-label="地面站">
      <div
        v-for="station in groundStationMarkers"
        :key="station.id"
        class="ground-marker"
        :class="[station.kind, { visible: station.visible }]"
        :style="{ left: `${station.x}px`, top: `${station.y}px` }"
      >
        <span class="ground-dot" />
        <b>{{ station.name }}</b>
      </div>
    </div>

    <div class="action-btns">
      <el-button class="earth-style-btn" plain @click="toggleEarthStyle">
        地球风格：{{ currentEarthStyle.label }}
      </el-button>
      <el-button
        :type="showAllStatus ? 'primary' : 'default'"
        plain
        @click="showAllStatus = !showAllStatus"
      >
        查看卫星状态
      </el-button>
      <el-button
        :type="isEditMode ? 'primary' : 'default'"
        plain
        @click="toggleEditDialog"
      >
        编辑卫星
      </el-button>
    </div>

    <el-dialog v-model="showAllStatus" title="卫星状态" width="420px" append-to-body>
      <div class="status-dialog-list">
        <button
          v-for="sat in satelliteStore.satellites"
          :key="sat.id"
          class="status-chip"
          :class="sat.status"
          @click="focusSatellite(sat)"
        >
          <div class="status-chip-main">
            <strong>{{ sat.name }}</strong>
            <span>{{ sat.instanceId }}</span>
          </div>
          <div class="status-chip-meta">
            <span class="status-badge" :class="sat.status">{{ getStatusLabel(sat.status) }}</span>
            <span>{{ sat.cpu.toFixed(1) }}%</span>
          </div>
        </button>
      </div>
    </el-dialog>

    

    <el-dialog
      v-model="showEditDialog"
      :title="editForm.id ? '编辑卫星' : '添加卫星'"
      width="760px"
      append-to-body
    >
      <div class="edit-dialog">
        <div class="edit-dialog-list">
          <div class="edit-dialog-actions">
            <el-button type="primary" size="small" @click="openAddDialog">
              + 添加自定义卫星
            </el-button>
          </div>

          <button
            v-for="sat in satelliteStore.satellites"
            :key="sat.id"
            class="edit-list-item"
            :class="{ active: editForm.id === sat.id }"
            @click="openEditDialog(sat)"
          >
            <div class="edit-item-info">
              <strong>{{ sat.name }}</strong>
              <span>{{ sat.instanceId }}</span>
            </div>
            <span class="status-badge" :class="sat.status">{{ getStatusLabel(sat.status) }}</span>
          </button>
        </div>

        <div class="edit-dialog-form">
          <el-form :model="editForm" label-width="80px">
            <el-form-item label="名称">
              <el-input v-model="editForm.name" />
            </el-form-item>
            <el-form-item label="高度(m)">
              <el-input-number v-model="editForm.alt" :step="1000" style="width: 100%" />
            </el-form-item>
            <el-form-item label="倾角(°)">
              <el-input-number v-model="editForm.inclination" :step="1" style="width: 100%" />
            </el-form-item>
            <el-form-item label="基准经度">
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
        </div>
      </div>

      <template #footer>
        <el-button v-if="editForm.id" type="danger" plain @click="deleteSat(editForm.id)">
          删除
        </el-button>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">确定</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { useSatelliteStore } from '../../stores/satellite'

const props = withDefaults(
  defineProps<{
    showAllStatus?: boolean
  }>(),
  {
    showAllStatus: false
  }
)

const satelliteStore = useSatelliteStore()
const containerRef = ref<HTMLElement | null>(null)
const cesiumContainer = ref<HTMLElement | null>(null)
const iframeRef = ref<HTMLIFrameElement | null>(null)
const iframeReady = ref(false)
const iframeSrc = './satellitemap/index.html?embed=c4&v=32'
const showAllStatus = ref(props.showAllStatus)
const isEditMode = ref(false)
const showEditDialog = ref(false)
const iframeSetupRuns = ref(0)
const targetEyeDistance = 3.65
const earthStyle = ref<'real' | 'classic'>('classic')
let bordersKeepAliveTimer: ReturnType<typeof setInterval> | null = null
let lastVisualSignature = ''
let cesiumViewer: Cesium.Viewer | null = null
let cesiumStartTime: Cesium.JulianDate | null = null
let cesiumClickHandler: Cesium.ScreenSpaceEventHandler | null = null
let removeGroundMarkerRenderHook: (() => void) | null = null
let realEarthLayer: Cesium.ImageryLayer | null = null
let classicEarthLayer: Cesium.ImageryLayer | null = null
let classicSunEntity: Cesium.Entity | null = null
let satelliteSpriteImage = ''
const cesiumSatelliteEntities = new Map<number, Cesium.Entity>()
const cesiumOrbitEntities = new Map<number, Cesium.Entity>()
const cesiumLinkEntities = new Map<string, Cesium.Entity>()
const cesiumGroundCableEntities = new Map<string, Cesium.Entity>()
const cesiumGroundLinkEntities = new Map<string, Cesium.Entity>()
const EARTH_RADIUS_METERS = 6378137
const EARTH_MU = 3.986004418e14
const EARTH_ROTATION_RAD_PER_SEC = (2 * Math.PI) / 86164.0905
const NORMAL_SATELLITE_COLOR = '#bff3ff'
const SATELLITE_SCALE_BY_DISTANCE = new Cesium.NearFarScalar(7000000, 1.9, 90000000, 0.82)
const GROUND_STATIONS = [
  { id: 'mcs', name: 'MCS 主控站', lat: 35, lon: 105, kind: 'control' },
  { id: 'bnd-n', name: '北向边界站', lat: 53, lon: 126, kind: 'boundary' },
  { id: 'bnd-s', name: '南向边界站', lat: 18, lon: 110, kind: 'boundary' },
  { id: 'bnd-w', name: '西向边界站', lat: 40, lon: 73, kind: 'boundary' },
  { id: 'bnd-e', name: '东向边界站', lat: 48, lon: 134, kind: 'boundary' }
] as const
const groundStationMarkers = ref(
  GROUND_STATIONS.map((station) => ({
    ...station,
    x: -9999,
    y: -9999,
    visible: false
  }))
)
const CLASSIC_OCEAN = [4, 19, 31]
const CLASSIC_LAND = [19, 37, 66]
const CLASSIC_COAST = [41, 105, 132]
const CLASSIC_GRID = [26, 72, 96]
const earthStyles = {
  real: {
    label: '影像',
    background: '#020713',
    texstyle: 0,
    borders: 0,
    clouds: 1,
    skybox: 2,
    dotlighting: 1,
    sun: 1
  },
  classic: {
    label: '经典',
    background: '#01040c',
    texstyle: 1,
    borders: 1,
    clouds: 0,
    skybox: 1,
    dotlighting: 1,
    sun: 1
  }
}
const currentEarthStyle = computed(() => earthStyles[earthStyle.value])
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

function focusSatellite(sat: any) {
  satelliteStore.selectedSatelliteId = sat.id
  showAllStatus.value = true
  sendToIframe({ type: 'focus-satellite', norad_id: sat.id })
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
  isEditMode.value = true
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
  isEditMode.value = true
}

function toggleEditDialog() {
  if (showEditDialog.value) {
    showEditDialog.value = false
    isEditMode.value = false
    return
  }
  openAddDialog()
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
  } else {
    satelliteStore.addSatellite(payload)
  }

  showEditDialog.value = false
  isEditMode.value = false
}

function deleteSat(id: number) {
  satelliteStore.deleteSatellite(id)
  if (editForm.value.id === id) {
    resetEditForm()
  }
}

function statusColor(status: string) {
  if (status === 'warning') return Cesium.Color.fromCssColorString('#ffd04b')
  if (status === 'danger') return Cesium.Color.fromCssColorString('#ff6b6b')
  if (status === 'offline') return Cesium.Color.fromCssColorString('#7b8794')
  return Cesium.Color.fromCssColorString(NORMAL_SATELLITE_COLOR).withAlpha(0.96)
}

function getSatelliteLayer(altitudeMeters: number) {
  if (altitudeMeters >= 30000000) return 'GEO'
  if (altitudeMeters >= 20000000) return 'MEO'
  return 'LEO'
}

function orbitEntityId(sat: any) {
  return Number(sat.id)
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
    periodSeconds
  }
}

function getVisualAltitude(sat: any) {
  const altitude = Math.max(Number(sat.alt || 500000), 0)
  if (altitude >= 30000000) return altitude
  if (altitude >= 20000000) return altitude + 280000
  return altitude + 900000
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

  return Cesium.Cartesian3.fromRadians(longitude, latitude, getVisualAltitude(sat))
}

function makeOrbitPositions(inclination: number, baseLon: number, altitude: number) {
  const points: Cesium.Cartesian3[] = []
  const visualAltitude = altitude >= 30000000 ? altitude : altitude >= 20000000 ? altitude + 280000 : altitude + 900000
  const orbit = getOrbitMetrics(visualAltitude || 500000)
  const inclRad = Cesium.Math.toRadians(inclination || 0)
  const raan = Cesium.Math.toRadians(baseLon || 0)
  const cosRaan = Math.cos(raan)
  const sinRaan = Math.sin(raan)
  const cosInclination = Math.cos(inclRad)
  const sinInclination = Math.sin(inclRad)

  for (let i = 0; i <= 360; i += 6) {
    const trueAnomaly = Cesium.Math.toRadians(i)
    const xOrbital = orbit.orbitalRadius * Math.cos(trueAnomaly)
    const yOrbital = orbit.orbitalRadius * Math.sin(trueAnomaly)
    const xEcef = cosRaan * xOrbital - sinRaan * cosInclination * yOrbital
    const yEcef = sinRaan * xOrbital + cosRaan * cosInclination * yOrbital
    const zEcef = sinInclination * yOrbital
    const longitude = Math.atan2(yEcef, xEcef)
    const latitude = Math.atan2(zEcef, Math.sqrt(xEcef ** 2 + yEcef ** 2))

    points.push(Cesium.Cartesian3.fromRadians(longitude, latitude, visualAltitude))
  }

  return points
}

function satelliteSpriteSize(sat: any, selected = false) {
  const layer = getSatelliteLayer(sat.alt || 0)
  const isAbnormal = sat.status === 'warning' || sat.status === 'danger' || sat.status === 'offline'
  if (selected) return layer === 'GEO' ? 64 : 56
  if (isAbnormal) return layer === 'GEO' ? 54 : 48
  if (layer === 'GEO') return 48
  if (layer === 'MEO') return 44
  return 38
}

function satelliteSpriteColor(sat: any, selected = false) {
  if (selected) return Cesium.Color.fromCssColorString('#eefbff').withAlpha(0.8)
  if (sat.status === 'warning') return Cesium.Color.fromCssColorString('#ffd36f').withAlpha(0.72)
  if (sat.status === 'danger') return Cesium.Color.fromCssColorString('#ff8f8f').withAlpha(0.72)
  if (sat.status === 'offline') return Cesium.Color.fromCssColorString('#8a97a3').withAlpha(0.52)
  const layer = getSatelliteLayer(sat.alt || 0)
  if (layer === 'GEO') return Cesium.Color.fromCssColorString('#f2dda0').withAlpha(0.66)
  if (layer === 'MEO') return Cesium.Color.fromCssColorString('#86d2ef').withAlpha(0.7)
  return Cesium.Color.fromCssColorString('#aee8f4').withAlpha(0.68)
}

function getLinkShellKey(sat: any) {
  const layer = getSatelliteLayer(sat.alt || 0)
  const altitudeBucket = Math.round((sat.alt || 0) / 50000) * 50000
  const inclinationBucket = Math.round((sat.inclination || 0) * 10) / 10
  return `${layer}|${altitudeBucket}|${inclinationBucket}`
}

function getLinkPlaneKey(sat: any) {
  const shellKey = getLinkShellKey(sat)
  const normalizedLon = ((sat.baseLon || 0) % 360 + 360) % 360
  const baseBucket = Math.round(normalizedLon / 5) * 5
  return `${shellKey}|${baseBucket}`
}

function getLinkPairKey(a: any, b: any) {
  return Number(a.id) < Number(b.id) ? `link-${a.id}-${b.id}` : `link-${b.id}-${a.id}`
}

function buildLinkArcPositions(
  fromSat: any,
  toSat: any,
  time: Cesium.JulianDate,
  startTime: Cesium.JulianDate
) {
  const start = getSatellitePosition(fromSat, time, startTime)
  const end = getSatellitePosition(toSat, time, startTime)
  const midpointVector = Cesium.Cartesian3.add(start, end, new Cesium.Cartesian3())
  if (Cesium.Cartesian3.magnitude(midpointVector) < 1) {
    return [start, end]
  }

  const direction = Cesium.Cartesian3.normalize(midpointVector, new Cesium.Cartesian3())
  const shellRadius = Math.max(
    EARTH_RADIUS_METERS + Math.max(fromSat.alt || 0, toSat.alt || 0) + 850000,
    EARTH_RADIUS_METERS + 1400000
  )
  const midpoint = Cesium.Cartesian3.multiplyByScalar(direction, shellRadius, new Cesium.Cartesian3())
  return [start, midpoint, end]
}

function getGroundStationPosition(station: typeof GROUND_STATIONS[number], height = 130000) {
  return Cesium.Cartesian3.fromDegrees(station.lon, station.lat, height)
}

function buildGroundLinkArcPositions(
  station: typeof GROUND_STATIONS[number],
  sat: any,
  time: Cesium.JulianDate,
  startTime: Cesium.JulianDate
) {
  const start = getGroundStationPosition(station, 170000)
  const end = getSatellitePosition(sat, time, startTime)
  const midpointVector = Cesium.Cartesian3.add(start, end, new Cesium.Cartesian3())
  if (Cesium.Cartesian3.magnitude(midpointVector) < 1) return [start, end]
  const direction = Cesium.Cartesian3.normalize(midpointVector, new Cesium.Cartesian3())
  const shellRadius = Math.max(EARTH_RADIUS_METERS + Number(sat.alt || 0) * 0.58, EARTH_RADIUS_METERS + 1650000)
  const midpoint = Cesium.Cartesian3.multiplyByScalar(direction, shellRadius, new Cesium.Cartesian3())
  return [start, midpoint, end]
}

function updateGroundStationMarkers() {
  const v = cesiumViewer
  if (!v || v.isDestroyed()) return

  const canvas = v.scene.canvas
  const cameraPosition = v.camera.positionWC
  groundStationMarkers.value = GROUND_STATIONS.map((station) => {
    const world = getGroundStationPosition(station, 180000)
    const surface = getGroundStationPosition(station, 0)
    const screen = Cesium.SceneTransforms.worldToWindowCoordinates(v.scene, world)
    const normal = Cesium.Cartesian3.normalize(surface, new Cesium.Cartesian3())
    const toCamera = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.subtract(cameraPosition, surface, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    )
    const frontFacing = Cesium.Cartesian3.dot(normal, toCamera) > 0.02
    const visible =
      Boolean(screen) &&
      frontFacing &&
      screen!.x >= -80 &&
      screen!.x <= canvas.clientWidth + 80 &&
      screen!.y >= -80 &&
      screen!.y <= canvas.clientHeight + 80

    return {
      ...station,
      x: screen ? screen.x : -9999,
      y: screen ? screen.y : -9999,
      visible
    }
  })
}

function buildGroundNetwork(v: Cesium.Viewer) {
  if (!cesiumStartTime) return

  const activeCables = new Set<string>()
  const activeGroundLinks = new Set<string>()

  const controlStation = GROUND_STATIONS[0]
  GROUND_STATIONS.slice(1).forEach((station) => {
    const id = `ground-cable-${controlStation.id}-${station.id}`
    activeCables.add(id)
    let entity = cesiumGroundCableEntities.get(id)
    const positions = Cesium.Cartesian3.fromDegreesArrayHeights([
      controlStation.lon, controlStation.lat, 90000,
      station.lon, station.lat, 90000
    ])
    if (!entity) {
      entity = v.entities.add({
        id,
        name: `${station.name} 到 ${controlStation.name}`,
        polyline: {
          positions,
          width: 2,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.08,
            color: Cesium.Color.fromCssColorString('#ffd84d').withAlpha(0.42)
          }),
          arcType: Cesium.ArcType.GEODESIC,
          clampToGround: false
        }
      })
      cesiumGroundCableEntities.set(id, entity)
    } else if (entity.polyline) {
      entity.polyline.positions = new Cesium.ConstantProperty(positions)
    }
  })

  const now = v.clock.currentTime
  GROUND_STATIONS.forEach((station) => {
    const stationPosition = getGroundStationPosition(station)
    const candidates = satelliteStore.satellites
      .map((sat) => ({
        sat,
        layer: getSatelliteLayer(sat.alt || 0),
        distance: Cesium.Cartesian3.distance(
          stationPosition,
          getSatellitePosition(sat, now, cesiumStartTime as Cesium.JulianDate)
        )
      }))
      .sort((a, b) => a.distance - b.distance)

    const picked: any[] = []
    ;['LEO', 'MEO', 'GEO'].forEach((layer) => {
      const match = candidates.find((item) => item.layer === layer && !picked.some((sat) => sat.id === item.sat.id))
      if (match) picked.push(match.sat)
    })
    candidates.slice(0, station.kind === 'control' ? 3 : 2).forEach((item) => {
      if (!picked.some((sat) => sat.id === item.sat.id)) picked.push(item.sat)
    })

    picked.slice(0, station.kind === 'control' ? 4 : 3).forEach((sat) => {
      const id = `ground-link-${station.id}-${sat.id}`
      activeGroundLinks.add(id)
      const selected = satelliteStore.selectedSatelliteId === sat.id
      const abnormal = sat.status !== 'normal'
      const color = selected
        ? Cesium.Color.WHITE
        : abnormal
          ? Cesium.Color.fromCssColorString('#ffb45c')
          : Cesium.Color.fromCssColorString(station.kind === 'control' ? '#44ffaa' : '#2df6a3')
      const positions = new Cesium.CallbackProperty((time) => {
        return buildGroundLinkArcPositions(
          station,
          sat,
          time || v.clock.currentTime,
          cesiumStartTime as Cesium.JulianDate
        )
      }, false)

      let entity = cesiumGroundLinkEntities.get(id)
      if (!entity) {
        entity = v.entities.add({
          id,
          name: `${station.name} - ${sat.name}`,
          polyline: {
            positions,
            width: selected ? 2.8 : abnormal ? 2.1 : 1.75,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: selected ? 0.16 : 0.08,
              color: color.withAlpha(selected ? 0.74 : abnormal ? 0.5 : 0.38)
            }),
            arcType: Cesium.ArcType.NONE
          }
        })
        cesiumGroundLinkEntities.set(id, entity)
      } else if (entity.polyline) {
        entity.polyline.positions = positions
        entity.polyline.width = new Cesium.ConstantProperty(selected ? 2.8 : abnormal ? 2.1 : 1.75)
        entity.polyline.material = new Cesium.PolylineGlowMaterialProperty({
          glowPower: selected ? 0.16 : 0.08,
          color: color.withAlpha(selected ? 0.74 : abnormal ? 0.5 : 0.38)
        })
      }
    })
  })

  cesiumGroundCableEntities.forEach((entity, id) => {
    if (!activeCables.has(id)) {
      v.entities.remove(entity)
      cesiumGroundCableEntities.delete(id)
    }
  })
  cesiumGroundLinkEntities.forEach((entity, id) => {
    if (!activeGroundLinks.has(id)) {
      v.entities.remove(entity)
      cesiumGroundLinkEntities.delete(id)
    }
  })
}

function buildCommunicationLinks(v: Cesium.Viewer) {
  const activeLinkIds = new Set<string>()
  if (!cesiumStartTime) return activeLinkIds

  const shellGroups = new Map<string, any[]>()
  satelliteStore.satellites.forEach((sat) => {
    const key = getLinkShellKey(sat)
    const list = shellGroups.get(key) || []
    list.push(sat)
    shellGroups.set(key, list)
  })

  const upsertLink = (fromSat: any, toSat: any) => {
    if (!fromSat || !toSat || fromSat.id === toSat.id) return
    const linkKey = getLinkPairKey(fromSat, toSat)
    activeLinkIds.add(linkKey)

    const isSelected =
      satelliteStore.selectedSatelliteId === fromSat.id || satelliteStore.selectedSatelliteId === toSat.id
    const isAbnormal =
      fromSat.status !== 'normal' || toSat.status !== 'normal' || fromSat.status === 'offline' || toSat.status === 'offline'
    const layer = getSatelliteLayer(Math.max(fromSat.alt || 0, toSat.alt || 0))
    const linkColor =
      isSelected
        ? Cesium.Color.fromCssColorString('#ffffff')
        : isAbnormal
          ? Cesium.Color.fromCssColorString('#ffb6b6')
          : layer === 'GEO'
            ? Cesium.Color.fromCssColorString('#ffb45c')
            : layer === 'MEO'
              ? Cesium.Color.fromCssColorString('#7cd0ff')
              : Cesium.Color.fromCssColorString('#4ce9ff')
    const positions = new Cesium.CallbackProperty((time) => {
      return buildLinkArcPositions(
        fromSat,
        toSat,
        time || v.clock.currentTime,
        cesiumStartTime as Cesium.JulianDate
      )
    }, false)

    let entity = cesiumLinkEntities.get(linkKey)
    if (!entity) {
      entity = v.entities.add({
        id: linkKey,
        polyline: {
          positions,
          width: isSelected ? 2.2 : isAbnormal ? 1.55 : 1.15,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: isSelected ? 0.13 : isAbnormal ? 0.08 : 0.045,
            color: linkColor.withAlpha(isSelected ? 0.58 : isAbnormal ? 0.36 : 0.18)
          }),
          arcType: Cesium.ArcType.NONE
        }
      })
      cesiumLinkEntities.set(linkKey, entity)
    } else if (entity.polyline) {
      entity.polyline.positions = positions
      entity.polyline.width = new Cesium.ConstantProperty(isSelected ? 2.2 : isAbnormal ? 1.55 : 1.15)
      entity.polyline.material = new Cesium.PolylineGlowMaterialProperty({
        glowPower: isSelected ? 0.13 : isAbnormal ? 0.08 : 0.045,
        color: linkColor.withAlpha(isSelected ? 0.58 : isAbnormal ? 0.36 : 0.18)
      })
      entity.polyline.depthFailMaterial = new Cesium.ColorMaterialProperty(Cesium.Color.TRANSPARENT)
    }
  }

  shellGroups.forEach((shellSats) => {
    const planeGroups = new Map<string, any[]>()
    shellSats.forEach((sat) => {
      const key = getLinkPlaneKey(sat)
      const list = planeGroups.get(key) || []
      list.push(sat)
      planeGroups.set(key, list)
    })

    const planes = [...planeGroups.entries()].sort((a, b) => {
      const aKey = Number(a[0].split('|').pop() || 0)
      const bKey = Number(b[0].split('|').pop() || 0)
      return aKey - bKey
    })

    planes.forEach(([, planeSats]) => {
      planeSats.sort((a, b) => ((a.phase || 0) - (b.phase || 0)) || Number(a.id) - Number(b.id))
      if (planeSats.length < 2) return
      for (let i = 0; i < planeSats.length; i++) {
        upsertLink(planeSats[i], planeSats[(i + 1) % planeSats.length])
      }
    })

    if (planes.length > 1) {
      for (let i = 0; i < planes.length; i++) {
        const left = planes[i][1]
        const right = planes[(i + 1) % planes.length][1]
        if (!left.length || !right.length) continue
        const leftSat = left[Math.min(Math.floor(left.length / 2), left.length - 1)]
        const rightSat = right[Math.min(Math.floor(right.length / 2), right.length - 1)]
        upsertLink(leftSat, rightSat)
      }
    }
  })

  cesiumLinkEntities.forEach((entity, id) => {
    if (!activeLinkIds.has(id)) {
      v.entities.remove(entity)
      cesiumLinkEntities.delete(id)
    }
  })

  return activeLinkIds
}

function buildCesiumSatellites() {
  const v = cesiumViewer
  if (!v || v.isDestroyed() || !cesiumStartTime) return
  const activeIds = new Set<number>()
  const activeOrbitIds = new Set<number>()

  if (!satelliteSpriteImage) {
    satelliteSpriteImage = createSatelliteSprite()
  }

  satelliteStore.satellites.forEach((sat) => {
    const color = satelliteSpriteColor(sat, satelliteStore.selectedSatelliteId === sat.id)
    const orbitColor = statusColor(sat.status)
    const isAbnormal = sat.status === 'warning' || sat.status === 'danger' || sat.status === 'offline'
    const selected = satelliteStore.selectedSatelliteId === sat.id
    const satId = Number(sat.id)
    const orbitId = orbitEntityId(sat)
    const spriteSize = satelliteSpriteSize(sat, selected)
    activeIds.add(satId)

    let entity = cesiumSatelliteEntities.get(satId)
    if (!entity) {
      entity = v.entities.add({
        id: String(satId),
        name: sat.name,
        position: new Cesium.CallbackPositionProperty((time) => {
          return getSatellitePosition(sat, time || v.clock.currentTime, cesiumStartTime as Cesium.JulianDate)
        }, false),
        billboard: {
          image: satelliteSpriteImage,
          width: spriteSize,
          height: Math.round(spriteSize * 0.56),
          color,
          scaleByDistance: SATELLITE_SCALE_BY_DISTANCE,
          disableDepthTestDistance: 0,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          verticalOrigin: Cesium.VerticalOrigin.CENTER
        },
        label: {
          text: sat.name,
          font: '600 11px "Microsoft YaHei", sans-serif',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: Cesium.Color.WHITE.withAlpha(0.94),
          outlineColor: Cesium.Color.fromCssColorString('#020713').withAlpha(0.75),
          outlineWidth: 2,
          pixelOffset: new Cesium.Cartesian2(0, -Math.round(spriteSize * 0.9)),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          disableDepthTestDistance: 0,
          show: selected || isAbnormal
        }
      })
      cesiumSatelliteEntities.set(satId, entity)
    } else {
      entity.name = sat.name
      entity.position = new Cesium.CallbackPositionProperty((time) => {
        return getSatellitePosition(sat, time || v.clock.currentTime, cesiumStartTime as Cesium.JulianDate)
      }, false)
      if (entity.billboard) {
        entity.billboard.image = new Cesium.ConstantProperty(satelliteSpriteImage)
        entity.billboard.width = new Cesium.ConstantProperty(spriteSize)
        entity.billboard.height = new Cesium.ConstantProperty(Math.round(spriteSize * 0.56))
        entity.billboard.color = new Cesium.ConstantProperty(color)
        entity.billboard.scaleByDistance = new Cesium.ConstantProperty(SATELLITE_SCALE_BY_DISTANCE)
        entity.billboard.disableDepthTestDistance = new Cesium.ConstantProperty(0)
      }
      if (entity.label) {
        entity.label.text = new Cesium.ConstantProperty(sat.name)
        entity.label.fillColor = new Cesium.ConstantProperty(Cesium.Color.WHITE.withAlpha(0.94))
        entity.label.outlineColor = new Cesium.ConstantProperty(Cesium.Color.fromCssColorString('#020713').withAlpha(0.75))
        entity.label.pixelOffset = new Cesium.ConstantProperty(new Cesium.Cartesian2(0, -Math.round(spriteSize * 0.9)))
        entity.label.disableDepthTestDistance = new Cesium.ConstantProperty(0)
        entity.label.show = new Cesium.ConstantProperty(selected || isAbnormal)
      }
    }

    if (selected || isAbnormal) {
      activeOrbitIds.add(orbitId)
      let orbit = cesiumOrbitEntities.get(orbitId)
      const positions = makeOrbitPositions(sat.inclination || 0, sat.baseLon || 0, sat.alt || 500000)
      if (!orbit) {
        orbit = v.entities.add({
          id: `orbit-${satId}`,
          polyline: {
            positions,
            width: selected ? 1.4 : 0.9,
            material: orbitColor.withAlpha(selected ? 0.34 : 0.18)
          }
        })
        cesiumOrbitEntities.set(orbitId, orbit)
      } else if (orbit.polyline) {
        orbit.polyline.positions = new Cesium.ConstantProperty(positions)
        orbit.polyline.width = new Cesium.ConstantProperty(selected ? 1.4 : 0.9)
        orbit.polyline.material = new Cesium.ColorMaterialProperty(orbitColor.withAlpha(selected ? 0.34 : 0.18))
      }
    }
  })

  buildCommunicationLinks(v)
  buildGroundNetwork(v)

  cesiumSatelliteEntities.forEach((entity, id) => {
    if (!activeIds.has(id)) {
      v.entities.remove(entity)
      cesiumSatelliteEntities.delete(id)
    }
  })
  cesiumOrbitEntities.forEach((entity, id) => {
    if (!activeOrbitIds.has(id)) {
      v.entities.remove(entity)
      cesiumOrbitEntities.delete(id)
    }
  })
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    image.src = src
  })
}

function clampColor(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const x = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)))
  return x * x * (3 - 2 * x)
}

async function createClassicEarthTextureUrl() {
  const [mask, marble] = await Promise.all([
    loadImage('/satellitemap/images/globe-mask.png'),
    loadImage('/satellitemap/images/bluemarble-4k.webp')
  ])
  const canvas = document.createElement('canvas')
  canvas.width = mask.naturalWidth || mask.width
  canvas.height = mask.naturalHeight || mask.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return '/satellitemap/images/bluemarble-4k.webp'

  ctx.drawImage(mask, 0, 0, canvas.width, canvas.height)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  const alpha = new Uint8Array(canvas.width * canvas.height)
  const detailCanvas = document.createElement('canvas')
  detailCanvas.width = canvas.width
  detailCanvas.height = canvas.height
  const detailCtx = detailCanvas.getContext('2d')
  let detailData: Uint8ClampedArray | null = null
  if (detailCtx) {
    detailCtx.drawImage(marble, 0, 0, canvas.width, canvas.height)
    detailData = detailCtx.getImageData(0, 0, canvas.width, canvas.height).data
  }

  for (let i = 0; i < data.length; i += 4) {
    const idx = i / 4
    const maskValue = data[i]
    const t = maskValue / 255
    alpha[idx] = data[i]
    const latRow = Math.floor(idx / canvas.width)
    const lonCol = idx % canvas.width
    const grain = ((lonCol * 17 + latRow * 31) % 19) / 255
    const landMix = smoothstep(0.25, 0.62, t)
    const detailLum = detailData
      ? (detailData[i] * 0.299 + detailData[i + 1] * 0.587 + detailData[i + 2] * 0.114) / 255
      : 0.5
    const detailShade = 0.74 + detailLum * 0.42 + grain
    const ridge = detailData && landMix > 0.35
      ? Math.max(0, (detailLum - 0.44) * 0.28)
      : 0
    data[i] = clampColor((CLASSIC_OCEAN[0] + (CLASSIC_LAND[0] - CLASSIC_OCEAN[0]) * landMix) * detailShade + ridge * 255)
    data[i + 1] = clampColor((CLASSIC_OCEAN[1] + (CLASSIC_LAND[1] - CLASSIC_OCEAN[1]) * landMix) * detailShade + ridge * 180)
    data[i + 2] = clampColor((CLASSIC_OCEAN[2] + (CLASSIC_LAND[2] - CLASSIC_OCEAN[2]) * landMix) * detailShade + ridge * 120)
    data[i + 3] = 255
  }

  for (let y = 1; y < canvas.height - 1; y++) {
    for (let x = 1; x < canvas.width - 1; x++) {
      const idx = y * canvas.width + x
      const v = alpha[idx]
      const edge =
        Math.abs(v - alpha[idx - 1]) +
        Math.abs(v - alpha[idx + 1]) +
        Math.abs(v - alpha[idx - canvas.width]) +
        Math.abs(v - alpha[idx + canvas.width])
      const offset = idx * 4
      if (edge > 42) {
        data[offset] = CLASSIC_COAST[0]
        data[offset + 1] = CLASSIC_COAST[1]
        data[offset + 2] = CLASSIC_COAST[2]
      }
    }
  }

  const drawGrid = (step: number, alphaValue: number) => {
    for (let x = 0; x < canvas.width; x += step) {
      for (let y = 0; y < canvas.height; y++) {
        const offset = (y * canvas.width + x) * 4
        data[offset] = Math.round(data[offset] * (1 - alphaValue) + CLASSIC_GRID[0] * alphaValue)
        data[offset + 1] = Math.round(data[offset + 1] * (1 - alphaValue) + CLASSIC_GRID[1] * alphaValue)
        data[offset + 2] = Math.round(data[offset + 2] * (1 - alphaValue) + CLASSIC_GRID[2] * alphaValue)
      }
    }
    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < canvas.width; x++) {
        const offset = (y * canvas.width + x) * 4
        data[offset] = Math.round(data[offset] * (1 - alphaValue) + CLASSIC_GRID[0] * alphaValue)
        data[offset + 1] = Math.round(data[offset + 1] * (1 - alphaValue) + CLASSIC_GRID[1] * alphaValue)
        data[offset + 2] = Math.round(data[offset + 2] * (1 - alphaValue) + CLASSIC_GRID[2] * alphaValue)
      }
    }
  }
  drawGrid(Math.max(24, Math.round(canvas.width / 24)), 0.28)
  drawGrid(Math.max(48, Math.round(canvas.width / 12)), 0.18)

  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

function createClassicSunImage() {
  const canvas = document.createElement('canvas')
  canvas.width = 192
  canvas.height = 192
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const gradient = ctx.createRadialGradient(96, 96, 5, 96, 96, 92)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.18, 'rgba(255,238,170,0.96)')
  gradient.addColorStop(0.42, 'rgba(255,180,82,0.42)')
  gradient.addColorStop(1, 'rgba(255,150,42,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = 'rgba(255,230,160,0.36)'
  ctx.lineWidth = 1
  for (let i = 0; i < 12; i++) {
    const angle = (Math.PI * 2 * i) / 12
    ctx.beginPath()
    ctx.moveTo(96 + Math.cos(angle) * 28, 96 + Math.sin(angle) * 28)
    ctx.lineTo(96 + Math.cos(angle) * 88, 96 + Math.sin(angle) * 88)
    ctx.stroke()
  }
  return canvas.toDataURL('image/png')
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
  halo.addColorStop(0, 'rgba(70, 220, 255, 0.24)')
  halo.addColorStop(0.35, 'rgba(48, 120, 255, 0.08)')
  halo.addColorStop(0.68, 'rgba(124, 92, 255, 0.045)')
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

  ctx.strokeStyle = 'rgba(92, 235, 255, 0.32)'
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
  bodyGlow.addColorStop(0, 'rgba(100, 232, 255, 0.46)')
  bodyGlow.addColorStop(0.34, 'rgba(84, 170, 255, 0.14)')
  bodyGlow.addColorStop(1, 'rgba(84, 170, 255, 0)')
  ctx.fillStyle = bodyGlow
  ctx.beginPath()
  ctx.roundRect(139, 58, 42, 76, 12)
  ctx.fill()

  ctx.fillStyle = 'rgba(220, 248, 255, 0.72)'
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
  ctx.fillStyle = 'rgba(150, 236, 255, 0.6)'
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
  engineGlow.addColorStop(0, 'rgba(72, 226, 255, 0.48)')
  engineGlow.addColorStop(0.45, 'rgba(58, 130, 255, 0.16)')
  engineGlow.addColorStop(1, 'rgba(58, 130, 255, 0)')
  ctx.fillStyle = engineGlow
  ctx.fillRect(126, 126, 68, 48)

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(145, 67)
  ctx.lineTo(175, 67)
  ctx.moveTo(142, 116)
  ctx.lineTo(178, 116)
  ctx.stroke()

  return canvas.toDataURL('image/png')
}

async function createClassicSkyboxSources() {
  const starMap = await loadImage('/satellitemap/images/starmap-4k.jpg')
  const size = Math.min(starMap.naturalWidth || starMap.width, starMap.naturalHeight || starMap.height)
  const width = starMap.naturalWidth || starMap.width
  const height = starMap.naturalHeight || starMap.height
  const crops = [
    [0.00, 0.00],
    [0.25, 0.00],
    [0.50, 0.00],
    [0.75, 0.00],
    [0.12, 0.00],
    [0.62, 0.00]
  ]

  const makeFace = ([xRatio, yRatio]: number[]) => {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return '/satellitemap/images/starmap-4k.jpg'
    const sx = Math.min(Math.max(0, Math.round((width - size) * xRatio)), width - size)
    const sy = Math.min(Math.max(0, Math.round((height - size) * yRatio)), height - size)
    ctx.drawImage(starMap, sx, sy, size, size, 0, 0, size, size)
    return canvas.toDataURL('image/jpeg', 0.9)
  }

  const faces = crops.map(makeFace)
  return {
    positiveX: faces[0],
    negativeX: faces[1],
    positiveY: faces[2],
    negativeY: faces[3],
    positiveZ: faces[4],
    negativeZ: faces[5]
  }
}

function applyCesiumEarthStyle() {
  const v = cesiumViewer
  if (!v || v.isDestroyed()) return

  if (realEarthLayer) {
    realEarthLayer.show = earthStyle.value === 'real'
  }
  if (classicEarthLayer) {
    classicEarthLayer.show = earthStyle.value === 'classic'
  }

  v.scene.globe.depthTestAgainstTerrain = true
  if (v.scene.globe.translucency) {
    v.scene.globe.translucency.enabled = false
  }
  v.scene.globe.baseColor = Cesium.Color.fromCssColorString(
    earthStyle.value === 'classic' ? '#04131f' : '#102643'
  )
  v.scene.globe.enableLighting = false
  v.scene.backgroundColor = Cesium.Color.fromCssColorString('#020713')
  if (v.scene.sun) v.scene.sun.show = earthStyle.value === 'classic'
  if (v.scene.moon) v.scene.moon.show = false
  if (classicSunEntity) {
    classicSunEntity.show = earthStyle.value === 'classic'
  }
  v.resize()
}

async function initCesiumImagery() {
  if (!cesiumContainer.value || cesiumViewer) return

  const classicTextureUrl = await createClassicEarthTextureUrl()
  const classicSunImage = createClassicSunImage()
  const classicSkyboxSources = await createClassicSkyboxSources()
  const v = new Cesium.Viewer(cesiumContainer.value, {
    animation: false,
    baseLayer: Cesium.ImageryLayer.fromProviderAsync(
      Cesium.SingleTileImageryProvider.fromUrl('/satellitemap/images/bluemarble-4k.webp', {
        rectangle: Cesium.Rectangle.MAX_VALUE
      }),
      {
        brightness: 0.9,
        contrast: 1.2,
        saturation: 1.12,
        gamma: 0.92
      }
    ),
    baseLayerPicker: false,
    fullscreenButton: false,
    vrButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false
  } as any)

  cesiumViewer = v
  cesiumStartTime = Cesium.JulianDate.now()
  satelliteSpriteImage = createSatelliteSprite()
  v.clock.startTime = cesiumStartTime.clone()
  v.clock.currentTime = cesiumStartTime.clone()
  v.clock.shouldAnimate = true
  v.clock.multiplier = 1
  v.resolutionScale = Math.min(window.devicePixelRatio || 1, 2)

  const creditContainer = (v as any)._cesiumWidget?._creditContainer
  if (creditContainer) creditContainer.style.display = 'none'

  v.scene.globe.show = true
  v.scene.globe.enableLighting = false
  v.scene.globe.showGroundAtmosphere = true
  v.scene.globe.atmosphereLightIntensity = 18
  v.scene.globe.depthTestAgainstTerrain = true
  if (v.scene.globe.translucency) {
    v.scene.globe.translucency.enabled = false
  }
  v.scene.globe.baseColor = Cesium.Color.fromCssColorString('#102643')
  v.scene.backgroundColor = Cesium.Color.fromCssColorString('#020713')
  v.scene.fog.enabled = false
  v.scene.postProcessStages.fxaa.enabled = true
  if (v.scene.postProcessStages.bloom) {
    v.scene.postProcessStages.bloom.enabled = true
  }
  if (v.scene.sun) v.scene.sun.show = false
  if (v.scene.moon) v.scene.moon.show = false
  if (v.scene.skyBox) v.scene.skyBox.show = true
  try {
    v.scene.skyBox = new Cesium.SkyBox({
      sources: classicSkyboxSources
    })
  } catch (error) {
    console.warn('[Cesium] Classic skybox unavailable.', error)
  }

  const controller = v.scene.screenSpaceCameraController
  controller.minimumZoomDistance = 3800000
  controller.maximumZoomDistance = 86000000
  controller.enableCollisionDetection = false

  try {
    const imagery = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
      'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
      { enablePickFeatures: false }
    )
    realEarthLayer = v.imageryLayers.addImageryProvider(imagery)
    realEarthLayer.brightness = 0.96
    realEarthLayer.contrast = 1.22
    realEarthLayer.saturation = 1.18
    realEarthLayer.gamma = 0.92
  } catch (error) {
    console.warn('[Cesium] ArcGIS imagery unavailable.', error)
  }

  const classicProvider = await Cesium.SingleTileImageryProvider.fromUrl(classicTextureUrl, {
    rectangle: Cesium.Rectangle.MAX_VALUE
  })
  classicEarthLayer = v.imageryLayers.addImageryProvider(classicProvider)
  classicEarthLayer.brightness = 1
  classicEarthLayer.contrast = 1
  classicEarthLayer.saturation = 1
  classicEarthLayer.gamma = 1
  classicEarthLayer.show = false

  classicSunEntity = v.entities.add({
    id: 'classic-sun',
    position: Cesium.Cartesian3.fromDegrees(138, 12, 145000000),
    billboard: {
      image: classicSunImage,
      width: 132,
      height: 132,
      color: Cesium.Color.WHITE.withAlpha(0.92),
      disableDepthTestDistance: Number.POSITIVE_INFINITY
    },
    show: false
  })

  v.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(108, 24, 18500000),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-90),
      roll: 0
    },
    duration: 0
  })

  cesiumClickHandler = new Cesium.ScreenSpaceEventHandler(v.scene.canvas)
  cesiumClickHandler.setInputAction((movement: any) => {
    const pickedObject = v.scene.pick(movement.position)
    if (!Cesium.defined(pickedObject) || !pickedObject.id) return
    const entity = pickedObject.id
    if (entity instanceof Cesium.Entity && entity.id && /^\d+$/.test(entity.id)) {
      satelliteStore.selectedSatelliteId = Number(entity.id)
      buildCesiumSatellites()
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

  v.scene.postRender.addEventListener(updateGroundStationMarkers)
  removeGroundMarkerRenderHook = () => {
    if (!v.isDestroyed()) {
      v.scene.postRender.removeEventListener(updateGroundStationMarkers)
    }
  }

  window.setTimeout(() => {
    v.resize()
    applyCesiumEarthStyle()
    buildCesiumSatellites()
    updateGroundStationMarkers()
  }, 100)
}

function toggleEarthStyle() {
  earthStyle.value = earthStyle.value === 'real' ? 'classic' : 'real'
  applyCesiumEarthStyle()
  forceReferenceEarthVisuals(true)
}

function sendToIframe(msg: Record<string, unknown>) {
  try {
    iframeRef.value?.contentWindow?.postMessage({ source: 'c4-parent', ...msg }, '*')
  } catch {
  }
}

function hideIframeChrome() {
  const win = iframeRef.value?.contentWindow
  const doc = iframeRef.value?.contentDocument
  if (!win || !doc) return false
  const style = currentEarthStyle.value

  doc.documentElement.style.overflow = 'hidden'
  doc.documentElement.classList.remove('preload')
  doc.body.style.margin = '0'
  doc.body.style.overflow = 'hidden'
  doc.body.dataset.earthStyle = earthStyle.value
  doc.body.style.opacity = '1'
  doc.body.classList.remove('splash-active')
  doc.body.classList.add('css-loaded')

  const styleId = 'c4-embed-overrides'
  let styleEl = doc.getElementById(styleId) as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = doc.createElement('style')
    styleEl.id = styleId
    doc.head.appendChild(styleEl)
  }

  const chromeCss = `
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden !important;
      margin: 0;
      padding: 0;
      background: ${style.background} !important;
    }
    #glCanvas { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; display: block !important; z-index: 0; }
    body[data-earth-style="classic"] [id*="inclination"],
    body[data-earth-style="classic"] [class*="inclination"],
    body[data-earth-style="classic"] [id*="Inclination"],
    body[data-earth-style="classic"] [class*="Inclination"] {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
    #navbar-desktop,
    #mobile-menu-overlay,
    #mobile-menu,
    #about_modal,
    #starlink-welcome,
    #splash-screen,
    #search-trigger-icon,
    #lv_info,
    #pov_info,
    #pov_reentry_info,
    #vis_help_icon,
    #helpModal,
    #bgtitle {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
    #dropdownMore,
    #dropdownTypes,
    #dropdownFunctions,
    #dropdownCalculators,
    #dropdownShare,
    #dropdownSettings,
    #dropdownInfo,
    #dropdownConstellationData,
    #dropdownNews,
    #dropdownNavbar,
    #dropdownNewsLink,
    #dropdownNavbarLink,
    #dropdownTypesLink,
    #dropdownFunctionsLink,
    #dropdownMoreLink,
    #mobile-menu-toggle,
    #time_rewind,
    #time_pause,
    #time_fastforward,
    #time_reset,
    #fps_telltale,
    #warning_flag,
    #types_menu_items,
    #constellation_menu_items,
    #mobile-constellation-menu,
    #mobile-more-menu,
    #mobile_types_menu_items,
    #desktop-constellation-data-item,
    #timeline-tab-list,
    #growth-panel,
    #launches-panel,
    #decays-panel,
    #events-panel,
    #orbits-panel,
    #ground-stations-panel,
    #timeline_chart_modal,
    #credits_modal,
    #feedback_modal,
    #satellite_info_panel,
    #satellite-info-panel,
    #desktopHelpTab,
    #touchHelpTab,
    #bottom-bar,
    #controls,
    #control-panel,
    #toolbar,
    [id^="btn"],
    button,
    a,
    [role="button"],
    nav,
    .modal,
    .navbar,
    .dropdown,
    .dropdown-menu,
    .toolbar,
    .btn,
    .menu,
    .controls,
    .time-control,
    .time-controls,
    .fps-control,
    .fps-telltale,
    .fixed.bottom-0,
    .fixed.bottom-2,
    .fixed.bottom-4,
    [id*="time"],
    [class*="time"],
    [id*="fps"],
    [class*="fps"],
    .control-table,
    .control-spacer,
    .help-tab,
    .help-panel,
    .navbar-dropdown-menu,
    .navbar-dropdown-list,
    .navbar-desktop-dropdown-item,
    .navbar-mobile-dropdown-item,
    .bottom-panel,
    .right-panel,
    .side-panel,
    .overlay-panel,
    .draggable-window,
    .lv-info-window,
    .sat-info-panel,
    .info-panel {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
  `
  if (styleEl.textContent !== chromeCss) styleEl.textContent = chromeCss

  const canvas = doc.getElementById('glCanvas') as HTMLCanvasElement | null
  if (canvas) {
    canvas.style.position = 'fixed'
    canvas.style.inset = '0'
    canvas.style.width = '100vw'
    canvas.style.height = '100vh'
    canvas.style.display = 'block'
  }

  const globe = (win as any).globe
  if (globe) {
    applyGlobeVisuals(globe, true)
    if ('requestOptimalZoom' in globe) globe.requestOptimalZoom = false
    if (typeof (globe as any).calculateOptimalZoom === 'function') {
      ;(globe as any).calculateOptimalZoom = () => null
    }
    if ('cameraPath' in globe) globe.cameraPath = null
    if ('eyeDistance' in globe) globe.eyeDistance = targetEyeDistance
    if (Array.isArray(globe.eye)) globe.eye = [0, 0, targetEyeDistance]
  }

  return true
}

function applyGlobeVisuals(g: any, force = false) {
  const style = currentEarthStyle.value
  const signature = [
    earthStyle.value,
    style.texstyle ?? 'inherit',
    style.clouds ?? 'inherit',
    style.skybox ?? 'inherit',
    style.dotlighting ?? 'inherit'
  ].join(':')
  if (!force && lastVisualSignature === signature) return
  lastVisualSignature = signature

  if (style.borders != null && 'show_borders' in g) g.show_borders = style.borders
  if (style.texstyle != null && 'show_texstyle' in g) g.show_texstyle = style.texstyle
  if (style.dotlighting != null && 'show_dotlighting' in g) g.show_dotlighting = style.dotlighting
  if (style.skybox != null && 'show_skybox' in g) g.show_skybox = style.skybox
  if ('show_sun' in g) g.show_sun = style.sun
  if (style.clouds != null && 'show_clouds' in g) g.show_clouds = style.clouds
  if ('show_rotating' in g) g.show_rotating = 1
  if ('show_labels' in g) g.show_labels = 1
}

function forceReferenceEarthVisuals(force = false) {
  const win = iframeRef.value?.contentWindow as any
  if (!win) return
  const doc = iframeRef.value?.contentDocument
  if (doc?.body) {
    doc.body.dataset.earthStyle = earthStyle.value
  }
  const g = win.globe || win.blueGlobe
  if (!g) return
  applyGlobeVisuals(g, force)
}

function scheduleIframeSetup() {
  const ok = hideIframeChrome()
  forceReferenceEarthVisuals()
  iframeSetupRuns.value += 1
  const hasGlobe = Boolean(iframeRef.value?.contentWindow && (iframeRef.value.contentWindow as any).globe)
  if (ok && hasGlobe) {
    iframeReady.value = true
    if (!bordersKeepAliveTimer) {
      bordersKeepAliveTimer = setInterval(() => {
        forceReferenceEarthVisuals()
      }, 1200)
    }
    return
  }
  if (iframeSetupRuns.value < 40) {
    window.setTimeout(scheduleIframeSetup, 300)
  }
}

function onIframeLoad() {
  iframeReady.value = false
  iframeSetupRuns.value = 0
  lastVisualSignature = ''
  if (bordersKeepAliveTimer) {
    clearInterval(bordersKeepAliveTimer)
    bordersKeepAliveTimer = null
  }
  window.setTimeout(scheduleIframeSetup, 0)
}

function onMessage(event: MessageEvent) {
  const data = event.data
  if (!data) return

  if (data.source === 'c4-satellitemap' && data.type === 'c4-selection') {
    const id: number | null = data.payload?.selectedId ?? null
    if (id == null) {
      satelliteStore.selectedSatelliteId = null
    } else {
      const sat = satelliteStore.satellites.find((item) => item.id === id)
      if (sat) {
        satelliteStore.selectedSatelliteId = sat.id
      }
    }
    return
  }

  if (data.source !== 'c4-bridge') return

  if (data.type === 'satellite-deselected') {
    satelliteStore.selectedSatelliteId = null
  }
}

onMounted(() => {
  window.addEventListener('message', onMessage)
  initCesiumImagery()
})

watch(
  () => satelliteStore.satellites,
  () => buildCesiumSatellites(),
  { deep: true }
)

watch(
  () => satelliteStore.selectedSatelliteId,
  () => buildCesiumSatellites()
)

onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage)
  if (bordersKeepAliveTimer) {
    clearInterval(bordersKeepAliveTimer)
    bordersKeepAliveTimer = null
  }
  if (cesiumClickHandler) {
    cesiumClickHandler.destroy()
    cesiumClickHandler = null
  }
  if (removeGroundMarkerRenderHook) {
    removeGroundMarkerRenderHook()
    removeGroundMarkerRenderHook = null
  }
  if (cesiumViewer && !cesiumViewer.isDestroyed()) {
    cesiumViewer.destroy()
  }
  cesiumViewer = null
  cesiumStartTime = null
  realEarthLayer = null
  classicEarthLayer = null
  classicSunEntity = null
  cesiumSatelliteEntities.clear()
  cesiumOrbitEntities.clear()
  cesiumLinkEntities.clear()
  cesiumGroundCableEntities.clear()
  cesiumGroundLinkEntities.clear()
})
</script>

<style scoped>
:scope {
  --sat-panel-text: #f5f9fd;
  --sat-panel-muted: #9cb3c7;
  --sat-panel-soft: #89a3bb;
  --sat-dialog-text: #f5f9fd;
  --sat-dialog-muted: #9cb3c7;
  --sat-dialog-title: #d8e7f5;
  --sat-dialog-card-bg: rgba(255, 255, 255, 0.035);
  --sat-dialog-card-border: rgba(255, 255, 255, 0.06);
  --sat-dialog-hero-bg: linear-gradient(180deg, rgba(10, 22, 37, 0.95), rgba(7, 14, 23, 0.9));
  --sat-dialog-hero-border: rgba(136, 170, 208, 0.14);
  --sat-dialog-emphasis-bg: linear-gradient(180deg, rgba(20, 39, 61, 0.58), rgba(13, 23, 35, 0.48));
  --sat-dialog-emphasis-border: rgba(94, 153, 214, 0.24);
}

:global(html:not(.dark)) #satmap-container {
  --sat-dialog-text: #1f2937;
  --sat-dialog-muted: #5b6b7f;
  --sat-dialog-title: #1f3652;
  --sat-dialog-card-bg: rgba(241, 245, 249, 0.92);
  --sat-dialog-card-border: rgba(148, 163, 184, 0.3);
  --sat-dialog-hero-bg: linear-gradient(180deg, rgba(248, 250, 252, 0.98), rgba(236, 242, 248, 0.96));
  --sat-dialog-hero-border: rgba(148, 163, 184, 0.32);
  --sat-dialog-emphasis-bg: linear-gradient(180deg, rgba(226, 239, 251, 0.96), rgba(236, 244, 252, 0.92));
  --sat-dialog-emphasis-border: rgba(96, 165, 250, 0.3);
}

#satmap-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: radial-gradient(circle at center, #09131f 0%, #020811 58%, #01040a 100%);
}

.satmap-iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
  background: #020811;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  z-index: 1;
}

.satmap-iframe.ready {
  opacity: 1;
  pointer-events: auto;
}

.cesium-imagery-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  pointer-events: none;
  z-index: 2;
  background:
    radial-gradient(circle at 48% 48%, rgba(48, 150, 255, 0.14), transparent 31%),
    radial-gradient(circle at 50% 50%, rgba(4, 13, 27, 0), rgba(2, 7, 19, 0.76) 72%),
    #020713;
  transition: opacity 0.2s ease;
}

.cesium-imagery-layer.active {
  opacity: 1;
  pointer-events: auto;
}

.cesium-imagery-layer :deep(.cesium-widget),
.cesium-imagery-layer :deep(.cesium-widget canvas) {
  width: 100%;
  height: 100%;
}

.cesium-imagery-layer :deep(.cesium-viewer-bottom),
.cesium-imagery-layer :deep(.cesium-viewer-toolbar),
.cesium-imagery-layer :deep(.cesium-viewer-animationContainer),
.cesium-imagery-layer :deep(.cesium-viewer-timelineContainer) {
  display: none !important;
}

.ground-overlay {
  position: absolute;
  inset: 0;
  z-index: 11;
  pointer-events: none;
  overflow: visible;
}

.ground-marker {
  position: absolute;
  left: 0;
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  opacity: 0;
  transform: translate(-50%, -50%);
  transition: opacity 0.14s ease;
  will-change: left, top, opacity;
}

.ground-marker.visible {
  opacity: 1;
}

.ground-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: block;
  background:
    radial-gradient(circle at 50% 50%, #ffffff 0 15%, #ffd84d 17% 44%, rgba(255, 216, 77, 0.18) 46% 100%);
  border: 3px solid rgba(5, 17, 31, 0.96);
  box-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.62),
    0 0 18px rgba(255, 216, 77, 0.46),
    0 8px 22px rgba(0, 0, 0, 0.36);
}

.ground-marker.boundary .ground-dot {
  width: 24px;
  height: 24px;
  background:
    radial-gradient(circle at 50% 50%, #ffffff 0 14%, #2df6a3 17% 46%, rgba(45, 246, 163, 0.18) 48% 100%);
  box-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.5),
    0 0 16px rgba(45, 246, 163, 0.42),
    0 8px 22px rgba(0, 0, 0, 0.34);
}

.ground-marker b {
  max-width: 96px;
  padding: 3px 7px;
  border-radius: 999px;
  border: 1px solid rgba(116, 186, 255, 0.24);
  background: rgba(3, 11, 22, 0.72);
  color: #eef8ff;
  font-size: 11px;
  line-height: 1.15;
  font-weight: 800;
  text-align: center;
  white-space: nowrap;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px);
}

.action-btns {
  position: absolute;
  top: 20px;
  right: 24px;
  z-index: 12;
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
}

.action-btns .el-button {
  background: rgba(14, 25, 43, 0.85) !important;
  backdrop-filter: blur(16px);
  border-color: rgba(64, 158, 255, 0.4) !important;
  color: #eaf3fb !important;
}

.status-dialog-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: min(60vh, 560px);
  overflow: auto;
  padding-right: 4px;
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
.status-chip.warning { box-shadow: inset 0 0 0 1px rgba(255, 208, 75, 0.14); background: rgba(255, 208, 75, 0.08); }
.status-chip.danger { box-shadow: inset 0 0 0 1px rgba(255, 107, 107, 0.14); background: rgba(255, 107, 107, 0.1); }
.status-chip.offline { box-shadow: inset 0 0 0 1px rgba(123, 135, 148, 0.14); background: rgba(123, 135, 148, 0.1); }

.status-chip-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-chip-main strong,
.status-chip-meta span,
.float-card-head strong,
.float-item strong,
.edit-item-info strong {
  color: var(--sat-panel-text);
}

.status-chip-main span,
.float-card-head span,
.float-item label,
.edit-item-info span {
  color: var(--sat-panel-muted);
}

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

.status-badge.normal, .detail-status.normal { color: #00d2ff; background: rgba(0, 210, 255, 0.15); }
.status-badge.warning, .detail-status.warning { color: #ffd04b; background: rgba(255, 208, 75, 0.14); }
.status-badge.danger, .detail-status.danger { color: #ff8c8c; background: rgba(255, 107, 107, 0.16); }
.status-badge.offline, .detail-status.offline { color: #b6c2cf; background: rgba(123, 135, 148, 0.18); }

.edit-dialog {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 16px;
}

.edit-dialog-list {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 60vh;
  overflow: auto;
  padding-right: 4px;
}

.edit-dialog-actions {
  margin-bottom: 2px;
}

.edit-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
  text-align: left;
}

.edit-list-item.active {
  border-color: rgba(64, 158, 255, 0.45);
  box-shadow: inset 0 0 0 1px rgba(64, 158, 255, 0.18);
}

.edit-item-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.edit-dialog-form {
  padding: 4px 0 0;
}

.fade-panel-enter-active,
.fade-panel-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.fade-panel-enter-from,
.fade-panel-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}

@media (max-width: 960px) {
  .action-btns {
    top: 16px;
    right: 16px;
    left: 16px;
    justify-content: flex-end;
  }

  .edit-dialog {
    grid-template-columns: 1fr;
  }
}
</style>
