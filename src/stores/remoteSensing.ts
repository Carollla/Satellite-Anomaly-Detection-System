import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { satopsApi } from '../api'

export interface RemoteSensingProduct {
  id: string
  satelliteId: string
  satelliteName: string
  area: string
  target: string
  capturedAt: string
  resolution: string
  cloudCover: number | null
  status: 'ready' | 'processing' | 'queued'
  type: 'optical' | 'sar' | 'thermal'
  imageUrl: string
  findings: string[]
  confidence: number | null
}

export interface RemoteSensingTaskInput {
  satelliteId: string
  satelliteName: string
  area: string
  target: string
  latitude: number
  longitude: number
  type: 'optical' | 'sar' | 'thermal'
  priority: 'low' | 'medium' | 'high'
}

function normalizeProduct(response: any, input: RemoteSensingTaskInput): RemoteSensingProduct {
  const now = new Date().toLocaleString('zh-CN', { hour12: false })
  return {
    id: String(response?.id || response?.task_id || `rs-${Date.now()}`),
    satelliteId: String(response?.satellite_id || input.satelliteId),
    satelliteName: String(response?.satellite_name || input.satelliteName),
    area: String(response?.area || input.area || '未选择区域'),
    target: String(response?.target || input.target || ''),
    capturedAt: String(response?.captured_at || response?.created_at || now),
    resolution: String(response?.resolution || ''),
    cloudCover: typeof response?.cloud_cover === 'number' ? response.cloud_cover : null,
    status: response?.status === 'ready' || response?.status === 'processing' ? response.status : 'queued',
    type: response?.type === 'sar' || response?.type === 'thermal' ? response.type : input.type,
    imageUrl: String(response?.image_url || response?.imageUrl || ''),
    findings: Array.isArray(response?.findings) ? response.findings.map(String) : [],
    confidence: typeof response?.confidence === 'number' ? response.confidence : null
  }
}

export const useRemoteSensingStore = defineStore('remoteSensing', () => {
  const products = ref<RemoteSensingProduct[]>([])
  const loading = ref(false)
  const selectedProductId = ref('')

  const latestProducts = computed(() => products.value.slice(0, 4))
  const selectedProduct = computed(() =>
    products.value.find((item) => item.id === selectedProductId.value) || products.value[0]
  )
  const readyCount = computed(() => products.value.filter((item) => item.status === 'ready').length)
  const processingCount = computed(() => products.value.filter((item) => item.status !== 'ready').length)

  async function createTask(input: RemoteSensingTaskInput) {
    loading.value = true
    try {
      const response = await satopsApi.createRemoteSensingTask({
        target_latitude: input.latitude,
        target_longitude: input.longitude,
        task_type: input.type,
        priority: input.priority
      })
      const product = normalizeProduct(response, input)
      products.value.unshift(product)
      selectedProductId.value = product.id
      return product
    } finally {
      loading.value = false
    }
  }

  function selectProduct(id: string) {
    selectedProductId.value = id
  }

  return {
    products,
    loading,
    selectedProductId,
    selectedProduct,
    latestProducts,
    readyCount,
    processingCount,
    createTask,
    selectProduct
  }
})
