import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { positionApi } from '../api'
import { mockPositions } from '../api/mock-data'
import { useInstanceStore } from './instance'
import { useLinkStore } from './link'

export interface Satellite {
  id: number
  name: string
  code: string
  instanceId: string
  status: 'normal' | 'warning' | 'danger' | 'offline'
  alt: number
  cpu: number
  temp: number
  inclination: number
  baseLon: number
  phase: number
  faultType?: string
}

const CONSTALLATION_LIMIT = 600

function getLayerFromAltitude(alt: number) {
  if (alt >= 30000000) return 'GEO'
  if (alt >= 20000000) return 'MEO'
  return 'LEO'
}

function getDefaultAltitudeByLayer(layer: 'LEO' | 'MEO' | 'GEO') {
  if (layer === 'GEO') return 35786000
  if (layer === 'MEO') return 21500000
  return 550000
}

function generateArchitecture(): Satellite[] {
  const sats: Satellite[] = []
  let idCounter = 1

  const pushShell = (options: {
    prefix: string
    instancePrefix: string
    altitude: number
    inclination: number
    planeCount: number
    satPerPlane: number
  }) => {
    for (let p = 0; p < options.planeCount; p++) {
      const planeLon = (p / options.planeCount) * 360 - 180
      for (let s = 0; s < options.satPerPlane; s++) {
        const phase = (s / options.satPerPlane) * 360
        sats.push({
          id: idCounter,
          name: `${options.prefix}-${p + 1}-${s + 1}`,
          code: `${options.prefix}-${idCounter}`,
          instanceId: `${options.instancePrefix}-${idCounter}`,
          status: 'normal',
          alt: options.altitude,
          inclination: options.inclination,
          baseLon: planeLon,
          phase,
          cpu: 20,
          temp: 35
        })
        idCounter++
      }
    }
  }

  pushShell({
    prefix: 'LEO-A',
    instancePrefix: 'sat-leo-a',
    altitude: 550000,
    inclination: 53,
    planeCount: 24,
    satPerPlane: 10
  })

  pushShell({
    prefix: 'LEO-B',
    instancePrefix: 'sat-leo-b',
    altitude: 530000,
    inclination: 97.6,
    planeCount: 12,
    satPerPlane: 22
  })

  pushShell({
    prefix: 'LEO-C',
    instancePrefix: 'sat-leo-c',
    altitude: 760000,
    inclination: 86.4,
    planeCount: 6,
    satPerPlane: 8
  })

  pushShell({
    prefix: 'MEO',
    instancePrefix: 'sat-meo',
    altitude: 21500000,
    inclination: 55,
    planeCount: 4,
    satPerPlane: 8
  })

  ;Array.from({ length: 16 }, (_, i) => i * 22.5).forEach((lon, i) => {
    sats.push({
      id: idCounter,
      name: `GEO-${i + 1}`,
      code: `GEO-${idCounter}`,
      instanceId: `sat-geo-${idCounter}`,
      status: 'normal',
      alt: 35786000,
      inclination: 0,
      baseLon: lon,
      phase: 0,
      cpu: 20,
      temp: 35
    })
    idCounter++
  })

  return sats
}

export const useSatelliteStore = defineStore('satellite', () => {
  const instanceStore = useInstanceStore()
  const linkStore = useLinkStore()
  
  const defaultArchitecture = generateArchitecture()
  const satellites = ref<Satellite[]>([])
  const constellationCount = ref(CONSTALLATION_LIMIT)
  
  const positions = ref<Record<string, { latitude: number; longitude: number; altitude: number }>>({})
  const positionSource = ref<'mock-server' | 'local-fallback'>('mock-server')

  const saveToStorage = () => {
    const edits: Record<number, Partial<Satellite>> = {}
    const customs: Satellite[] = []
    
    satellites.value.forEach(sat => {
      const def = defaultArchitecture.find(d => d.id === sat.id)
      if (def) {
        // Find changes
        let hasChanges = false
        const changes: any = {}
        for (const k of ['name', 'status', 'alt', 'inclination', 'baseLon', 'phase', 'faultType'] as const) {
          if (sat[k] !== def[k]) {
            hasChanges = true
            changes[k] = sat[k]
          }
        }
        if (hasChanges) edits[sat.id] = changes
      } else {
        customs.push(sat)
      }
    })
    
    localStorage.setItem('satellite-edits-v2', JSON.stringify(edits))
    localStorage.setItem('satellite-customs-v2', JSON.stringify(customs))
  }

  const initSatellites = () => {
    const savedEditsStr = localStorage.getItem('satellite-edits-v2')
    const savedEdits = savedEditsStr ? JSON.parse(savedEditsStr) : {}

    const savedCustomsStr = localStorage.getItem('satellite-customs-v2')
    const savedCustoms = savedCustomsStr ? JSON.parse(savedCustomsStr) : []

    const list = defaultArchitecture.map(sat => {
      if (savedEdits[sat.id]) {
        return { ...sat, ...savedEdits[sat.id] }
      }
      return sat
    })
    
    list.push(...savedCustoms)
    satellites.value = list
    constellationCount.value = Math.min(list.length, CONSTALLATION_LIMIT)
  }
  
  // Call initialization
  initSatellites()

  // Update real-time hardware status without blowing away architecture
  const updateSatellitesFromInstances = () => {
    const satelliteInstances = instanceStore.instancesForDisplay.filter((inst) =>
      inst.type.toLowerCase().includes('satellite')
    )

    satellites.value.forEach((sat) => {
      const inst = satelliteInstances.find((i) => i.id === sat.instanceId)
      if (inst) {
        const relatedLinks = linkStore.linksForDisplay.filter((link) => link.endpoints.includes(inst.id))
        const hasDangerLink = relatedLinks.some((link) => link.status === 'danger' || !link.enabled)
        const hasWarningLink = relatedLinks.some((link) => link.status === 'warning')
        const derivedStatus: Satellite['status'] =
          inst.status === 'offline'
            ? 'offline'
            : inst.status === 'danger' || hasDangerLink
              ? 'danger'
              : inst.status === 'warning' || hasWarningLink
                ? 'warning'
                : 'normal'

        // Only override if the user didn't hardcode a warning/danger state manually?
        // Let's just always sync runtime state here, except we preserve user manual states if they edited it?
        // Actually, just update dynamic fields:
        sat.cpu = inst.cpu
        sat.temp = 30 + (Math.max(inst.cpu, derivedStatus === 'danger' ? 96 : derivedStatus === 'warning' ? 78 : inst.cpu) / 100) * 30
      }
    })
  }

  watch(
    () => [instanceStore.instancesForDisplay, linkStore.linksForDisplay],
    () => {
      updateSatellitesFromInstances()
    },
    { deep: true, immediate: true }
  )

  const fetchPositions = async () => {
    try {
      positions.value = await positionApi.getAll()
      positionSource.value = 'mock-server'
    } catch {
      positions.value = mockPositions
      positionSource.value = 'local-fallback'
    } finally {
      updateSatellitesFromInstances()
    }
  }

  const selectedSatelliteId = ref<number | null>(null)

  const selectedSatellite = computed(() =>
    satellites.value.find((item) => item.id === selectedSatelliteId.value)
  )

  const addSatellite = (sat: Partial<Satellite>) => {
    const newId = satellites.value.length > 0 ? Math.max(...satellites.value.map(s => s.id)) + 1 : 1
    const newSat: Satellite = {
      id: newId,
      name: sat.name || `自定义卫星-${newId}`,
      code: sat.code || `CUSTOM-${newId}`,
      instanceId: `custom-sat-${newId}`,
      status: sat.status || 'normal',
      inclination: sat.inclination || 0,
      baseLon: sat.baseLon || 0,
      phase: sat.phase || 0,
      alt: sat.alt || 500000,
      cpu: sat.cpu || 20,
      temp: sat.temp || 30,
      faultType: sat.faultType || 'none'
    }
    satellites.value.push(newSat)
    constellationCount.value = satellites.value.length
    saveToStorage()
    return newSat
  }

  const updateSatellite = (id: number, data: Partial<Satellite>) => {
    const idx = satellites.value.findIndex(s => s.id === id)
    if (idx !== -1) {
      satellites.value[idx] = { ...satellites.value[idx], ...data }
      saveToStorage()
    }
  }

  const deleteSatellite = (id: number) => {
    const idx = satellites.value.findIndex(s => s.id === id)
    if (idx !== -1) {
      satellites.value.splice(idx, 1)
      if (selectedSatelliteId.value === id) {
        selectedSatelliteId.value = null
      }
      constellationCount.value = satellites.value.length
      saveToStorage()
    }
  }

  const restoreSatellite = (id: number) => {
    const def = defaultArchitecture.find(d => d.id === id)
    if (def) {
      const idx = satellites.value.findIndex(s => s.id === id)
      if (idx !== -1) {
        satellites.value[idx] = { ...def }
        saveToStorage()
      }
    }
  }

  const setConstellationCount = (count: number) => {
    const nextCount = Math.max(1, Math.min(CONSTALLATION_LIMIT, Math.round(count)))
    const preservedEdits = new Map<number, Partial<Satellite>>()
    satellites.value.forEach((sat) => {
      const def = defaultArchitecture.find((item) => item.id === sat.id)
      if (def) {
        const changes: Partial<Satellite> = {}
        if (sat.name !== def.name) changes.name = sat.name
        if (sat.status !== def.status) changes.status = sat.status
        if (sat.alt !== def.alt) changes.alt = sat.alt
        if (sat.inclination !== def.inclination) changes.inclination = sat.inclination
        if (sat.baseLon !== def.baseLon) changes.baseLon = sat.baseLon
        if (sat.phase !== def.phase) changes.phase = sat.phase
        if (sat.faultType !== def.faultType) changes.faultType = sat.faultType
        if (Object.keys(changes).length) {
          preservedEdits.set(sat.id, changes)
        }
      }
    })

    satellites.value = defaultArchitecture.slice(0, nextCount).map((sat) => ({
      ...sat,
      ...(preservedEdits.get(sat.id) || {})
    }))
    constellationCount.value = satellites.value.length
    if (selectedSatelliteId.value && !satellites.value.some((item) => item.id === selectedSatelliteId.value)) {
      selectedSatelliteId.value = null
    }
    saveToStorage()
  }

  const setLayerAltitude = (layer: 'LEO' | 'MEO' | 'GEO', altitude: number) => {
    const targetAlt = Math.max(100000, Math.round(altitude / 1000) * 1000)
    satellites.value = satellites.value.map((sat) => {
      const currentLayer = getLayerFromAltitude(sat.alt)
      if (currentLayer !== layer) return sat
      return {
        ...sat,
        alt: targetAlt
      }
    })
    saveToStorage()
  }

  const normalizeAllAltitudes = () => {
    satellites.value = satellites.value.map((sat) => ({
      ...sat,
      alt: getDefaultAltitudeByLayer(getLayerFromAltitude(sat.alt))
    }))
    saveToStorage()
  }

  return {
    satellites,
    constellationCount,
    positions,
    positionSource,
    selectedSatelliteId,
    selectedSatellite,
    addSatellite,
    updateSatellite,
    deleteSatellite,
    restoreSatellite,
    setConstellationCount,
    setLayerAltitude,
    normalizeAllAltitudes,
    updateSatellitesFromInstances,
    fetchPositions
  }
})
