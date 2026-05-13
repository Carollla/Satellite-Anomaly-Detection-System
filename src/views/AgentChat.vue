<template>
  <div class="agent-page">
    <header class="agent-head">
      <div>
        <span>Anomaly Monitoring Agent</span>
        <h1>异常监测 Agent</h1>
      </div>
      <div class="head-actions">
        <el-tag :type="status?.coordinator.status === 'online' ? 'success' : 'warning'">
          {{ status?.coordinator.status === 'online' ? '在线' : '未连接' }}
        </el-tag>
        <el-button size="small" :loading="loading" @click="refreshAll">刷新</el-button>
        <el-button size="small" type="primary" :loading="sending" @click="sendMessage">运行诊断</el-button>
      </div>
    </header>

    <section class="top-grid">
      <article v-for="item in summaryCards" :key="item.label" class="summary-item">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <em>{{ item.desc }}</em>
      </article>
    </section>

    <section class="agent-grid">
      <main class="work-panel panel">
        <div class="panel-head">
          <h3>诊断任务</h3>
          <el-select v-model="agentType" size="small" class="agent-select">
            <el-option label="协调器" value="coordinator" />
            <el-option label="网络专家" value="network" />
            <el-option label="健康专家" value="health" />
            <el-option label="运维专家" value="ops" />
            <el-option label="安全专家" value="security" />
          </el-select>
        </div>
        <div class="quick-actions">
          <el-button v-for="item in quickPrompts" :key="item" size="small" plain @click="message = item">
            {{ item }}
          </el-button>
        </div>
        <el-input
          v-model="message"
          type="textarea"
          :rows="4"
          resize="none"
          placeholder="输入真实排障问题，例如：分析当前离线卫星和链路影响范围"
        />
        <div class="run-row">
          <el-checkbox v-model="continueTrace" :disabled="!currentTraceId">续接 Trace</el-checkbox>
          <el-button size="small" @click="message = ''">清空</el-button>
        </div>

        <div class="result-grid">
          <section class="result-box">
            <div class="mini-head">
              <strong>诊断结果</strong>
              <span>{{ messages[0]?.time || '-' }}</span>
            </div>
            <div class="answer-text">{{ latestAnswer }}</div>
            <div class="suggestions">
              <el-tag v-for="item in latestSuggestions" :key="item" size="small">{{ item }}</el-tag>
            </div>
          </section>
          <section class="result-box">
            <div class="mini-head">
              <strong>执行 Trace</strong>
              <span>{{ trace?.current_phase || 'idle' }}</span>
            </div>
            <div class="trace-list">
              <div v-for="item in traceRows" :key="`${item.assignee}-${item.task}`" class="trace-row">
                <span>{{ item.task }}</span>
                <el-tag size="small" :type="statusTagType(item.status)">{{ item.status }}</el-tag>
              </div>
              <div v-if="!traceRows.length" class="empty-state">等待任务</div>
            </div>
          </section>
        </div>
      </main>

      <aside class="config-stack">
        <section class="panel config-panel">
          <div class="panel-head">
            <h3>大模型 API</h3>
            <el-button size="small" text type="primary" :loading="testing" @click="testLlm">测试</el-button>
          </div>
          <div class="config-grid">
            <label>
              <span>Provider</span>
              <el-input v-model="llmForm.provider" size="small" placeholder="openai / ollama / custom" />
            </label>
            <label>
              <span>API 地址</span>
              <el-input v-model="llmForm.endpoint" size="small" placeholder="https://..." />
            </label>
            <label>
              <span>模型</span>
              <el-input v-model="llmForm.model" size="small" placeholder="model name" />
            </label>
            <label>
              <span>API Key</span>
              <el-input v-model="llmForm.apiKey" size="small" type="password" show-password placeholder="真实密钥" />
            </label>
          </div>
          <div class="model-row">
            <el-input-number v-model="llmForm.temperature" size="small" :min="0" :max="2" :step="0.1" />
            <el-input-number v-model="llmForm.maxTokens" size="small" :min="128" :max="8192" :step="128" />
            <el-button size="small" type="primary" :loading="savingConfig" @click="saveLlmConfig">保存</el-button>
          </div>
        </section>

        <section class="panel feature-panel">
          <div class="panel-head">
            <h3>Agent 功能</h3>
            <el-button size="small" text type="primary" :loading="savingConfig" @click="saveAgentConfig">保存</el-button>
          </div>
          <div class="feature-grid">
            <label v-for="item in featureOptions" :key="item.key" class="feature-item">
              <span>{{ item.label }}</span>
              <el-switch v-model="agentFeatures[item.key]" size="small" />
            </label>
          </div>
          <div class="agent-settings">
            <el-select v-model="agentConfig.default_agent" size="small">
              <el-option label="协调器" value="coordinator" />
              <el-option label="网络专家" value="network" />
              <el-option label="健康专家" value="health" />
              <el-option label="安全专家" value="security" />
            </el-select>
            <el-input-number v-model="agentConfig.max_steps" size="small" :min="1" :max="20" />
          </div>
        </section>

        <section class="panel anomaly-panel">
          <div class="panel-head">
            <h3>当前异常</h3>
            <el-tag size="small" type="warning">{{ anomalyCards.length }}</el-tag>
          </div>
          <div class="anomaly-list">
            <div v-for="item in anomalyCards" :key="item.title" class="anomaly-row">
              <strong>{{ item.title }}</strong>
              <span>{{ item.solution }}</span>
            </div>
          </div>
        </section>

        <section class="panel approval-panel">
          <div class="panel-head">
            <h3>审批</h3>
            <el-button size="small" text @click="refreshApprovals">刷新</el-button>
          </div>
          <div class="approval-list">
            <div v-for="approval in approvals.slice(0, 2)" :key="approval.request_id" class="approval-row">
              <strong>{{ approval.action }}</strong>
              <div>
                <el-button size="small" @click="decideApproval(approval.request_id, 'reject')">驳回</el-button>
                <el-button size="small" type="primary" @click="decideApproval(approval.request_id, 'approve')">通过</el-button>
              </div>
            </div>
            <div v-if="!approvals.length" class="empty-state">暂无待审批</div>
          </div>
        </section>
      </aside>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { agentApi, llmApi, satopsApi } from '../api'
import type { AgentStatus, ApprovalRequest, TraceDetail } from '../api/types'
import { usePolling } from '../composables/usePolling'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  agentLabel: string
  content: string
  time: string
  suggestions?: string[]
}

const quickPrompts = ['分析当前卫星告警', '检查链路中断影响', '评估星上算力负载', '生成处置审批建议']
const featureOptions = [
  { key: 'anomaly_detection', label: '异常检测' },
  { key: 'root_cause', label: '根因分析' },
  { key: 'auto_recovery', label: '自动处置' },
  { key: 'audit_required', label: '审计审批' },
  { key: 'semantic_compression', label: '语义压缩' },
  { key: 'remote_sensing', label: '遥感联动' }
] as const

const loading = ref(false)
const sending = ref(false)
const testing = ref(false)
const savingConfig = ref(false)
const continueTrace = ref(true)
const agentType = ref('coordinator')
const message = ref('')
const currentTraceId = ref('')
const status = ref<AgentStatus | null>(null)
const trace = ref<TraceDetail | null>(null)
const approvals = ref<ApprovalRequest[]>([])
const llmRawConfig = ref<Record<string, any>>({})
const agentRawConfig = ref<Record<string, any>>({})

const llmForm = reactive({
  provider: '',
  endpoint: '',
  model: '',
  apiKey: '',
  temperature: 0.2,
  maxTokens: 2048
})
const agentConfig = reactive({
  default_agent: 'coordinator',
  max_steps: 8
})
const agentFeatures = reactive<Record<string, boolean>>({
  anomaly_detection: true,
  root_cause: true,
  auto_recovery: false,
  audit_required: true,
  semantic_compression: true,
  remote_sensing: true
})

const messages = ref<ChatMessage[]>([
  {
    id: 'welcome',
    role: 'assistant',
    agentLabel: 'Coordinator',
    content: '等待真实诊断任务。配置大模型 API 后，可以调用后端 Agent 服务进行异常分析。',
    time: dayjs().format('HH:mm:ss')
  }
])

const summaryCards = computed(() => [
  { label: '协调器', value: status.value?.coordinator.status || 'unknown', desc: status.value?.coordinator.model || '-' },
  { label: '专家 Agent', value: status.value?.specialists.length ?? 0, desc: '后端返回' },
  { label: '星上 Agent', value: status.value?.edge_agents.length ?? 0, desc: '后端返回' },
  { label: '待审批', value: approvals.value.length, desc: '真实审批队列' }
])
const latestAnswer = computed(() => messages.value.find((item) => item.role === 'assistant')?.content || '等待诊断结果')
const latestSuggestions = computed(() => messages.value.find((item) => item.role === 'assistant')?.suggestions || [])
const traceRows = computed(() => trace.value?.plan?.slice(0, 4) || [])
const anomalyCards = computed(() => {
  const coordinatorOffline = status.value?.coordinator.status && status.value.coordinator.status !== 'online'
  const pendingApprovals = approvals.value.length > 0
  return [
    coordinatorOffline
      ? { title: 'Agent 未在线', solution: '检查后端 Agent 服务和模型 API 配置。' }
      : { title: 'Agent 在线', solution: '可发起卫星、链路、遥感与审批诊断。' },
    pendingApprovals
      ? { title: '存在待审批动作', solution: '先复核动作目标和影响范围。' }
      : { title: '审批队列正常', solution: '当前没有阻塞性审批。' }
  ]
})

function statusTagType(status: string) {
  if (status === 'completed') return 'success'
  if (status === 'running') return 'primary'
  if (status === 'failed') return 'danger'
  return 'info'
}

function applyLlmConfig(config: Record<string, any>) {
  const coordinator = config.coordinator || config.default || config
  llmForm.provider = coordinator.provider || config.provider || ''
  llmForm.endpoint = coordinator.endpoint || coordinator.base_url || config.endpoint || config.base_url || ''
  llmForm.model = coordinator.model || config.model || ''
  llmForm.apiKey = coordinator.api_key || coordinator.apiKey || config.api_key || config.apiKey || ''
  llmForm.temperature = Number(coordinator.temperature ?? config.temperature ?? 0.2)
  llmForm.maxTokens = Number(coordinator.max_tokens ?? coordinator.maxTokens ?? config.max_tokens ?? 2048)
}

function applyAgentConfig(config: Record<string, any>) {
  agentConfig.default_agent = config.default_agent || config.defaultAgent || 'coordinator'
  agentConfig.max_steps = Number(config.max_steps || config.maxSteps || 8)
  Object.assign(agentFeatures, config.features || {})
}

async function loadStatus() {
  status.value = await agentApi.getStatus()
}

async function loadApprovals() {
  approvals.value = await satopsApi.getPendingApprovals()
}

async function loadConfigs() {
  const [llmConfig, agentConfigData] = await Promise.all([llmApi.getConfig(), agentApi.getConfig()])
  llmRawConfig.value = llmConfig || {}
  agentRawConfig.value = agentConfigData || {}
  applyLlmConfig(llmRawConfig.value)
  applyAgentConfig(agentRawConfig.value)
}

async function loadTraceArtifacts(traceId: string) {
  currentTraceId.value = traceId
  trace.value = await satopsApi.getTrace(traceId)
}

async function refreshAll() {
  try {
    loading.value = true
    await Promise.all([loadStatus(), loadApprovals(), loadConfigs()])
    if (currentTraceId.value) {
      await loadTraceArtifacts(currentTraceId.value)
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '刷新失败')
  } finally {
    loading.value = false
  }
}

async function refreshApprovals() {
  try {
    await loadApprovals()
    ElMessage.success('审批状态已刷新')
  } catch (error: any) {
    ElMessage.error(error?.message || '刷新失败')
  }
}

async function saveLlmConfig() {
  try {
    savingConfig.value = true
    await llmApi.updateConfig({
      ...llmRawConfig.value,
      provider: llmForm.provider,
      endpoint: llmForm.endpoint,
      base_url: llmForm.endpoint,
      model: llmForm.model,
      api_key: llmForm.apiKey,
      temperature: llmForm.temperature,
      max_tokens: llmForm.maxTokens
    })
    ElMessage.success('大模型配置已保存')
    await loadConfigs()
  } catch (error: any) {
    ElMessage.error(error?.message || '保存失败')
  } finally {
    savingConfig.value = false
  }
}

async function saveAgentConfig() {
  try {
    savingConfig.value = true
    await agentApi.updateConfig({
      ...agentRawConfig.value,
      default_agent: agentConfig.default_agent,
      max_steps: agentConfig.max_steps,
      features: { ...agentFeatures }
    })
    ElMessage.success('Agent 配置已保存')
    await loadConfigs()
  } catch (error: any) {
    ElMessage.error(error?.message || '保存失败')
  } finally {
    savingConfig.value = false
  }
}

async function testLlm() {
  try {
    testing.value = true
    const result = await llmApi.testConnection('coordinator')
    ElMessage.success(result.connected ? `连接成功：${result.model}` : '连接失败')
  } catch (error: any) {
    ElMessage.error(error?.message || '测试失败')
  } finally {
    testing.value = false
  }
}

async function sendMessage() {
  const content = message.value.trim()
  if (!content) {
    ElMessage.warning('请输入任务内容')
    return
  }
  messages.value.unshift({
    id: `user-${Date.now()}`,
    role: 'user',
    agentLabel: 'User',
    content,
    time: dayjs().format('HH:mm:ss')
  })
  sending.value = true
  try {
    const [chatReply, traceAcceptance] = await Promise.all([
      agentApi.chat({
        agent_type: agentType.value,
        message: content,
        context: {
          llm: { ...llmForm },
          agent_features: { ...agentFeatures }
        },
        history: messages.value
          .slice(0, 6)
          .reverse()
          .map((item) => ({ role: item.role, content: item.content }))
      }),
      satopsApi.coordinatorChat({
        message: content,
        trace_id: continueTrace.value ? currentTraceId.value || undefined : undefined
      })
    ])
    if (traceAcceptance.trace_id) {
      await loadTraceArtifacts(traceAcceptance.trace_id)
    }
    messages.value.unshift({
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      agentLabel: agentType.value,
      content: chatReply.response,
      time: dayjs().format('HH:mm:ss'),
      suggestions: chatReply.suggestions
    })
    message.value = ''
    await loadApprovals()
  } catch (error: any) {
    ElMessage.error(error?.message || '任务发送失败')
  } finally {
    sending.value = false
  }
}

async function decideApproval(requestId: string, decision: 'approve' | 'reject') {
  try {
    await satopsApi.submitApprovalDecision(requestId, {
      decision,
      reason: decision === 'approve' ? '控制台确认通过' : '控制台驳回'
    })
    await loadApprovals()
    ElMessage.success(decision === 'approve' ? '审批已通过' : '审批已驳回')
  } catch (error: any) {
    ElMessage.error(error?.message || '审批操作失败')
  }
}

usePolling(refreshAll, 20000, true)
</script>

<style scoped>
.agent-page {
  height: 100%;
  min-height: 0;
  padding: 12px;
  display: grid;
  grid-template-rows: 38px 72px minmax(0, 1fr);
  gap: 10px;
  overflow: hidden;
  background:
    radial-gradient(circle at 12% 10%, rgba(37, 99, 235, 0.14), transparent 24%),
    linear-gradient(180deg, var(--vscode-bg), color-mix(in srgb, var(--vscode-bg) 88%, #ffffff));
  color: var(--vscode-text);
}

.agent-head,
.head-actions,
.panel-head,
.mini-head,
.trace-row,
.approval-row,
.model-row,
.agent-settings {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.agent-head span,
.summary-item span,
.summary-item em,
.config-grid span,
.feature-item span,
.mini-head span,
.empty-state,
.anomaly-row span {
  color: var(--vscode-text-muted);
  font-size: 12px;
}

.agent-head h1 {
  margin: 0;
  font-size: 22px;
}

.top-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.summary-item,
.panel {
  border: 1px solid var(--vscode-border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--vscode-sidebar-bg) 88%, transparent);
  box-shadow: 0 12px 28px var(--vscode-shadow);
}

.summary-item {
  min-width: 0;
  display: grid;
  gap: 3px;
  padding: 9px 11px;
}

.summary-item strong {
  font-size: 20px;
  line-height: 1;
}

.summary-item em {
  font-style: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(350px, 0.78fr);
  gap: 10px;
}

.work-panel,
.config-stack {
  min-height: 0;
  min-width: 0;
  display: grid;
  gap: 10px;
}

.work-panel {
  padding: 10px;
  grid-template-rows: 28px 28px 96px 26px minmax(0, 1fr);
}

.config-stack {
  grid-template-rows: 198px 148px minmax(0, 0.72fr) minmax(0, 0.58fr);
}

.panel {
  min-height: 0;
  padding: 10px;
  overflow: hidden;
}

.panel-head h3 {
  margin: 0;
  font-size: 15px;
}

.agent-select {
  width: 126px;
}

.quick-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  overflow: hidden;
}

.run-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.result-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 0.75fr);
  gap: 10px;
}

.result-box {
  min-height: 0;
  padding: 10px;
  border: 1px solid var(--vscode-border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--vscode-bg) 78%, transparent);
  display: grid;
  grid-template-rows: 22px minmax(0, 1fr) 28px;
  gap: 8px;
}

.answer-text {
  min-height: 0;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow: hidden;
}

.suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  overflow: hidden;
}

.trace-list,
.anomaly-list,
.approval-list,
.config-grid,
.feature-grid {
  min-height: 0;
  display: grid;
  gap: 7px;
}

.trace-row,
.anomaly-row,
.approval-row {
  min-width: 0;
  padding: 7px 8px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--vscode-hover) 70%, transparent);
}

.trace-row span,
.anomaly-row strong,
.anomaly-row span,
.approval-row strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.config-grid label {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.model-row,
.agent-settings {
  margin-top: 8px;
}

.feature-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.feature-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--vscode-hover) 64%, transparent);
}

.empty-state {
  height: 100%;
  display: grid;
  place-items: center;
}
</style>
