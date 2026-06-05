function createQueryEngine({ toolRegistry }) {
  function inferIntent(message) {
    const text = String(message || '').toLowerCase()
    if (/(天气|气温|温度|下雨|降雨|风力|湿度|空气质量|weather|temperature|rain)/i.test(text)) return 'weather'
    if (/(时间|几点|几号|日期|星期|周几|weekday|time|date)/i.test(text)) return 'time'
    if (/(审批|高风险|待审批|批准|approve|approval)/i.test(text)) return 'approval'
    if (/(codex|能力|基本能力|不能回答|回答不出来|除了这些|通用问答|写代码|改代码|调试|分析代码)/i.test(text)) return 'general'
    if (/(执行流|黑板|fact|hypothesis|task|decision|result|根因|处置|编排|任务|回写|agent)/i.test(text)) return 'operations'
    if (/(异常|故障|告警|失联|中断|系统状态|运行状态|健康|是否正常|有没有异常)/i.test(text)) return 'status'
    if (/(模型配置|llm配置|当前模型|使用什么模型|模型连通|连通性|连接测试|测试连接|endpoint|base_url|api key|apikey|openai配置|gpt-5\.5配置)/i.test(text)) return 'llm'
    if (/(链路|topology|拓扑|丢包|时延|jitter|latency|带宽)/i.test(text)) return 'link'
    return 'general'
  }

  function buildToolContext(toolExecutions) {
    const payload = {}
    toolExecutions.forEach((execution) => {
      if (execution.tool === 'entity_lookup') {
        const key = `entity_lookup:${execution.input.query}`
        payload[key] = execution.result
        return
      }
      payload[execution.tool] = execution.result
    })
    return payload
  }

  function buildSystemPrompt({ message, toolExecutions }) {
    const toolContext = JSON.stringify(buildToolContext(toolExecutions), null, 2)
    return [
      '你是 Satellite Ops Agent，是卫星智能运维平台中的智能运维助手。',
      '你的默认模式是通用智能助手，具备接近 Codex 的基础交互能力：解释概念、写代码、改代码建议、调试思路、架构分析、文档撰写、数据分析、方案设计、前端审美建议和卫星智能运维专业问答。',
      '不要把自己限制成只能回答卫星运维模块。除非用户明确询问实时系统状态、天气、审批、链路、模型配置等需要工具的内容，否则直接用大模型知识回答。',
      '回答必须使用中文。根据问题自然组织内容；不要对所有问题机械套用“结论/证据/下一步”。',
      '当用户询问当前系统状态、当前时间、实时链路、实时告警数量、实时任务数量、实时模型连通性、实时天气时，必须依据下面的工具结果回答。',
      '当用户询问概念解释、流程设计、页面设计、黑板机制、执行流、模型配置方法、Agent 工作原理时，可以直接给出完整解释，不要被实时工具结果限制。',
      '只有在用户明确要求实时数据且工具结果没有该实时信息时，才说“当前工具上下文没有该信息”。一般知识、代码、写作、分析类问题不要这样拒答。',
      '天气问题应回答城市、日期、天气现象、当前温度、最高/最低温、降水概率、风速、湿度和简短建议；不要附带无关审批建议。',
      '如果用户要求诊断异常，按“告警现象 -> 关键证据 -> 根因排序 -> 运维编排 -> 结果回写”的逻辑回答。',
      '如果用户要求优化页面，按“一屏展示、关键数据优先、无文字重叠、不要无用内容、逻辑清晰”的标准提出修改。',
      '如果用户要求模型配置，重点说明模型版本、阈值、特征窗口、置信度、评估指标、回退版本和影响范围。',
      '如果用户问你是否具备 Codex 的能力，要明确区分：当前聊天模型可以完成推理、代码、调试、解释和方案设计；但像读取本地文件、执行命令、修改仓库、联网检索这类 Codex 工具能力，只有后端实现并授权对应工具后才能在网页 Agent 中执行。',
      `用户问题：${message}`,
      '本轮已经执行过的工具结果 JSON：',
      toolContext
    ].join('\n')
  }

  async function createTurn({ message, history = [] }) {
    const toolExecutions = await toolRegistry.runTools(message)
    return {
      message,
      history,
      intent: inferIntent(message),
      toolExecutions,
      toolContext: buildToolContext(toolExecutions),
      systemPrompt: buildSystemPrompt({ message, toolExecutions })
    }
  }

  return {
    createTurn
  }
}

module.exports = {
  createQueryEngine
}
