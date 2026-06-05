<template>
  <div class="ops-page">
    <header class="llm-hero">
      <div class="hero-copy">
        <span>LLM Operations</span>
        <h1>模型配置</h1>
        <p>统一管理 Agent 的模型底座、连通性、生成参数和高危策略。</p>
      </div>
      <div class="hero-actions">
        <el-tag :type="backendOnline ? 'success' : 'warning'" effect="light">
          {{ backendOnline ? '后端数据' : '本地配置' }}
        </el-tag>
        <el-button size="small" :loading="loading" @click="refresh">刷新</el-button>
        <el-button size="small" type="primary" :loading="saving" @click="saveConfig">保存配置</el-button>
      </div>
      <div class="hero-metrics">
        <article v-for="item in metrics" :key="item.label" class="metric-card">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <em>{{ item.desc }}</em>
        </article>
      </div>
    </header>

    <section class="llm-workspace">
      <main class="panel service-panel">
        <div class="panel-head">
          <div>
            <span>Model Runtime</span>
            <h3>模型服务矩阵</h3>
          </div>
          <el-button size="small" text type="primary" :loading="testing" @click="testConnection">连通性测试</el-button>
        </div>
        <div class="engine-grid">
          <article v-for="engine in engineRows" :key="engine.name" class="engine-card">
            <div class="engine-head">
              <strong>{{ engine.name }}</strong>
              <el-tag size="small" :type="engine.status === 'online' ? 'success' : 'warning'">{{ engine.status }}</el-tag>
            </div>
            <span>{{ engine.model }}</span>
            <em>{{ engine.provider || 'custom provider' }}</em>
          </article>
        </div>
        <div class="test-result">
          <div>
            <span>最近测试</span>
            <strong>{{ testResult?.model || form.model || '未测试' }}</strong>
            <em>{{ testResult?.endpoint || form.endpoint }}</em>
          </div>
          <div
            class="test-reply markdown-body"
            v-html="renderMarkdown(testResult?.reply || '点击连通性测试验证协调器模型服务是否可用。')"
          ></div>
        </div>
      </main>

      <aside class="panel config-panel">
        <div class="panel-head">
          <div>
            <span>Coordinator</span>
            <h3>协调器模型</h3>
          </div>
          <el-tag size="small" type="info">主控模型</el-tag>
        </div>
        <el-form label-position="top" class="config-form">
          <section class="form-section">
            <el-form-item label="Provider">
              <el-input v-model="form.provider" placeholder="openai / ollama / vllm / custom" />
            </el-form-item>
            <el-form-item label="Model">
              <el-input v-model="form.model" placeholder="model name" />
            </el-form-item>
            <el-form-item label="Endpoint" class="span-2">
              <el-input v-model="form.endpoint" placeholder="https://api.example.com/v1" />
            </el-form-item>
            <el-form-item label="API Key" class="span-2">
              <el-input v-model="form.apiKey" type="password" show-password placeholder="真实密钥不会显示在状态卡片中" />
            </el-form-item>
          </section>
          <section class="tuning-section">
            <el-form-item label="Temperature">
              <el-slider v-model="form.temperature" :min="0" :max="2" :step="0.1" />
            </el-form-item>
            <el-form-item label="Max Tokens">
              <el-input-number v-model="form.maxTokens" :min="128" :max="32768" :step="128" class="full" />
            </el-form-item>
          </section>
        </el-form>
      </aside>

      <aside class="panel policy-panel">
        <div class="panel-head">
          <div>
            <span>Safety Policy</span>
            <h3>策略开关</h3>
          </div>
          <el-button size="small" text @click="resetDefaults">默认值</el-button>
        </div>
        <div class="switch-list">
          <label v-for="item in switches" :key="item.key" class="switch-row">
            <span>{{ item.label }}</span>
            <el-switch v-model="policy[item.key]" size="small" />
          </label>
        </div>
      </aside>

      <section class="panel generate-panel">
        <div class="panel-head">
          <div>
            <span>Prompt Test</span>
            <h3>生成测试</h3>
          </div>
          <el-button size="small" type="primary" :loading="generating" @click="generateSample">生成</el-button>
        </div>
        <el-input v-model="prompt" type="textarea" :rows="2" resize="none" class="prompt-input" />
        <div class="output-box markdown-body" v-html="renderMarkdown(generatedText || '等待生成结果。')"></div>
      </section>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { llmApi } from '../api'
import type { LlmStatus, LlmTestResult } from '../api/types'
import { renderMarkdown } from '../utils/markdown'

const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const generating = ref(false)
const backendOnline = ref(true)
const status = ref<LlmStatus>({})
const rawConfig = ref<Record<string, any>>({})
const testResult = ref<LlmTestResult | null>(null)
const prompt = ref('请用三句话分析 sat-006 离线对当前星座链路的影响，并给出下一步处置建议。')
const generatedText = ref('')

const form = reactive({
  provider: 'vllm',
  endpoint: 'http://localhost:8000/v1',
  model: 'Qwen2.5-72B-Instruct',
  apiKey: '',
  temperature: 0.2,
  maxTokens: 2048
})

const policy = reactive<Record<string, boolean>>({
  approvalRequired: true,
  allowToolUse: true,
  streamResponse: true,
  redactSecrets: true,
  fallbackModel: true
})

const switches = [
  { key: 'approvalRequired', label: '高危动作审批' },
  { key: 'allowToolUse', label: '允许工具调用' },
  { key: 'streamResponse', label: '流式响应' },
  { key: 'redactSecrets', label: '敏感信息脱敏' },
  { key: 'fallbackModel', label: '失败后模型降级' }
]

const engineRows = computed(() =>
  Object.entries(status.value).map(([name, item]) => ({
    name,
    status: item.status || 'unknown',
    model: item.model || '-',
    provider: item.provider || item.engine || ''
  }))
)

const metrics = computed(() => {
  const online = engineRows.value.filter((item) => item.status === 'online').length
  return [
    { label: '模型服务', value: engineRows.value.length, desc: `${online} 个在线` },
    { label: '当前模型', value: form.model, desc: form.provider },
    { label: '温度', value: form.temperature, desc: '生成随机性' },
    { label: '最大长度', value: form.maxTokens, desc: 'tokens' }
  ]
})

onMounted(refresh)

async function refresh() {
  loading.value = true
  try {
    const [nextStatus, config] = await Promise.all([llmApi.getStatus(), llmApi.getConfig()])
    status.value = nextStatus
    rawConfig.value = config
    applyConfig(config)
    backendOnline.value = true
  } catch {
    backendOnline.value = false
    status.value = seedStatus()
  } finally {
    loading.value = false
  }
}

async function saveConfig() {
  saving.value = true
  const nextConfig = {
    ...rawConfig.value,
    coordinator: {
      ...(rawConfig.value.coordinator || {}),
      provider: form.provider,
      endpoint: form.endpoint,
      model: form.model,
      api_key: form.apiKey,
      temperature: form.temperature,
      max_tokens: form.maxTokens,
      policy: { ...policy }
    }
  }
  try {
    await llmApi.updateConfig(nextConfig)
    rawConfig.value = nextConfig
    backendOnline.value = true
    ElMessage.success('模型配置已保存')
  } catch {
    rawConfig.value = nextConfig
    backendOnline.value = false
    ElMessage.warning('后端不可用，配置已保存在当前页面状态')
  } finally {
    saving.value = false
  }
}

async function testConnection() {
  testing.value = true
  try {
    testResult.value = await llmApi.testConnection('coordinator')
    backendOnline.value = true
  } catch {
    backendOnline.value = false
    testResult.value = {
      connected: false,
      provider: form.provider,
      model: form.model,
      endpoint: form.endpoint,
      reply: '本地模式：未连接真实模型服务。'
    }
  } finally {
    testing.value = false
  }
}

async function generateSample() {
  generating.value = true
  try {
    const result = await llmApi.generate({
      model: form.model,
      prompt: prompt.value,
      max_tokens: form.maxTokens,
      temperature: form.temperature
    })
    generatedText.value = result.output
    backendOnline.value = true
  } catch {
    backendOnline.value = false
    generatedText.value = '本地演示输出：sat-006 离线会降低同轨面链路冗余，并可能增加 GEO 骨干转发压力。建议先检查心跳和电源遥测，再触发链路重路由流程，并把恢复动作提交审批。'
  } finally {
    generating.value = false
  }
}

function applyConfig(config: Record<string, any>) {
  const coordinator = config.coordinator || config.default || {}
  form.provider = coordinator.provider || form.provider
  form.endpoint = coordinator.endpoint || coordinator.base_url || form.endpoint
  form.model = coordinator.model || form.model
  form.apiKey = coordinator.api_key || ''
  form.temperature = coordinator.temperature ?? form.temperature
  form.maxTokens = coordinator.max_tokens ?? form.maxTokens
  Object.assign(policy, coordinator.policy || {})
}

function resetDefaults() {
  policy.approvalRequired = true
  policy.allowToolUse = true
  policy.streamResponse = true
  policy.redactSecrets = true
  policy.fallbackModel = true
}

function seedStatus(): LlmStatus {
  return {
    coordinator: { status: 'online', model: form.model, provider: form.provider },
    specialist_network: { status: 'online', model: 'Qwen2.5-32B', provider: 'vllm' },
    edge_summary: { status: 'standby', model: 'Qwen2.5-7B', provider: 'ollama' }
  }
}
</script>

<style scoped>
.ops-page {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 16px;
  background:
    radial-gradient(circle at 14% 0%, rgba(37, 99, 235, 0.12), transparent 28%),
    radial-gradient(circle at 94% 18%, rgba(14, 165, 233, 0.1), transparent 24%),
    var(--vscode-bg);
  color: var(--vscode-text);
}

.llm-hero,
.panel-head,
.hero-actions,
.engine-head {
  display: flex;
  align-items: center;
}

.llm-hero {
  min-height: 132px;
  display: grid;
  grid-template-columns: minmax(280px, 1fr) auto;
  grid-template-rows: auto auto;
  gap: 14px 18px;
  padding: 18px;
  margin-bottom: 14px;
  border: 1px solid var(--vscode-border);
  border-radius: 10px;
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.14), transparent 48%),
    var(--vscode-sidebar-bg);
  box-shadow: 0 14px 32px var(--vscode-shadow);
}

.hero-copy {
  min-width: 0;
}

.hero-copy span,
.panel-head span {
  color: var(--vscode-primary);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.hero-copy h1 {
  margin: 4px 0 0;
  font-size: 28px;
  line-height: 1.1;
}

.hero-copy p {
  margin: 8px 0 0;
  color: var(--vscode-text-muted);
  font-size: 13px;
}

.hero-actions {
  justify-content: space-between;
  gap: 8px;
  align-self: start;
  white-space: nowrap;
}

.hero-metrics {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.llm-workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(360px, 0.85fr);
  grid-template-rows: minmax(0, 1fr) 210px;
  grid-template-areas:
    "services config"
    "policy generate";
  gap: 12px;
}

.metric-card,
.panel,
.engine-card {
  border: 1px solid var(--vscode-border);
  border-radius: 8px;
  background: var(--vscode-sidebar-bg);
}

.metric-card {
  position: relative;
  min-width: 0;
  padding: 12px 14px 12px 16px;
  overflow: hidden;
  background: color-mix(in srgb, var(--vscode-sidebar-bg) 76%, var(--vscode-bg));
}

.metric-card span,
.metric-card em,
.engine-card span,
.engine-card em,
.test-result > div > span,
.test-result > div > em,
.switch-row span {
  color: var(--vscode-text-muted);
  font-size: 12px;
}

.metric-card strong {
  display: block;
  margin-top: 6px;
  font-size: 22px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-card em {
  display: block;
  margin-top: 6px;
  font-style: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 14px;
  box-shadow: 0 12px 28px var(--vscode-shadow);
}

.panel-head {
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.service-panel {
  grid-area: services;
}

.config-panel {
  grid-area: config;
}

.policy-panel {
  grid-area: policy;
}

.generate-panel {
  grid-area: generate;
}

.panel-head h3 {
  margin: 2px 0 0;
  font-size: 16px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.engine-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.engine-card {
  position: relative;
  padding: 12px;
  overflow: hidden;
  background:
    linear-gradient(135deg, rgba(14, 165, 233, 0.1), transparent 60%),
    var(--vscode-bg);
}

.engine-card::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: #0ea5e9;
}

.engine-head {
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.engine-head strong,
.test-box strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.engine-card span,
.engine-card em,
.test-result > div > span,
.test-result > div > em {
  display: block;
  margin-top: 6px;
  font-style: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.test-result {
  min-height: 116px;
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--vscode-border);
  border-radius: 8px;
  background: var(--vscode-bg);
}

.test-result strong {
  display: block;
  margin-top: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.test-reply {
  align-self: center;
  margin: 0;
  min-width: 0;
  max-height: 88px;
  line-height: 1.6;
  overflow: auto;
  color: var(--vscode-text);
  font-size: 12px;
}

.config-form {
  display: grid;
  flex: 1;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 12px;
}

.config-form :deep(.el-form-item) {
  min-width: 0;
  margin-bottom: 0;
}

.config-form :deep(.el-form-item__label) {
  display: block;
  height: 18px;
  line-height: 18px;
  margin-bottom: 4px;
  padding: 0;
  color: var(--vscode-text-muted);
  font-size: 12px;
  font-weight: 700;
}

.config-form :deep(.el-form-item__content) {
  min-width: 0;
  line-height: 32px;
}

.config-form :deep(.el-input),
.config-form :deep(.el-input-number) {
  width: 100%;
}

.config-form :deep(.el-slider) {
  min-width: 0;
  padding: 0 8px;
}

.form-section {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 12px;
}

.span-2 {
  grid-column: span 2;
}

.tuning-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--vscode-border);
  border-radius: 8px;
  background: var(--vscode-bg);
}

.switch-list {
  flex: 1;
  min-height: 0;
  display: grid;
  gap: 8px;
  overflow: hidden;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px;
  border: 1px solid var(--vscode-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--vscode-bg) 82%, transparent);
}

.switch-row span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.switch-row .el-switch {
  flex-shrink: 0;
}

.prompt-input {
  flex-shrink: 0;
}

.prompt-input :deep(.el-textarea__inner) {
  min-height: 54px !important;
  line-height: 1.45;
}

.output-box {
  flex: 1;
  min-height: 0;
  margin: 12px 0 0;
  padding: 14px;
  border: 1px solid var(--vscode-border);
  border-radius: 8px;
  background: var(--vscode-bg);
  color: var(--vscode-text);
  line-height: 1.6;
  overflow: auto;
}

.markdown-body {
  overflow-wrap: anywhere;
  word-break: break-word;
}

.markdown-body :deep(p) {
  margin: 6px 0;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 6px 0;
  padding-left: 18px;
}

.markdown-body :deep(code) {
  padding: 2px 5px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--vscode-hover) 82%, #2563eb);
  font-family: 'Cascadia Code', 'Consolas', monospace;
}

.markdown-body :deep(.md-table-wrap) {
  max-width: 100%;
  overflow-x: auto;
}

.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 6px 8px;
  border: 1px solid var(--vscode-border);
}

.full {
  width: 100%;
}

@media (max-width: 1100px) {
  .hero-metrics,
  .llm-workspace,
  .engine-grid,
  .form-section,
  .tuning-section {
    grid-template-columns: 1fr;
  }

  .llm-workspace {
    grid-template-areas: none;
  }

  .span-2 {
    grid-column: auto;
  }
}
</style>
