function formatBytesToGb(bytes) {
  return Number(bytes || 0) / 1024 / 1024 / 1024
}

function round(value, digits = 2) {
  return Number(Number(value || 0).toFixed(digits))
}

function weatherCodeLabel(code) {
  const labels = {
    0: '晴',
    1: '大部晴朗',
    2: '局部多云',
    3: '阴',
    45: '雾',
    48: '雾凇',
    51: '小毛毛雨',
    53: '中等毛毛雨',
    55: '大毛毛雨',
    56: '冻毛毛雨',
    57: '强冻毛毛雨',
    61: '小雨',
    63: '中雨',
    65: '大雨',
    66: '冻雨',
    67: '强冻雨',
    71: '小雪',
    73: '中雪',
    75: '大雪',
    77: '雪粒',
    80: '小阵雨',
    81: '中等阵雨',
    82: '强阵雨',
    85: '小阵雪',
    86: '强阵雪',
    95: '雷暴',
    96: '雷暴伴小冰雹',
    99: '雷暴伴强冰雹'
  }
  return labels[Number(code)] || `天气代码 ${code}`
}

function inferIntent(message) {
  const text = String(message || '').toLowerCase()
  if (/(天气|气温|温度|下雨|降雨|风力|湿度|空气质量|weather|temperature|rain)/i.test(text)) return 'weather'
  if (/(时间|几点|几号|日期|星期|周几|weekday|time|date)/i.test(text)) return 'time'
  if (/(审批|高风险|待审批|批准|approve|approval)/i.test(text)) return 'approval'
  if (/(codex|能力|基本能力|不能回答|回答不出来|除了这些|通用问答|写代码|改代码|调试|分析代码)/i.test(text)) return 'general'
  if (/(异常|故障|告警|失联|中断|系统状态|运行状态|健康|是否正常|有没有异常)/i.test(text)) return 'status'
  if (/(模型配置|llm配置|当前模型|使用什么模型|模型连通|连通性|连接测试|测试连接|endpoint|base_url|api key|apikey|openai配置|gpt-5\.5配置)/i.test(text)) return 'llm'
  if (/(链路|topology|拓扑|丢包|时延|jitter|latency|带宽)/i.test(text)) return 'link'
  if (/(执行流|黑板|fact|hypothesis|task|decision|result|根因|处置|编排|任务|回写|agent)/i.test(text)) return 'operations'
  return 'general'
}

function createToolRegistry(deps) {
  function getContext() {
    return deps.getContext()
  }

  function getNowInfo() {
    return deps.getNowInfo()
  }

  const knownCities = {
    长沙: { name: '长沙', latitude: 28.2282, longitude: 112.9388, country: '中国' },
    北京: { name: '北京', latitude: 39.9042, longitude: 116.4074, country: '中国' },
    上海: { name: '上海', latitude: 31.2304, longitude: 121.4737, country: '中国' },
    广州: { name: '广州', latitude: 23.1291, longitude: 113.2644, country: '中国' },
    深圳: { name: '深圳', latitude: 22.5431, longitude: 114.0579, country: '中国' },
    武汉: { name: '武汉', latitude: 30.5928, longitude: 114.3055, country: '中国' },
    成都: { name: '成都', latitude: 30.5728, longitude: 104.0668, country: '中国' },
    西安: { name: '西安', latitude: 34.3416, longitude: 108.9398, country: '中国' },
    南京: { name: '南京', latitude: 32.0603, longitude: 118.7969, country: '中国' },
    杭州: { name: '杭州', latitude: 30.2741, longitude: 120.1551, country: '中国' }
  }

  function extractWeatherCity(message) {
    const text = String(message || '').replace(/\s+/g, '')
    const known = Object.keys(knownCities).find((city) => text.includes(city))
    if (known) return known

    const match = text.match(/([\u4e00-\u9fa5]{2,8})(?:今天|今日|明天|后天)?(?:的)?(?:天气|气温|温度|降雨|下雨|空气质量)/)
    if (match?.[1]) {
      return match[1]
        .replace(/今天|今日|明天|后天|现在|当前|查询|请问|一下|怎么样|如何/g, '')
        .slice(-4)
    }

    return '长沙'
  }

  async function fetchJson(url, timeoutMs = 8000) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const resp = await fetch(url, { signal: controller.signal })
      if (!resp.ok) {
        const body = await resp.text().catch(() => '')
        throw new Error(`HTTP ${resp.status} ${body.slice(0, 120)}`)
      }
      return await resp.json()
    } finally {
      clearTimeout(timer)
    }
  }

  async function resolveCity(cityName) {
    if (knownCities[cityName]) return knownCities[cityName]

    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=zh&format=json`
    const data = await fetchJson(url)
    const city = data?.results?.[0]
    if (!city) return null
    return {
      name: city.name || cityName,
      latitude: city.latitude,
      longitude: city.longitude,
      country: city.country || '',
      admin1: city.admin1 || ''
    }
  }

  const tools = {
    current_time: {
      description: 'Return the real current time in Asia/Shanghai and UTC.',
      run() {
        return getNowInfo()
      }
    },
    weather: {
      description: 'Return current weather and daily forecast for a city.',
      async run(input = {}) {
        const cityName = input.city || '长沙'
        try {
          const city = await resolveCity(cityName)
          if (!city) return { found: false, city: cityName, error: '无法解析城市坐标' }

          const forecastUrl = [
            'https://api.open-meteo.com/v1/forecast',
            `?latitude=${encodeURIComponent(city.latitude)}`,
            `&longitude=${encodeURIComponent(city.longitude)}`,
            '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
            '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
            '&timezone=Asia%2FShanghai'
          ].join('')
          const airUrl = [
            'https://air-quality-api.open-meteo.com/v1/air-quality',
            `?latitude=${encodeURIComponent(city.latitude)}`,
            `&longitude=${encodeURIComponent(city.longitude)}`,
            '&current=european_aqi,pm2_5',
            '&timezone=Asia%2FShanghai'
          ].join('')

          const [forecast, airQuality] = await Promise.all([
            fetchJson(forecastUrl),
            fetchJson(airUrl).catch((error) => ({ error: error.message }))
          ])

          const current = forecast.current || {}
          const daily = forecast.daily || {}
          const air = airQuality.current || {}
          const code = current.weather_code ?? daily.weather_code?.[0]

          return {
            found: true,
            source: 'Open-Meteo',
            city: city.name || cityName,
            country: city.country || '',
            admin1: city.admin1 || '',
            date: String((current.time || daily.time?.[0] || getNowInfo().beijing_date)).slice(0, 10),
            observed_at: current.time || null,
            weather_code: code,
            weather: weatherCodeLabel(code),
            current_temperature_c: round(current.temperature_2m, 1),
            temperature_max_c: round(daily.temperature_2m_max?.[0], 1),
            temperature_min_c: round(daily.temperature_2m_min?.[0], 1),
            precipitation_probability_pct: round(daily.precipitation_probability_max?.[0], 0),
            wind_speed_kmh: round(current.wind_speed_10m, 1),
            humidity_pct: round(current.relative_humidity_2m, 0),
            air_quality_index: air.european_aqi == null ? null : round(air.european_aqi, 0),
            pm2_5: air.pm2_5 == null ? null : round(air.pm2_5, 1)
          }
        } catch (error) {
          return {
            found: false,
            city: cityName,
            error: error.message || '天气查询失败'
          }
        }
      }
    },
    topology_summary: {
      description: 'Summarize live topology and running state.',
      run() {
        const context = getContext()
        const runningInstances = context.instances.filter((item) => item.start).length
        const enabledLinks = context.links.filter((item) => item.enable).length
        const satellites = context.instances.filter((item) => item.type === 'satellite')
        const leo = satellites.filter((item) => item.instance_id.startsWith('sat-')).length
        const geo = satellites.filter((item) => item.instance_id.startsWith('geo-')).length
        const groundStations = context.instances.filter((item) => item.type === 'ground-station').length
        return {
          instance_count: context.instances.length,
          running_instances: runningInstances,
          link_count: context.links.length,
          enabled_links: enabledLinks,
          leo_satellites: leo,
          geo_satellites: geo,
          ground_stations: groundStations
        }
      }
    },
    active_faults: {
      description: 'List currently injected faults and impacted targets.',
      run() {
        const context = getContext()
        return {
          count: context.faults.length,
          faults: context.faults.map((fault) => ({
            target: fault.target,
            type: fault.type,
            status: fault.status || 'active',
            parameters: fault.parameters || {}
          }))
        }
      }
    },
    pending_approvals: {
      description: 'List pending high risk operations awaiting approval.',
      run() {
        const context = getContext()
        return {
          count: context.approvals.filter((item) => item.status === 'pending').length,
          approvals: context.approvals
            .filter((item) => item.status === 'pending')
            .map((item) => ({
              request_id: item.request_id,
              action: item.action,
              target: item.target,
              security_level: item.security_level
            }))
        }
      }
    },
    llm_status: {
      description: 'Return live LLM endpoint and key wiring state.',
      run() {
        const context = getContext()
        return {
          coordinator: {
            model: context.llmConfig.coordinator.model,
            endpoint: context.llmConfig.coordinator.endpoint,
            api_key_configured: Boolean(context.apiKeys.coordinator)
          },
          specialist_network: {
            model: context.llmConfig.specialist_network.model,
            endpoint: context.llmConfig.specialist_network.endpoint,
            api_key_configured: Boolean(context.apiKeys.specialist_network)
          }
        }
      }
    },
    weakest_link: {
      description: 'Return the most degraded link according to live loss and latency.',
      run() {
        const context = getContext()
        const linkEntries = Object.entries(context.linkParameters || {})
        if (!linkEntries.length) return { found: false }

        const [linkId, params] = linkEntries.sort((a, b) => {
          const scoreA = Number(a[1].loss_rate || 0) * 1000 + Number(a[1].latency_ms || 0)
          const scoreB = Number(b[1].loss_rate || 0) * 1000 + Number(b[1].latency_ms || 0)
          return scoreB - scoreA
        })[0]

        const link = context.links.find((item) => item.link_id === linkId)
        return {
          found: true,
          link_id: linkId,
          link_type: link?.type || 'unknown',
          endpoints: link?.connect_instance || [],
          enabled: Boolean(link?.enable),
          loss_rate_pct: round(Number(params.loss_rate || 0) * 100, 2),
          latency_ms: round(params.latency_ms || 0, 1),
          jitter_ms: round(params.jitter_ms || 0, 1),
          bandwidth_mbps: round(params.bandwidth_mbps || 0, 1)
        }
      }
    },
    hot_instances: {
      description: 'Return busiest instances by current CPU and memory.',
      run() {
        const context = getContext()
        return Object.entries(context.instanceResources)
          .sort((a, b) => Number(b[1].cpu_usage || 0) - Number(a[1].cpu_usage || 0))
          .slice(0, 5)
          .map(([instanceId, metrics]) => ({
            instance_id: instanceId,
            cpu_usage_pct: round(metrics.cpu_usage || 0, 1),
            memory_gb: round(formatBytesToGb(metrics.mem_byte), 2),
            swap_gb: round(formatBytesToGb(metrics.swap_mem_byte), 2)
          }))
      }
    },
    entity_lookup: {
      description: 'Look up live state for a specific satellite, ground station, or link.',
      run(input = {}) {
        const context = getContext()
        const query = String(input.query || '').toLowerCase()
        const instance = context.instances.find((item) => item.instance_id.toLowerCase() === query)
        if (instance) {
          const metrics = context.instanceResources[instance.instance_id] || {}
          const position = context.positions[instance.instance_id] || null
          return {
            found: true,
            entity_type: 'instance',
            instance_id: instance.instance_id,
            start: Boolean(instance.start),
            cpu_usage_pct: round(metrics.cpu_usage || 0, 1),
            memory_gb: round(formatBytesToGb(metrics.mem_byte), 2),
            position
          }
        }

        const link = context.links.find((item) => item.link_id.toLowerCase() === query)
        if (link) {
          const params = context.linkParameters[link.link_id] || {}
          return {
            found: true,
            entity_type: 'link',
            link_id: link.link_id,
            enabled: Boolean(link.enable),
            endpoints: link.connect_instance,
            link_type: link.type,
            loss_rate_pct: round(Number(params.loss_rate || 0) * 100, 2),
            latency_ms: round(params.latency_ms || 0, 1)
          }
        }

        return { found: false, query }
      }
    }
  }

  function extractEntityIds(message) {
    const text = String(message || '').toLowerCase()
    const matches = text.match(/\b(?:sat|geo)-\d{3}\b|\blink-\d{3}\b|\bground-[a-z0-9-]+\b/g) || []
    return [...new Set(matches)]
  }

  function selectTools(message) {
    const intent = inferIntent(message)
    const selected = new Set(['current_time'])

    if (intent === 'weather') {
      selected.add('weather')
      return [...selected]
    }

    if (intent === 'status') {
      selected.add('topology_summary')
      selected.add('active_faults')
      selected.add('weakest_link')
      selected.add('hot_instances')
      selected.add('pending_approvals')
    }

    if (intent === 'approval') selected.add('pending_approvals')
    if (intent === 'llm') selected.add('llm_status')
    if (intent === 'link') {
      selected.add('topology_summary')
      selected.add('weakest_link')
    }

    extractEntityIds(message).forEach(() => selected.add('entity_lookup'))
    return [...selected]
  }

  async function runTools(message) {
    const names = selectTools(message)
    const entityIds = extractEntityIds(message)
    const city = extractWeatherCity(message)
    const executions = []

    for (const name of names) {
      if (name === 'entity_lookup' && entityIds.length) {
        for (const entityId of entityIds) {
          executions.push({
            tool: name,
            input: { query: entityId },
            result: await tools[name].run({ query: entityId })
          })
        }
        continue
      }

      if (name === 'weather') {
        executions.push({
          tool: name,
          input: { city },
          result: await tools[name].run({ city })
        })
        continue
      }

      executions.push({
        tool: name,
        input: null,
        result: await tools[name].run()
      })
    }

    return executions
  }

  return {
    tools,
    selectTools,
    runTools
  }
}

module.exports = {
  createToolRegistry
}
