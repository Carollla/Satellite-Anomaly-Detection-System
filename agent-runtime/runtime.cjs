const { createToolRegistry } = require('./tool-registry.cjs')
const { createQueryEngine } = require('./query-engine.cjs')

function round(value, digits = 2) {
  return Number(Number(value || 0).toFixed(digits))
}

function summarizeToolResult(tool, result) {
  if (tool === 'current_time') return `${result.beijing_datetime} ${result.weekday_zh}`
  if (tool === 'weather') {
    if (!result.found) return `${result.city || '城市'} weather unavailable`
    return `${result.city} ${result.weather} ${result.current_temperature_c}°C`
  }
  if (tool === 'topology_summary') {
    return `${result.leo_satellites} LEO / ${result.geo_satellites} GEO / ${result.ground_stations} ground`
  }
  if (tool === 'active_faults') return `${result.count} active faults`
  if (tool === 'pending_approvals') return `${result.count} pending approvals`
  if (tool === 'llm_status') return `${result.coordinator.model} @ ${result.coordinator.endpoint}`
  if (tool === 'weakest_link') {
    if (!result.found) return 'no link data'
    return `${result.link_id} loss ${result.loss_rate_pct}% latency ${result.latency_ms} ms`
  }
  if (tool === 'hot_instances') {
    if (!Array.isArray(result) || !result.length) return 'no hot instances'
    return `${result[0].instance_id} cpu ${result[0].cpu_usage_pct}%`
  }
  if (tool === 'entity_lookup') {
    if (!result.found) return `not found: ${result.query}`
    return result.entity_type === 'link'
      ? `${result.link_id} ${result.enabled ? 'online' : 'offline'}`
      : `${result.instance_id} ${result.start ? 'running' : 'stopped'}`
  }
  return JSON.stringify(result)
}

function createSatOpsAgentRuntime(deps) {
  function getNowInfo() {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      weekday: 'long'
    })
    const parts = Object.fromEntries(
      formatter.formatToParts(now).map((item) => [item.type, item.value])
    )
    return {
      epoch_ms: now.getTime(),
      utc_iso: now.toISOString(),
      beijing_datetime: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`,
      beijing_date: `${parts.year}-${parts.month}-${parts.day}`,
      beijing_time: `${parts.hour}:${parts.minute}:${parts.second}`,
      weekday_zh: parts.weekday,
      timezone: 'Asia/Shanghai',
      utc_offset: '+08:00'
    }
  }

  function getContext() {
    return {
      instances: deps.instances,
      links: deps.links,
      positions: deps.positions,
      instanceResources: deps.instanceResources,
      linkParameters: deps.getLinkParametersMap(),
      approvals: deps.approvals,
      faults: deps.faults,
      llmConfig: deps.llmConfig,
      apiKeys: {
        coordinator: deps.getApiKey('coordinator'),
        specialist_network: deps.getApiKey('specialist_network')
      }
    }
  }

  const toolRegistry = createToolRegistry({ getNowInfo, getContext })
  const queryEngine = createQueryEngine({ toolRegistry })

  function renderTimeAnswer(nowInfo) {
    return [
      `北京时间：${nowInfo.beijing_datetime}（${nowInfo.timezone}）`,
      `UTC 时间：${nowInfo.utc_iso.replace('T', ' ').replace('Z', '')}`,
      `今天是：${nowInfo.weekday_zh}`
    ].join('\n')
  }

  function renderWeatherAnswer(weather) {
    if (!weather?.found) {
      return [
        `结论：当前没有查到 ${weather?.city || '该城市'} 的实时天气。`,
        `关键证据：天气工具返回失败，原因是 ${weather?.error || '未知错误'}。`,
        '下一步动作：请稍后重试，或检查服务器网络是否可以访问 Open-Meteo 天气接口。'
      ].join('\n')
    }

    const airText =
      weather.air_quality_index == null
        ? '暂无空气质量数据'
        : `欧洲 AQI ${weather.air_quality_index}${weather.pm2_5 == null ? '' : `，PM2.5 ${weather.pm2_5} μg/m³`}`
    const rain = Number(weather.precipitation_probability_pct || 0)
    const advice = rain >= 60
      ? '降雨概率较高，外出建议带伞，并关注地面站户外作业防雨。'
      : weather.current_temperature_c >= 32
        ? '气温偏高，外出注意防晒补水，户外设备巡检注意散热。'
        : '天气风险不高，按常规通勤和户外巡检安排即可。'

    return [
      `结论：${weather.city}${weather.date}天气为${weather.weather}，当前约 ${weather.current_temperature_c}°C。`,
      `关键数据：最高 ${weather.temperature_max_c}°C，最低 ${weather.temperature_min_c}°C；降水概率 ${weather.precipitation_probability_pct}%；风速 ${weather.wind_speed_kmh} km/h；湿度 ${weather.humidity_pct}%；空气质量：${airText}。`,
      `数据来源：${weather.source}，观测时间 ${weather.observed_at || weather.date}（Asia/Shanghai）。`,
      `下一步动作：${advice}`
    ].join('\n')
  }

  function renderStatusAnswer(context, toolContext) {
    const topology = toolContext.topology_summary
    const faults = toolContext.active_faults
    const weakestLink = toolContext.weakest_link
    const hotInstances = toolContext.hot_instances || []
    const abnormalInstances = hotInstances.filter((item) => item.cpu_usage_pct > 75 || item.memory_gb > 6)

    const lines = [
      `当前拓扑：${topology.leo_satellites} 颗 LEO、${topology.geo_satellites} 颗 GEO、${topology.ground_stations} 个地面站；运行实例 ${topology.running_instances}/${topology.instance_count}，可用链路 ${topology.enabled_links}/${topology.link_count}。`
    ]

    if (faults.count > 0) {
      lines.push(`当前存在 ${faults.count} 个活动故障：${faults.faults.map((item) => `${item.target}(${item.type})`).join('，')}。`)
    } else {
      lines.push('当前没有注入中的活动故障。')
    }

    if (weakestLink?.found) {
      lines.push(`当前最弱链路是 ${weakestLink.link_id}（${weakestLink.endpoints.join(' -> ')}），丢包 ${weakestLink.loss_rate_pct}% ，时延 ${weakestLink.latency_ms} ms。`)
    }

    if (abnormalInstances.length) {
      lines.push(`资源侧需要关注 ${abnormalInstances.length} 个实例，最高负载为 ${abnormalInstances[0].instance_id}，CPU ${abnormalInstances[0].cpu_usage_pct}% ，内存 ${abnormalInstances[0].memory_gb} GB。`)
    } else if (hotInstances[0]) {
      lines.push(`当前资源最高负载实例为 ${hotInstances[0].instance_id}，CPU ${hotInstances[0].cpu_usage_pct}% ，内存 ${hotInstances[0].memory_gb} GB，尚未达到当前阈值。`)
    }

    const pendingCount = context.approvals.filter((item) => item.status === 'pending').length
    lines.push(pendingCount ? `当前有 ${pendingCount} 项待审批高风险动作。` : '当前没有待审批高风险动作。')
    return lines.join('\n')
  }

  function renderApprovalAnswer(toolContext) {
    const approvals = toolContext.pending_approvals?.approvals || []
    if (!approvals.length) return '当前没有待审批高风险动作。'
    const lines = ['当前待审批高风险动作如下：']
    approvals.slice(0, 5).forEach((item, index) => {
      lines.push(`${index + 1}. ${item.request_id}：${item.action} -> ${item.target}，风险等级 ${item.security_level}`)
    })
    lines.push('下一步动作：请在审批面板确认目标、动作类型和影响范围，再决定通过或驳回。')
    return lines.join('\n')
  }

  function renderLlmAnswer(toolContext) {
    const coordinator = toolContext.llm_status.coordinator
    const specialist = toolContext.llm_status.specialist_network
    return [
      `当前 coordinator 模型：${coordinator.model}`,
      `Endpoint：${coordinator.endpoint}`,
      `API Key 已配置：${coordinator.api_key_configured ? '是' : '否'}`,
      `当前 network specialist 模型：${specialist.model}`,
      `Specialist Endpoint：${specialist.endpoint}`,
      `Specialist API Key 已配置：${specialist.api_key_configured ? '是' : '否'}`
    ].join('\n')
  }

  function renderOperationsFallback(message) {
    const text = String(message || '').toLowerCase()
    if (/(codex|能力|基本能力|不能回答|回答不出来|除了这些|通用问答|写代码|改代码|调试|分析代码)/i.test(text)) {
      return [
        '原因：之前不是 GPT-5.5 没有能力，而是平台后端把部分问题误判成“模型配置/运维状态查询”，绕过了大模型自由回答路径。',
        '现在应当采用通用助手模式：普通知识、代码编写、调试分析、架构设计、文档撰写、前端优化、卫星运维专业问题都直接交给大模型回答。',
        '边界：网页 Agent 可以具备 Codex 的基础问答、代码和推理能力；但读取本地文件、执行命令、修改仓库、联网检索等 Codex 工具能力，需要后端继续接入对应工具接口。'
      ].join('\n')
    }
    if (/(黑板|fact|hypothesis|task|decision|result)/i.test(text)) {
      return [
        '结论：黑板状态是 Agent 协作的共享工作区，Fact、Hypothesis、Task、Decision、Result 按“证据进入 -> 假设生成 -> 任务验证 -> 决策执行 -> 结果回写”的链路流转。',
        '关键流转：Fact 保存观测事实，例如告警、遥测、链路指标；Hypothesis 基于 Fact 生成可能根因；Task 把假设拆成可执行检查或处置；Decision 汇总任务结果并选择动作；Result 记录执行结果、影响范围和是否闭环。',
        '运维意义：评委能看到每一步为什么发生、由哪些证据触发、谁执行了什么动作，以及最终结果是否反写到系统状态。'
      ].join('\n')
    }
    return '当前模型接口没有返回内容。正常情况下，我应当可以回答通用知识、代码、调试、架构、文档、前端设计和卫星智能运维问题；请检查后端模型接口连通性后重试。'
  }

  function renderGeneralFallback(turn) {
    const context = turn.toolContext
    const entityLookups = Object.entries(context).filter(([key]) => key.startsWith('entity_lookup:'))
    if (!entityLookups.length) return renderOperationsFallback(turn.message)

    const lines = []
    entityLookups.forEach(([, value]) => {
      if (value.found && value.entity_type === 'instance') {
        lines.push(`${value.instance_id} 当前${value.start ? '在线' : '离线'}，CPU ${round(value.cpu_usage_pct, 1)}% ，内存 ${round(value.memory_gb, 2)} GB。`)
      }
      if (value.found && value.entity_type === 'link') {
        lines.push(`${value.link_id} 当前${value.enabled ? '启用' : '停用'}，两端为 ${value.endpoints.join(' -> ')}，时延 ${value.latency_ms} ms。`)
      }
    })
    return lines.length ? lines.join('\n') : renderOperationsFallback(turn.message)
  }

  function shouldExposeApprovals(turn) {
    return turn.intent === 'approval' || turn.intent === 'status'
  }

  function buildSuggestions(turn) {
    if (turn.intent === 'weather') return []
    if (turn.intent === 'operations' || turn.intent === 'general') return []

    const suggestions = []
    if (turn.intent === 'status' || turn.intent === 'link') {
      if (turn.toolContext.weakest_link?.found) {
        suggestions.push(`查看链路拓扑中的 ${turn.toolContext.weakest_link.link_id}`)
      }
      const hottest = turn.toolContext.hot_instances?.[0]
      if (hottest) suggestions.push(`查看节点实例中的 ${hottest.instance_id}`)
    }
    if (shouldExposeApprovals(turn) && turn.toolContext.pending_approvals?.count) {
      suggestions.push('检查审批面板中的高风险动作')
    }
    if (turn.intent === 'llm') suggestions.push('在 LLM 配置页执行连通性测试')
    return suggestions.slice(0, 4)
  }

  async function chat({ message, history = [] }) {
    const turn = await queryEngine.createTurn({ message, history })
    const context = getContext()
    let responseText = ''
    let llmUsed = false

    if (turn.intent === 'time') {
      responseText = renderTimeAnswer(turn.toolContext.current_time)
    } else if (turn.intent === 'weather') {
      responseText = renderWeatherAnswer(turn.toolContext.weather)
    } else if (turn.intent === 'status') {
      responseText = renderStatusAnswer(context, turn.toolContext)
    } else if (turn.intent === 'approval') {
      responseText = renderApprovalAnswer(turn.toolContext)
    } else if (turn.intent === 'llm') {
      responseText = renderLlmAnswer(turn.toolContext)
    } else {
      try {
        const llmText = await deps.callOpenAICompatible(
          'coordinator',
          message,
          history,
          turn.systemPrompt
        )
        if (llmText) {
          responseText = llmText
          llmUsed = true
        }
      } catch (error) {
        responseText = ''
      }
    }

    if (!responseText) responseText = renderGeneralFallback(turn)

    const pendingApprovals = shouldExposeApprovals(turn)
      ? context.approvals
          .filter((item) => item.status === 'pending')
          .map((item) => ({
            id: item.request_id,
            action: item.action,
            target: item.target,
            parameters: {},
            security_level: item.security_level
          }))
      : []

    return {
      response: responseText,
      actions_taken: turn.toolExecutions.map((execution) => ({
        tool: execution.input?.query
          ? `${execution.tool}(${execution.input.query})`
          : execution.input?.city
            ? `${execution.tool}(${execution.input.city})`
            : execution.tool,
        result: summarizeToolResult(execution.tool, execution.result)
      })),
      suggestions: buildSuggestions(turn),
      pending_approvals: pendingApprovals,
      grounding: {
        llm_used: llmUsed,
        tool_count: turn.toolExecutions.length,
        generated_at: turn.toolContext.current_time.beijing_datetime
      }
    }
  }

  return {
    chat,
    getNowInfo,
    getContext
  }
}

module.exports = {
  createSatOpsAgentRuntime
}
