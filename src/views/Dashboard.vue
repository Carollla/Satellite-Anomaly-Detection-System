<template>
  <div class="dashboard-page">
    <i v-for="star in stars" :key="star" class="star" :style="starStyle(star)"></i>

    <header class="dash-head">
      <div>
        <span>SpaceMAN</span>
        <h1>运维仪表盘</h1>
      </div>
      <div class="head-actions">
        <el-button size="small" type="primary" @click="router.push('/earth')">卫星群视图</el-button>
        <el-button size="small" @click="router.push('/editor')">可视化编辑</el-button>
        <el-button size="small" @click="router.push('/remote-sensing')">遥感工作台</el-button>
      </div>
    </header>

    <section class="command-strip">
      <article class="mission-core">
        <div class="orbit-mark">
          <i></i>
          <b></b>
          <em></em>
        </div>
        <div>
          <span>星座规模</span>
          <strong>{{ totalCount }}</strong>
          <small>LEO-MEO-GEO</small>
        </div>
      </article>

      <article class="state-board">
        <div v-for="item in opsSummary" :key="item.label" class="state-item">
          <span>{{ item.label }}</span>
          <strong :style="{ color: item.color }">{{ item.value }}</strong>
          <b><i :style="{ width: `${item.percent}%`, background: item.color }"></i></b>
        </div>
      </article>

      <article class="orbit-board">
        <div v-for="layer in layerCards" :key="layer.label" class="orbit-chip">
          <span>{{ layer.label }}</span>
          <strong>{{ layer.count }}</strong>
          <i :style="{ background: layer.color }"></i>
        </div>
      </article>
    </section>

    <section class="dash-grid">
      <main class="left-grid">
        <el-card class="panel constellation-panel" shadow="never">
          <template #header>
            <div class="panel-title">
              <strong>星座态势</strong>
              <el-tag size="small" type="info">{{ healthScore }}%</el-tag>
            </div>
          </template>
          <div class="constellation-body">
            <div ref="constellationCanvas" class="constellation-3d">
              <div class="scene-hud">
                <div class="hud-main">
                  <strong>{{ totalCount }}</strong>
                  <span>三层星座</span>
                </div>
                <div class="hud-status">
                  <b :class="{ active: !alertCount }"></b>
                  <span>{{ alertCount ? '告警监测' : '稳定运行' }}</span>
                </div>
              </div>
            </div>
            <div class="layer-stack">
              <div v-for="layer in layerCards" :key="layer.label" class="layer-item">
                <div>
                  <strong>{{ layer.label }}</strong>
                  <span>{{ layer.count }} 颗</span>
                </div>
                <b><i :style="{ width: `${layer.share}%`, background: layer.color }"></i></b>
              </div>
            </div>
          </div>
        </el-card>

        <div class="chart-pair">
          <el-card class="panel status-panel" shadow="never">
            <template #header>
              <div class="panel-title"><strong>卫星状态分布</strong></div>
            </template>
            <div class="status-bars">
              <div v-for="item in statusRows" :key="item.label" class="status-row">
                <span>{{ item.label }}</span>
                <b><i :style="{ width: `${item.percent}%`, background: item.color }"></i></b>
                <strong>{{ item.value }}</strong>
              </div>
            </div>
          </el-card>
          <el-card class="panel workload-panel" shadow="never">
            <template #header>
              <div class="panel-title"><strong>运行负载</strong></div>
            </template>
            <div class="workload-grid">
              <div v-for="item in workloadMetrics" :key="item.label" class="workload-meter">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
                <b>
                  <i :style="{ width: `${item.percent}%`, background: item.color }"></i>
                </b>
              </div>
            </div>
          </el-card>
        </div>
      </main>

      <aside class="right-grid">
        <el-card class="panel alert-panel" shadow="never">
          <template #header>
            <div class="panel-title">
              <strong>告警队列</strong>
              <el-tag size="small" type="warning">{{ alertRows.length }}</el-tag>
            </div>
          </template>
          <div class="alert-list">
            <button
              v-for="item in alertRows"
              :key="item.id"
              class="alert-row"
              :class="item.status"
              @click="router.push(`/satellite/${item.instanceId}`)"
            >
              <span>{{ item.name }}</span>
              <em>{{ item.label }}</em>
              <b>{{ item.cpu }}%</b>
            </button>
            <div v-if="!alertRows.length" class="empty-alert">当前无告警</div>
          </div>
        </el-card>

        <el-card class="panel agent-panel" shadow="never">
          <template #header>
            <div class="panel-title">
              <strong>异常监测</strong>
              <el-tag size="small" type="success">在线</el-tag>
            </div>
          </template>
          <div class="agent-body">
            <div class="score-ring" :style="{ '--score': `${healthScore}%` }">
              <strong>{{ healthScore }}</strong>
              <span>健康度</span>
            </div>
            <div class="agent-lines">
              <div v-for="line in agentLines" :key="line.label">
                <span>{{ line.label }}</span>
                <b :style="{ color: line.color }">{{ line.value }}</b>
              </div>
            </div>
          </div>
        </el-card>

        <el-card class="panel remote-panel" shadow="never">
          <template #header>
            <div class="panel-title">
              <strong>遥感图像</strong>
              <el-tag size="small" :type="selectedRemote ? 'success' : 'info'">
                {{ selectedRemote?.confidence !== null && selectedRemote?.confidence !== undefined ? `${selectedRemote.confidence}%` : '待生成' }}
              </el-tag>
            </div>
          </template>
          <div class="remote-body" @click="router.push('/remote-sensing')">
            <img :src="remotePreview.imageUrl" :alt="remotePreview.title" />
            <div>
              <strong>{{ remotePreview.title }}</strong>
              <span>{{ remotePreview.meta }}</span>
            </div>
          </div>
        </el-card>
      </aside>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import * as THREE from 'three'
import { useRemoteSensingStore } from '../stores/remoteSensing'
import { useSatelliteStore, type Satellite } from '../stores/satellite'

const router = useRouter()
const satelliteStore = useSatelliteStore()
const remoteStore = useRemoteSensingStore()
const constellationCanvas = ref<HTMLElement | null>(null)

const stars = Array.from({ length: 46 }, (_, index) => index)
const nasaWorldviewImage =
  'https://wvs.earthdata.nasa.gov/api/v1/snapshot?REQUEST=GetSnapshot&TIME=2024-06-01&LAYERS=MODIS_Terra_CorrectedReflectance_TrueColor&CRS=EPSG:4326&BBOX=30,-125,50,-65&FORMAT=image/jpeg&WIDTH=800&HEIGHT=450'

const totalCount = computed(() => satelliteStore.satellites.length)
const alertCount = computed(() => satelliteStore.satellites.filter((item) => item.status !== 'normal').length)
const normalCount = computed(() => totalCount.value - alertCount.value)
const healthScore = computed(() =>
  totalCount.value ? Math.round((normalCount.value / totalCount.value) * 100) : 100
)
const selectedRemote = computed(() => remoteStore.selectedProduct)
const remotePreview = computed(() => {
  if (selectedRemote.value?.imageUrl) {
    return {
      imageUrl: selectedRemote.value.imageUrl,
      title: selectedRemote.value.target || '后端遥感产品',
      meta: `${selectedRemote.value.satelliteName} · ${selectedRemote.value.resolution || '真实产品'}`
    }
  }
  return {
    imageUrl: nasaWorldviewImage,
    title: 'NASA Worldview 真实遥感图像',
    meta: 'MODIS Terra True Color · 2024-06-01'
  }
})

const layerCards = computed(() => {
  const leo = satelliteStore.satellites.filter((item) => item.alt < 20000000).length
  const meo = satelliteStore.satellites.filter((item) => item.alt >= 20000000 && item.alt < 30000000).length
  const geo = satelliteStore.satellites.filter((item) => item.alt >= 30000000).length
  const total = Math.max(totalCount.value, 1)
  return [
    { label: 'LEO', count: leo, share: Math.round((leo / total) * 100), color: '#2f6df6' },
    { label: 'MEO', count: meo, share: Math.round((meo / total) * 100), color: '#12a67d' },
    { label: 'GEO', count: geo, share: Math.round((geo / total) * 100), color: '#f59e0b' }
  ]
})

const opsSummary = computed(() => [
  { label: '正常卫星', value: normalCount.value, percent: healthScore.value, color: '#12a67d' },
  {
    label: '告警卫星',
    value: alertCount.value,
    percent: Math.max(4, Math.round((alertCount.value / Math.max(totalCount.value, 1)) * 100)),
    color: alertCount.value ? '#ef4444' : '#64748b'
  },
  { label: '遥感产物', value: remoteStore.readyCount, percent: Math.min(100, 28 + remoteStore.readyCount * 16), color: '#8b5cf6' }
])

const alertRows = computed(() =>
  satelliteStore.satellites
    .filter((item) => item.status !== 'normal')
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      name: item.name,
      instanceId: item.instanceId,
      status: item.status,
      label: statusLabel(item.status),
      cpu: item.cpu.toFixed(1)
    }))
)

const agentLines = computed(() => [
  { label: '告警', value: `${alertCount.value} 条`, color: alertCount.value ? '#ef4444' : '#12a67d' },
  { label: '队列', value: `${remoteStore.processingCount} 项`, color: '#2f6df6' },
  { label: '处置', value: alertCount.value ? '待确认' : '稳定', color: alertCount.value ? '#f59e0b' : '#12a67d' }
])

const statusRows = computed(() => {
  const values = [
    { label: '正常', value: satelliteStore.satellites.filter((item) => item.status === 'normal').length, color: '#12a67d' },
    { label: '告警', value: satelliteStore.satellites.filter((item) => item.status === 'warning').length, color: '#f59e0b' },
    { label: '严重', value: satelliteStore.satellites.filter((item) => item.status === 'danger').length, color: '#ef4444' },
    { label: '离线', value: satelliteStore.satellites.filter((item) => item.status === 'offline').length, color: '#64748b' }
  ]
  const max = Math.max(...values.map((item) => item.value), 1)
  return values.map((item) => ({ ...item, percent: Math.max(3, Math.round((item.value / max) * 100)) }))
})

const workloadMetrics = computed(() => {
  const sats = satelliteStore.satellites
  const total = Math.max(sats.length, 1)
  const avgCpu = sats.reduce((sum, item) => sum + Number(item.cpu || 0), 0) / total
  const maxTemp = sats.reduce((max, item) => Math.max(max, Number(item.temp || 0)), 0)
  const alertRatio = (alertCount.value / total) * 100
  const queueRatio = Math.min(100, remoteStore.processingCount * 18 + remoteStore.readyCount * 6)
  return [
    { label: '平均CPU', value: `${avgCpu.toFixed(1)}%`, percent: Math.min(100, Math.round(avgCpu)), color: '#2f6df6' },
    { label: '最高温度', value: `${maxTemp.toFixed(1)}°C`, percent: Math.min(100, Math.round((maxTemp / 90) * 100)), color: maxTemp >= 70 ? '#ef4444' : '#f59e0b' },
    { label: '告警占比', value: `${alertRatio.toFixed(1)}%`, percent: Math.max(3, Math.round(alertRatio)), color: alertCount.value ? '#ef4444' : '#12a67d' },
    { label: '遥感队列', value: `${remoteStore.processingCount} 项`, percent: Math.max(3, queueRatio), color: '#8b5cf6' }
  ]
})

let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let earthGroup: THREE.Group | null = null
let orbitGroup: THREE.Group | null = null
let satellitePoints: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | null = null
let alertPoints: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | null = null
let resizeObserver: ResizeObserver | null = null
let animationFrame = 0
let satelliteCapacity = 0
const sceneClock = new THREE.Clock()

function createEarthTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const ocean = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
  ocean.addColorStop(0, '#0ea5e9')
  ocean.addColorStop(0.45, '#1d4ed8')
  ocean.addColorStop(1, '#082f49')
  ctx.fillStyle = ocean
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.globalAlpha = 0.86
  ctx.fillStyle = '#22c55e'
  const lands = [
    [145, 154, 120, 54],
    [260, 228, 92, 48],
    [430, 180, 118, 62],
    [575, 268, 136, 58],
    [760, 178, 120, 50],
    [860, 304, 90, 44]
  ]
  lands.forEach(([x, y, w, h], index) => {
    ctx.beginPath()
    ctx.ellipse(x, y, w, h, index % 2 ? 0.28 : -0.36, 0, Math.PI * 2)
    ctx.fill()
  })

  ctx.globalAlpha = 0.28
  ctx.strokeStyle = '#bfdbfe'
  ctx.lineWidth = 1
  for (let y = 64; y < canvas.height; y += 64) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.bezierCurveTo(260, y - 18, 720, y + 18, canvas.width, y)
    ctx.stroke()
  }
  for (let x = 80; x < canvas.width; x += 96) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.bezierCurveTo(x + 22, 150, x - 22, 360, x, canvas.height)
    ctx.stroke()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function createOrbitLine(radius: number, color: string, inclination: number, raan: number, opacity = 0.45) {
  const points: number[] = []
  for (let index = 0; index < 256; index += 1) {
    const angle = (index / 256) * Math.PI * 2
    points.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false
  })
  const line = new THREE.LineLoop(geometry, material)
  line.rotation.x = THREE.MathUtils.degToRad(inclination)
  line.rotation.y = THREE.MathUtils.degToRad(raan)
  return line
}

function satelliteColor(status: Satellite['status']) {
  if (status === 'danger') return new THREE.Color('#ef4444')
  if (status === 'warning') return new THREE.Color('#f59e0b')
  if (status === 'offline') return new THREE.Color('#94a3b8')
  return new THREE.Color('#5eead4')
}

function orbitRadius(satellite: Satellite) {
  if (satellite.alt >= 30000000) return 3.72
  if (satellite.alt >= 20000000) return 2.82
  return 1.78 + Math.min(0.28, satellite.alt / 3000000)
}

function orbitSpeed(satellite: Satellite) {
  if (satellite.alt >= 30000000) return 0.1
  if (satellite.alt >= 20000000) return 0.22
  return 0.46
}

function satellitePosition(satellite: Satellite, elapsed: number) {
  const angle =
    THREE.MathUtils.degToRad(satellite.phase + satellite.id * 0.72) + elapsed * orbitSpeed(satellite)
  const radius = orbitRadius(satellite)
  const position = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
  position.applyAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(satellite.inclination))
  position.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(satellite.baseLon))
  return position
}

function buildSatelliteCloud() {
  if (!scene) return
  if (satellitePoints) {
    scene.remove(satellitePoints)
    satellitePoints.geometry.dispose()
    satellitePoints.material.dispose()
  }
  if (alertPoints) {
    scene.remove(alertPoints)
    alertPoints.geometry.dispose()
    alertPoints.material.dispose()
  }

  satelliteCapacity = satelliteStore.satellites.length
  const positions = new Float32Array(Math.max(satelliteCapacity, 1) * 3)
  const colors = new Float32Array(Math.max(satelliteCapacity, 1) * 3)
  const alertPositions = new Float32Array(Math.max(satelliteCapacity, 1) * 3)
  const alertColors = new Float32Array(Math.max(satelliteCapacity, 1) * 3)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const alertGeometry = new THREE.BufferGeometry()
  alertGeometry.setAttribute('position', new THREE.BufferAttribute(alertPositions, 3))
  alertGeometry.setAttribute('color', new THREE.BufferAttribute(alertColors, 3))

  satellitePoints = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.065,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.96,
      depthWrite: false
    })
  )
  alertPoints = new THREE.Points(
    alertGeometry,
    new THREE.PointsMaterial({
      size: 0.16,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  )

  scene.add(satellitePoints)
  scene.add(alertPoints)
}

function updateSatelliteCloud(elapsed: number) {
  if (!satellitePoints || !alertPoints || satelliteCapacity !== satelliteStore.satellites.length) {
    buildSatelliteCloud()
  }
  if (!satellitePoints || !alertPoints) return

  const positionAttr = satellitePoints.geometry.getAttribute('position') as THREE.BufferAttribute
  const colorAttr = satellitePoints.geometry.getAttribute('color') as THREE.BufferAttribute
  const alertPositionAttr = alertPoints.geometry.getAttribute('position') as THREE.BufferAttribute
  const alertColorAttr = alertPoints.geometry.getAttribute('color') as THREE.BufferAttribute

  satelliteStore.satellites.forEach((satellite, index) => {
    const position = satellitePosition(satellite, elapsed)
    const color = satelliteColor(satellite.status)
    positionAttr.setXYZ(index, position.x, position.y, position.z)
    colorAttr.setXYZ(index, color.r, color.g, color.b)

    if (satellite.status === 'normal') {
      alertPositionAttr.setXYZ(index, 80, 80, 80)
      alertColorAttr.setXYZ(index, 0, 0, 0)
    } else {
      alertPositionAttr.setXYZ(index, position.x, position.y, position.z)
      alertColorAttr.setXYZ(index, color.r, color.g, color.b)
    }
  })

  positionAttr.needsUpdate = true
  colorAttr.needsUpdate = true
  alertPositionAttr.needsUpdate = true
  alertColorAttr.needsUpdate = true
}

function resizeConstellationScene() {
  const host = constellationCanvas.value
  if (!host || !renderer || !camera) return
  const width = Math.max(host.clientWidth, 1)
  const height = Math.max(host.clientHeight, 1)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

function animateConstellationScene() {
  if (!scene || !camera || !renderer) return
  const elapsed = sceneClock.getElapsedTime()
  if (earthGroup) {
    earthGroup.rotation.y = elapsed * 0.08
    earthGroup.position.y = Math.sin(elapsed * 0.8) * 0.035
  }
  if (orbitGroup) {
    orbitGroup.rotation.y = elapsed * 0.035
  }
  updateSatelliteCloud(elapsed)
  renderer.render(scene, camera)
  animationFrame = requestAnimationFrame(animateConstellationScene)
}

function initConstellationScene() {
  const host = constellationCanvas.value
  if (!host) return

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80)
  camera.position.set(0, 2.95, 7.1)
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance'
  })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(0x000000, 0)
  host.appendChild(renderer.domElement)

  scene.add(new THREE.AmbientLight(0x8fd3ff, 1.35))
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2)
  keyLight.position.set(-3.2, 4.2, 5.4)
  scene.add(keyLight)
  const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.3)
  rimLight.position.set(4, -1.5, -3)
  scene.add(rimLight)

  earthGroup = new THREE.Group()
  const earthTexture = createEarthTexture()
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 64),
    new THREE.MeshStandardMaterial({
      map: earthTexture || undefined,
      roughness: 0.62,
      metalness: 0.05,
      emissive: new THREE.Color('#082f49'),
      emissiveIntensity: 0.12
    })
  )
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.08, 64, 64),
    new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  )
  earthGroup.add(earth)
  earthGroup.add(atmosphere)
  scene.add(earthGroup)

  orbitGroup = new THREE.Group()
  ;[0, 60, 120, 180, 240, 300].forEach((raan) => {
    orbitGroup?.add(createOrbitLine(1.9, '#60a5fa', 53, raan, 0.38))
  })
  ;[30, 120, 210, 300].forEach((raan) => {
    orbitGroup?.add(createOrbitLine(2.82, '#2dd4bf', 55, raan, 0.36))
  })
  orbitGroup.add(createOrbitLine(3.72, '#fbbf24', 0, 0, 0.42))
  scene.add(orbitGroup)

  const starPositions = new Float32Array(360)
  for (let index = 0; index < 120; index += 1) {
    const radius = 10 + (index % 9) * 0.36
    const theta = (index * 2.3999632297) % (Math.PI * 2)
    const phi = Math.acos(2 * ((index * 37) % 101) / 101 - 1)
    starPositions[index * 3] = radius * Math.sin(phi) * Math.cos(theta)
    starPositions[index * 3 + 1] = radius * Math.cos(phi)
    starPositions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)
  }
  const starGeometry = new THREE.BufferGeometry()
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
  scene.add(
    new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: '#bfdbfe',
        size: 0.035,
        transparent: true,
        opacity: 0.58,
        depthWrite: false
      })
    )
  )

  buildSatelliteCloud()
  resizeConstellationScene()
  resizeObserver = new ResizeObserver(resizeConstellationScene)
  resizeObserver.observe(host)
  sceneClock.start()
  animateConstellationScene()
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
    const material = mesh.material
    if (Array.isArray(material)) {
      material.forEach((item) => item.dispose())
    } else if (material) {
      material.dispose()
    }
  })
}

function disposeConstellationScene() {
  cancelAnimationFrame(animationFrame)
  resizeObserver?.disconnect()
  resizeObserver = null
  if (scene) disposeObject(scene)
  renderer?.dispose()
  renderer?.domElement.remove()
  scene = null
  camera = null
  renderer = null
  earthGroup = null
  orbitGroup = null
  satellitePoints = null
  alertPoints = null
  satelliteCapacity = 0
}

onMounted(initConstellationScene)
onBeforeUnmount(disposeConstellationScene)

watch(
  () => satelliteStore.satellites.length,
  () => buildSatelliteCloud()
)

function statusLabel(status: string) {
  if (status === 'warning') return '告警'
  if (status === 'danger') return '严重'
  if (status === 'offline') return '离线'
  return '正常'
}

function starStyle(index: number) {
  return {
    left: `${(index * 19) % 100}%`,
    top: `${(index * 31) % 100}%`,
    width: `${1 + (index % 3)}px`,
    height: `${1 + (index % 3)}px`,
    animationDelay: `${(index % 11) * 0.22}s`
  }
}

</script>

<style scoped>
.dashboard-page {
  position: relative;
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: 38px 94px minmax(0, 1fr);
  gap: 10px;
  padding: 10px 12px;
  overflow: hidden;
  background:
    radial-gradient(circle at 18% 8%, rgba(47, 109, 246, 0.18), transparent 26%),
    radial-gradient(circle at 82% 16%, rgba(139, 92, 246, 0.14), transparent 25%),
    linear-gradient(180deg, #f8fbff 0%, #ffffff 34%, #f5f8fc 100%);
  color: #172033;
}

.star {
  position: absolute;
  border-radius: 50%;
  background: rgba(47, 109, 246, 0.48);
  box-shadow: 0 0 12px rgba(47, 109, 246, 0.5);
  animation: starPulse 2.8s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;
}

.dash-head,
.command-strip,
.dash-grid {
  position: relative;
  z-index: 1;
}

.dash-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dash-head span {
  color: #667085;
  font-size: 11px;
}

.dash-head h1 {
  margin: 0;
  font-size: 22px;
  line-height: 1.1;
}

.head-actions {
  display: flex;
  gap: 6px;
}

.command-strip {
  min-height: 0;
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr) 260px;
  gap: 10px;
}

.mission-core,
.state-board,
.orbit-board,
.panel {
  border: 1px solid rgba(47, 109, 246, 0.14);
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(16px);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.07);
}

.mission-core {
  min-width: 0;
  display: grid;
  grid-template-columns: 82px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  overflow: hidden;
}

.orbit-mark {
  position: relative;
  width: 76px;
  aspect-ratio: 1;
  border-radius: 50%;
  background:
    radial-gradient(circle at 44% 42%, #0f5ba7 0 24%, #1d9bf0 25% 38%, transparent 39%),
    repeating-radial-gradient(circle, transparent 0 20px, rgba(47, 109, 246, 0.26) 21px 22px);
}

.orbit-mark i,
.orbit-mark b,
.orbit-mark em {
  position: absolute;
  inset: 11px;
  border: 1px solid rgba(47, 109, 246, 0.46);
  border-radius: 50%;
  transform: rotateX(64deg) rotateZ(30deg);
}

.orbit-mark b {
  inset: 20px;
  transform: rotateX(64deg) rotateZ(-25deg);
}

.orbit-mark em {
  width: 7px;
  height: 7px;
  inset: auto;
  left: 57px;
  top: 21px;
  border: 0;
  background: #f59e0b;
  box-shadow: 0 0 14px #f59e0b;
  animation: satelliteBlink 1.6s ease-in-out infinite;
}

.mission-core span,
.state-item span,
.orbit-chip span,
.layer-item span,
.alert-row em,
.remote-body span,
.score-ring span,
.agent-lines span {
  color: #667085;
  font-size: 12px;
  font-style: normal;
}

.mission-core strong {
  display: block;
  font-size: 34px;
  line-height: 1;
}

.mission-core small {
  color: #2f6df6;
  font-size: 12px;
}

.state-board {
  min-width: 0;
  border-radius: 12px;
  padding: 10px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.state-item {
  min-width: 0;
  display: grid;
  grid-template-rows: auto 1fr 5px;
  gap: 5px;
  padding: 4px 8px;
  border-left: 1px solid #e5eaf2;
}

.state-item:first-child {
  border-left: 0;
}

.state-item strong {
  font-size: 24px;
  line-height: 1;
}

.state-item b,
.layer-item b {
  display: block;
  height: 5px;
  border-radius: 999px;
  background: #e9eef6;
  overflow: hidden;
}

.state-item b i,
.layer-item b i {
  display: block;
  height: 100%;
  border-radius: inherit;
  animation: growIn 900ms ease both;
}

.orbit-board {
  min-width: 0;
  border-radius: 12px;
  padding: 9px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.orbit-chip {
  position: relative;
  min-width: 0;
  display: grid;
  align-content: center;
  gap: 4px;
  padding: 8px 8px 8px 12px;
  border-radius: 10px;
  background: linear-gradient(145deg, rgba(47, 109, 246, 0.08), rgba(255, 255, 255, 0.7));
  overflow: hidden;
}

.orbit-chip strong {
  font-size: 20px;
  line-height: 1;
}

.orbit-chip i {
  position: absolute;
  right: 8px;
  top: 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: 0 0 13px currentColor;
}

.dash-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(300px, 0.72fr);
  gap: 10px;
}

.left-grid,
.right-grid {
  min-height: 0;
  min-width: 0;
  display: grid;
  gap: 10px;
}

.left-grid {
  grid-template-rows: minmax(0, 1.18fr) minmax(0, 0.82fr);
}

.right-grid {
  grid-template-rows: minmax(0, 1fr) 132px minmax(0, 0.92fr);
}

.panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  overflow: hidden;
}

.constellation-panel {
  background:
    radial-gradient(circle at 42% 46%, rgba(56, 189, 248, 0.18), transparent 30%),
    radial-gradient(circle at 60% 52%, rgba(18, 166, 125, 0.16), transparent 36%),
    linear-gradient(145deg, rgba(5, 13, 32, 0.98), rgba(16, 27, 58, 0.94));
  color: #f8fafc;
}

.panel :deep(.el-card__header) {
  flex: 0 0 34px;
  padding: 7px 10px;
  border-bottom-color: rgba(148, 163, 184, 0.18);
}

.panel :deep(.el-card__body) {
  flex: 1;
  min-height: 0;
  padding: 8px 10px;
}

.panel-title,
.layer-item div,
.alert-row,
.agent-lines div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.panel-title {
  height: 100%;
}

.panel-title strong {
  font-size: 14px;
}

.constellation-body {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px;
  gap: 10px;
}

.constellation-3d {
  position: relative;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-radius: 14px;
  background:
    radial-gradient(circle at 50% 50%, rgba(56, 189, 248, 0.2), transparent 32%),
    radial-gradient(circle at 70% 20%, rgba(139, 92, 246, 0.14), transparent 28%),
    linear-gradient(145deg, rgba(2, 6, 23, 0.66), rgba(15, 23, 42, 0.1));
  border: 1px solid rgba(125, 211, 252, 0.16);
  isolation: isolate;
}

.constellation-3d :deep(canvas) {
  position: absolute;
  inset: 0;
  width: 100% !important;
  height: 100% !important;
  display: block;
}

.scene-hud {
  position: absolute;
  inset: 12px;
  z-index: 2;
  pointer-events: none;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.hud-main,
.hud-status {
  border: 1px solid rgba(125, 211, 252, 0.2);
  background: rgba(2, 6, 23, 0.38);
  box-shadow: 0 14px 28px rgba(2, 6, 23, 0.2);
  backdrop-filter: blur(12px);
}

.hud-main {
  min-width: 112px;
  padding: 10px 12px;
  border-radius: 12px;
  display: grid;
  gap: 2px;
}

.hud-main strong {
  font-size: 30px;
  line-height: 1;
  color: #f8fafc;
}

.hud-main span {
  color: #bfdbfe;
  font-size: 12px;
}

.hud-status {
  height: 34px;
  padding: 0 11px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.hud-status b {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #f59e0b;
  box-shadow: 0 0 16px rgba(245, 158, 11, 0.9);
}

.hud-status b.active {
  background: #22c55e;
  box-shadow: 0 0 16px rgba(34, 197, 94, 0.9);
}

.hud-status span {
  color: #e0f2fe;
  font-size: 12px;
  font-weight: 700;
}

.layer-stack {
  display: grid;
  align-content: center;
  gap: 11px;
}

.constellation-panel .layer-item span {
  color: #cbd5e1;
}

.layer-item {
  display: grid;
  gap: 6px;
}

.chart-pair {
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.status-bars {
  height: 100%;
  min-height: 0;
  display: grid;
  gap: 8px;
  align-content: center;
}

.status-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 42px;
  align-items: center;
  gap: 8px;
}

.status-row span {
  color: #667085;
  font-size: 12px;
}

.status-row strong {
  text-align: right;
  font-size: 13px;
}

.status-row b {
  height: 10px;
  border-radius: 999px;
  background: #edf2f7;
  overflow: hidden;
}

.status-row b i {
  display: block;
  height: 100%;
  border-radius: inherit;
  animation: growIn 900ms ease both;
}

.workload-grid {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  align-content: center;
}

.workload-meter {
  min-height: 0;
  display: grid;
  grid-template-rows: auto auto 8px;
  gap: 4px;
  padding: 8px;
  border-radius: 10px;
  background:
    radial-gradient(circle at 92% 14%, rgba(47, 109, 246, 0.12), transparent 34%),
    rgba(248, 250, 252, 0.78);
  border: 1px solid rgba(47, 109, 246, 0.1);
}

.workload-meter span {
  color: #667085;
  font-size: 12px;
}

.workload-meter strong {
  color: #172033;
  font-size: 17px;
  line-height: 1;
}

.workload-meter b {
  overflow: hidden;
  border-radius: 999px;
  background: #e5eaf2;
}

.workload-meter b i {
  display: block;
  height: 100%;
  border-radius: inherit;
  animation: growIn 900ms ease both;
}

.alert-list {
  height: 100%;
  min-height: 0;
  display: grid;
  gap: 6px;
  align-content: start;
}

.alert-row {
  width: 100%;
  min-height: 34px;
  padding: 7px 9px;
  border: 1px solid #e5eaf2;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.86);
  color: inherit;
  cursor: pointer;
}

.alert-row.warning {
  border-color: #fed7aa;
  background: #fff7ed;
}

.alert-row.danger {
  border-color: #fecaca;
  background: #fff1f2;
}

.alert-row.offline {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.empty-alert {
  height: 100%;
  display: grid;
  place-items: center;
  color: #667085;
  font-size: 13px;
}

.agent-body {
  height: 100%;
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
}

.score-ring {
  width: 84px;
  aspect-ratio: 1;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at center, #fff 56%, transparent 57%),
    conic-gradient(#12a67d 0 var(--score), #e5e7eb var(--score) 100%);
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.04);
}

.score-ring strong {
  font-size: 20px;
}

.agent-lines {
  display: grid;
  gap: 7px;
}

.remote-body {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 7px;
  cursor: pointer;
}

.remote-body img {
  width: 100%;
  height: 100%;
  min-height: 0;
  object-fit: cover;
  border-radius: 9px;
  border: 1px solid rgba(47, 109, 246, 0.16);
}

.remote-empty {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: grid;
  place-items: center;
  border-radius: 9px;
  border: 1px dashed rgba(47, 109, 246, 0.22);
  color: #667085;
  background: rgba(47, 109, 246, 0.05);
  cursor: pointer;
}

.remote-body div {
  display: grid;
  gap: 2px;
}

@keyframes starPulse {
  0%,
  100% {
    opacity: 0.25;
    filter: brightness(1);
  }
  50% {
    opacity: 0.9;
    transform: scale(1.7);
  }
}

@keyframes satelliteBlink {
  0%,
  100% {
    opacity: 0.72;
    filter: brightness(1);
  }
  50% {
    opacity: 1;
    filter: brightness(1.3);
  }
}

@keyframes growIn {
  from {
    width: 0;
  }
}

:global(.is-dark) .dashboard-page {
  background:
    radial-gradient(circle at 18% 8%, rgba(47, 109, 246, 0.26), transparent 28%),
    radial-gradient(circle at 82% 16%, rgba(139, 92, 246, 0.22), transparent 26%),
    linear-gradient(180deg, #07111f 0%, #0d1524 42%, #101827 100%);
  color: #e5e7eb;
}

:global(.is-dark) .mission-core,
:global(.is-dark) .state-board,
:global(.is-dark) .orbit-board,
:global(.is-dark) .panel {
  border-color: rgba(148, 163, 184, 0.22);
  background: rgba(15, 23, 42, 0.72);
}

:global(.is-dark) .score-ring {
  background:
    radial-gradient(circle at center, #0f172a 56%, transparent 57%),
    conic-gradient(#12a67d 0 var(--score), #334155 var(--score) 100%);
}

:global(.is-dark) .alert-row {
  background: rgba(15, 23, 42, 0.86);
}

:global(.is-dark) .workload-meter {
  background:
    radial-gradient(circle at 92% 14%, rgba(96, 165, 250, 0.16), transparent 34%),
    rgba(15, 23, 42, 0.68);
  border-color: rgba(148, 163, 184, 0.18);
}

:global(.is-dark) .workload-meter strong {
  color: #f8fafc;
}

:global(.is-dark) .workload-meter b {
  background: #273449;
}
</style>
