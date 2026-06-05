<template>
  <div class="agent-page">
    <header class="agent-head">
      <div class="agent-title-block">
        <h1>异常监测 Agent</h1>
        <div class="agent-flow" aria-label="异常监测流程">
          <b>告警检测</b>
          <i />
          <b>根因定位</b>
          <i />
          <b>恢复建议</b>
          <i />
          <b>审批执行</b>
        </div>
      </div>
      <div class="head-actions">
        <el-tag class="status-tag" :type="status?.coordinator.status === 'online' ? 'success' : 'warning'">
          {{ status?.coordinator.status === 'online' ? '在线' : '未连接' }}
        </el-tag>
        <el-button size="small" :loading="loading" @click="refreshAll">刷新</el-button>
        <el-button size="small" type="primary" :loading="sending" @click="sendMessage">运行诊断</el-button>
      </div>
    </header>

    <section class="top-grid">
      <article v-for="item in summaryCards" :key="item.label" class="summary-item" :class="item.tone">
        <i />
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </article>
    </section>

    <section class="agent-grid">
      <main class="work-panel panel">
        <div class="panel-head">
          <h3>1. 发起诊断</h3>
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
          :rows="5"
          resize="none"
          placeholder="输入真实排障问题，例如：分析当前离线卫星和链路影响范围"
        />

        <div class="run-row">
          <el-checkbox v-model="continueTrace" :disabled="!currentTraceId">续接 Trace</el-checkbox>
          <el-button size="small" @click="message = ''">清空</el-button>
        </div>

        <section class="result-box">
          <div class="mini-head">
            <strong>诊断结论</strong>
            <span>{{ messages[0]?.time || '-' }}</span>
          </div>
          <div class="answer-text markdown-body" v-html="latestAnswerHtml"></div>
          <div class="suggestions">
            <el-tag v-for="item in latestSuggestions" :key="item" size="small">{{ item }}</el-tag>
          </div>
        </section>
      </main>

      <section class="trace-panel panel">
        <div class="panel-head">
          <h3>2. Trace 执行链路</h3>
          <el-tag size="small" :type="trace?.current_phase === 'completed' ? 'success' : 'info'">
            {{ trace?.current_phase || 'idle' }}
          </el-tag>
        </div>
        <div class="stage-strip">
          <div v-for="stage in pipelineStages" :key="stage.label" class="stage-item" :class="stage.state">
            <span>{{ stage.order }}</span>
            <strong>{{ stage.label }}</strong>
          </div>
        </div>
        <div class="trace-list">
          <div v-for="item in traceRows" :key="`${item.assignee}-${item.task}`" class="trace-row">
            <div>
              <strong>{{ item.task }}</strong>
              <span>{{ item.assignee }}</span>
            </div>
            <el-tag size="small" :type="statusTagType(item.status)">{{ item.status }}</el-tag>
          </div>
          <div v-if="!traceRows.length" class="empty-state">等待任务</div>
        </div>
      </section>

      <aside class="insight-stack">
        <section class="panel config-panel">
          <div class="panel-head">
            <h3>3. 运行配置</h3>
            <div class="panel-actions">
              <el-button size="small" text type="primary" :loading="testing" @click="testLlm">测试</el-button>
              <el-button size="small" text type="primary" :loading="savingConfig" @click="saveLlmConfig">保存</el-button>
            </div>
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
            <label>
              <span>温度</span>
              <el-input-number v-model="llmForm.temperature" size="small" :min="0" :max="2" :step="0.1" />
            </label>
            <label>
              <span>步数</span>
              <el-input-number v-model="agentConfig.max_steps" size="small" :min="1" :max="20" />
            </label>
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
            <el-button size="small" type="primary" plain :loading="savingConfig" @click="saveAgentConfig">保存 Agent</el-button>
          </div>
        </section>

        <section class="panel anomaly-panel">
          <div class="panel-head">
            <h3>关键状态</h3>
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
            <h3>待审批动作</h3>
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
import { renderMarkdown } from '../utils/markdown'

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
  { label: '协调器', value: status.value?.coordinator.status || 'unknown', tone: 'blue' },
  { label: '专家 Agent', value: status.value?.specialists.length ?? 0, tone: 'cyan' },
  { label: '星上 Agent', value: status.value?.edge_agents.length ?? 0, tone: 'violet' },
  { label: '待审批', value: approvals.value.length, tone: 'amber' }
])
const latestAnswer = computed(() => messages.value.find((item) => item.role === 'assistant')?.content || '等待诊断结果')
const latestAnswerHtml = computed(() => renderMarkdown(latestAnswer.value))
const latestSuggestions = computed(() => messages.value.find((item) => item.role === 'assistant')?.suggestions || [])
const traceRows = computed(() => trace.value?.plan?.slice(0, 4) || [])
const pipelineStages = computed(() => {
  const rows = trace.value?.plan || []
  const completed = rows.filter((item) => item.status === 'completed').length
  const running = rows.some((item) => item.status === 'running')
  const currentPhase = trace.value?.current_phase
  return [
    { order: '01', label: '检测', state: rows.length ? 'completed' : 'pending' },
    { order: '02', label: '定位', state: completed >= 1 ? 'completed' : running ? 'running' : 'pending' },
    { order: '03', label: '处置', state: completed >= 2 ? 'completed' : running ? 'running' : 'pending' },
    { order: '04', label: '审批', state: approvals.value.length ? 'running' : currentPhase === 'completed' ? 'completed' : 'pending' }
  ]
})
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
  grid-template-rows: 70px 82px minmax(0, 1fr);
  gap: 10px;
  overflow: hidden;
  background:
    radial-gradient(circle at 10% 8%, rgba(37, 99, 235, 0.16), transparent 26%),
    radial-gradient(circle at 72% 0%, rgba(14, 165, 233, 0.12), transparent 22%),
    radial-gradient(circle at 94% 82%, rgba(245, 158, 11, 0.1), transparent 22%),
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
.agent-settings,
.panel-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.summary-item span,
.config-grid span,
.feature-item span,
.mini-head span,
.empty-state,
.anomaly-row span {
  color: var(--vscode-text-muted);
  font-size: 12px;
}

.agent-head {
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--vscode-border) 76%, #2563eb);
  border-radius: 14px;
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.18), transparent 42%),
    linear-gradient(90deg, color-mix(in srgb, var(--vscode-sidebar-bg) 92%, transparent), color-mix(in srgb, var(--vscode-sidebar-bg) 72%, transparent));
  box-shadow: 0 14px 30px var(--vscode-shadow);
}

.agent-title-block {
  min-width: 0;
  display: grid;
  gap: 8px;
}

.agent-head h1 {
  margin: 0;
  font-size: 26px;
  line-height: 1.15;
  letter-spacing: 0;
}

.agent-flow {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.agent-flow b {
  min-width: 72px;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #1d4ed8;
  background: rgba(37, 99, 235, 0.12);
  border: 1px solid rgba(37, 99, 235, 0.22);
  white-space: nowrap;
}

.agent-flow i {
  width: 32px;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, #2563eb, #0ea5e9);
  opacity: 0.72;
}

.head-actions {
  flex-shrink: 0;
}

.status-tag {
  min-width: 62px;
  justify-content: center;
}

.top-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.summary-item,
.panel {
  border: 1px solid var(--vscode-border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--vscode-sidebar-bg) 90%, transparent);
  box-shadow: 0 12px 28px var(--vscode-shadow);
}

.summary-item {
  position: relative;
  min-width: 0;
  height: 82px;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  grid-template-rows: 1fr 1fr;
  column-gap: 10px;
  padding: 12px 14px;
  overflow: hidden;
}

.summary-item > i {
  grid-row: 1 / 3;
  align-self: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.95), rgba(14, 165, 233, 0.75));
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.3);
}

.summary-item::after {
  content: '';
  position: absolute;
  right: -18px;
  top: -18px;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: rgba(37, 99, 235, 0.1);
}

.summary-item.cyan > i {
  background: linear-gradient(135deg, #06b6d4, #2563eb);
}

.summary-item.violet > i {
  background: linear-gradient(135deg, #7c3aed, #2563eb);
}

.summary-item.amber > i {
  background: linear-gradient(135deg, #f59e0b, #ef4444);
}

.summary-item span {
  align-self: end;
  font-size: 13px;
  font-weight: 700;
}

.summary-item strong {
  min-width: 0;
  align-self: start;
  font-size: 24px;
  line-height: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(320px, 0.88fr) minmax(380px, 1.04fr) minmax(332px, 0.82fr);
  gap: 10px;
}

.work-panel,
.trace-panel,
.insight-stack {
  min-height: 0;
  min-width: 0;
  display: grid;
  gap: 10px;
}

.work-panel {
  padding: 10px;
  grid-template-rows: 30px 64px 122px 28px minmax(0, 1fr);
  border-top: 3px solid #2563eb;
}

.trace-panel {
  grid-template-rows: 30px 108px minmax(0, 1fr);
  border-top: 3px solid #0ea5e9;
}

.insight-stack {
  grid-template-rows: minmax(230px, 1.05fr) minmax(112px, 0.52fr) minmax(104px, 0.45fr);
}

.config-panel {
  border-top: 3px solid #7c3aed;
}

.anomaly-panel {
  border-top: 3px solid #f59e0b;
}

.approval-panel {
  border-top: 3px solid #16a34a;
}

.panel {
  min-height: 0;
  padding: 11px;
  overflow: hidden;
}

.panel-head h3 {
  margin: 0;
  font-size: 16px;
  line-height: 1.2;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-select {
  width: 132px;
  flex-shrink: 0;
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  overflow: hidden;
}

.quick-actions .el-button {
  width: 100%;
  min-width: 0;
  margin: 0;
  justify-content: flex-start;
  overflow: hidden;
}

.quick-actions :deep(.el-button > span) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.work-panel > :deep(.el-textarea) {
  height: 100%;
}

.work-panel > :deep(.el-textarea .el-textarea__inner) {
  height: 100%;
  line-height: 1.55;
}

.run-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.result-box {
  min-height: 0;
  padding: 10px;
  border: 1px solid var(--vscode-border);
  border-radius: 10px;
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.08), transparent 46%),
    color-mix(in srgb, var(--vscode-bg) 78%, transparent);
  display: grid;
  grid-template-rows: 22px minmax(0, 1fr) 28px;
  gap: 8px;
}

.answer-text {
  min-height: 0;
  line-height: 1.55;
  overflow-y: auto;
  overflow-x: hidden;
  font-size: 14px;
  padding-right: 4px;
}

.markdown-body {
  color: var(--vscode-text);
  overflow-wrap: anywhere;
  word-break: break-word;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: 10px 0 8px;
  line-height: 1.28;
  letter-spacing: 0;
}

.markdown-body :deep(h1) {
  font-size: 22px;
}

.markdown-body :deep(h2) {
  font-size: 19px;
}

.markdown-body :deep(h3) {
  font-size: 17px;
}

.markdown-body :deep(h4) {
  font-size: 15px;
}

.markdown-body :deep(p) {
  margin: 8px 0;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 8px 0;
  padding-left: 20px;
}

.markdown-body :deep(li) {
  margin: 4px 0;
}

.markdown-body :deep(strong) {
  color: var(--vscode-text);
  font-weight: 800;
}

.markdown-body :deep(code) {
  padding: 2px 5px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--vscode-hover) 82%, #2563eb);
  color: var(--vscode-text);
  font-family: 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.92em;
}

.markdown-body :deep(pre) {
  margin: 10px 0;
  padding: 12px;
  border: 1px solid var(--vscode-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--vscode-bg) 78%, #0f172a);
  overflow: auto;
}

.markdown-body :deep(pre code) {
  display: block;
  padding: 0;
  background: transparent;
  white-space: pre;
}

.markdown-body :deep(blockquote) {
  margin: 10px 0;
  padding: 8px 12px;
  border-left: 3px solid var(--vscode-primary);
  border-radius: 6px;
  background: color-mix(in srgb, var(--vscode-hover) 70%, transparent);
  color: var(--vscode-text-muted);
}

.markdown-body :deep(.md-table-wrap) {
  width: 100%;
  margin: 10px 0;
  overflow-x: auto;
  border: 1px solid var(--vscode-border);
  border-radius: 8px;
}

.markdown-body :deep(table) {
  width: 100%;
  min-width: 520px;
  border-collapse: collapse;
  font-size: 13px;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 8px 10px;
  border-bottom: 1px solid var(--vscode-border);
  border-right: 1px solid var(--vscode-border);
  text-align: left;
  vertical-align: top;
}

.markdown-body :deep(th) {
  background: color-mix(in srgb, var(--vscode-hover) 72%, #2563eb);
  color: var(--vscode-text);
  font-weight: 800;
}

.markdown-body :deep(.math-inline),
.markdown-body :deep(.math-block) {
  font-family: 'Cambria Math', 'Times New Roman', serif;
  color: color-mix(in srgb, var(--vscode-text) 86%, #2563eb);
}

.markdown-body :deep(.math-block) {
  display: block;
  margin: 10px 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--vscode-hover) 64%, transparent);
  overflow-x: auto;
  white-space: pre-wrap;
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
.feature-grid,
.stage-strip {
  min-height: 0;
  display: grid;
  gap: 7px;
}

.stage-strip {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.stage-item {
  position: relative;
  min-width: 0;
  height: 108px;
  padding: 12px 10px;
  border: 1px solid var(--vscode-border);
  border-radius: 12px;
  background:
    linear-gradient(180deg, rgba(37, 99, 235, 0.08), transparent),
    color-mix(in srgb, var(--vscode-bg) 72%, transparent);
  overflow: hidden;
}

.stage-item::after {
  content: '';
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 11px;
  height: 5px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.28);
}

.stage-item span {
  display: block;
  color: color-mix(in srgb, var(--vscode-text-muted) 82%, #2563eb);
  font-size: 12px;
  font-weight: 800;
}

.stage-item strong {
  display: block;
  margin-top: 12px;
  font-size: 22px;
  letter-spacing: 0;
}

.stage-item.completed {
  border-color: rgba(34, 197, 94, 0.45);
  background: rgba(34, 197, 94, 0.1);
}

.stage-item.completed::after {
  background: linear-gradient(90deg, #16a34a, #22c55e);
}

.stage-item.running {
  border-color: rgba(245, 158, 11, 0.55);
  background: rgba(245, 158, 11, 0.12);
}

.stage-item.running::after {
  background: linear-gradient(90deg, #f59e0b, #f97316);
}

.trace-row,
.anomaly-row,
.approval-row {
  min-width: 0;
  padding: 9px 10px;
  border-radius: 10px;
  background:
    linear-gradient(90deg, rgba(37, 99, 235, 0.08), transparent 70%),
    color-mix(in srgb, var(--vscode-hover) 70%, transparent);
}

.trace-row div,
.anomaly-row strong,
.anomaly-row span,
.approval-row strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trace-row strong,
.trace-row span {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trace-row strong,
.anomaly-row strong,
.approval-row strong {
  font-size: 14px;
}

.trace-row span,
.anomaly-row span {
  margin-top: 4px;
  font-size: 13px;
  line-height: 1.35;
}

.config-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.config-grid label {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.config-grid :deep(.el-input),
.model-row :deep(.el-input-number),
.agent-settings :deep(.el-select) {
  min-width: 0;
}

.model-row,
.agent-settings {
  min-width: 0;
  margin-top: 8px;
  align-items: end;
}

.model-row label {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.model-row .el-input-number,
.agent-settings .el-select {
  width: 100%;
}

.feature-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 8px;
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

.feature-item span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
}

.empty-state {
  height: 100%;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: color-mix(in srgb, var(--vscode-hover) 42%, transparent);
}

@media (max-width: 1280px) {
  .agent-grid {
    grid-template-columns: minmax(300px, 0.9fr) minmax(330px, 1fr) minmax(300px, 0.76fr);
  }

  .feature-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .agent-flow i {
    width: 18px;
  }
}
</style>
