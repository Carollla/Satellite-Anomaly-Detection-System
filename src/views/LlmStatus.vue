<template>
  <div class="ops-page">
    <header class="page-head">
      <div>
        <span>LLM Operations</span>
        <h1>模型配置</h1>
      </div>
      <div class="head-actions">
        <el-tag :type="backendOnline ? 'success' : 'warning'">{{ backendOnline ? '后端数据' : '本地配置' }}</el-tag>
        <el-button size="small" :loading="loading" @click="refresh">刷新</el-button>
        <el-button size="small" type="primary" :loading="saving" @click="saveConfig">保存配置</el-button>
      </div>
    </header>

    <section class="metric-grid">
      <article v-for="item in metrics" :key="item.label" class="metric-card">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <em>{{ item.desc }}</em>
      </article>
    </section>

    <section class="llm-workspace">
      <main class="panel engine-panel">
        <div class="panel-head">
          <h3>模型服务</h3>
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
      </main>

      <aside class="panel test-panel">
        <div class="panel-head">
          <h3>测试结果</h3>
          <el-tag size="small" :type="testResult?.connected ? 'success' : 'info'">
            {{ testResult?.connected ? 'connected' : 'idle' }}
          </el-tag>
        </div>
        <div class="test-box">
          <strong>{{ testResult?.model || form.model || '未测试' }}</strong>
          <span>{{ testResult?.endpoint || form.endpoint }}</span>
          <p>{{ testResult?.reply || '点击连通性测试验证模型服务是否可用。' }}</p>
        </div>
      </aside>

      <main class="panel config-panel">
        <div class="panel-head">
          <h3>协调器模型</h3>
          <el-tag size="small" type="info">coordinator</el-tag>
        </div>
        <el-form label-position="top" class="config-form">
          <div class="form-grid">
            <el-form-item label="Provider">
              <el-input v-model="form.provider" placeholder="openai / ollama / vllm / custom" />
            </el-form-item>
            <el-form-item label="Model">
              <el-input v-model="form.model" placeholder="model name" />
            </el-form-item>
          </div>
          <el-form-item label="Endpoint">
            <el-input v-model="form.endpoint" placeholder="https://api.example.com/v1" />
          </el-form-item>
          <el-form-item label="API Key">
            <el-input v-model="form.apiKey" type="password" show-password placeholder="真实密钥不会显示在状态卡片中" />
          </el-form-item>
          <div class="form-grid">
            <el-form-item label="Temperature">
              <el-slider v-model="form.temperature" :min="0" :max="2" :step="0.1" />
            </el-form-item>
            <el-form-item label="Max Tokens">
              <el-input-number v-model="form.maxTokens" :min="128" :max="32768" :step="128" class="full" />
            </el-form-item>
          </div>
        </el-form>
      </main>

      <aside class="panel policy-panel">
        <div class="panel-head">
          <h3>策略开关</h3>
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
        <h3>生成测试</h3>
        <el-button size="small" type="primary" :loading="generating" @click="generateSample">生成</el-button>
      </div>
      <el-input v-model="prompt" type="textarea" :rows="2" resize="none" />
      <pre class="output-box">{{ generatedText }}</pre>
      </section>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { llmApi } from '../api'
import type { LlmStatus, LlmTestResult } from '../api/types'

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
  padding: 18px;
  background: var(--vscode-bg);
  color: var(--vscode-text);
}

.page-head,
.panel-head,
.head-actions,
.engine-head {
  display: flex;
  align-items: center;
}

.page-head {
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.page-head span {
  color: var(--vscode-text-muted);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.page-head h1 {
  margin: 4px 0 0;
  font-size: 24px;
}

.head-actions {
  gap: 8px;
}

.metric-grid {
  display: grid;
  gap: 12px;
  margin-bottom: 12px;
}

.metric-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.llm-workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  grid-template-rows: 0.75fr 1.1fr 0.8fr;
  grid-template-areas:
    "engines test"
    "config policy"
    "generate generate";
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
  padding: 12px 14px;
}

.metric-card span,
.metric-card em,
.engine-card span,
.engine-card em,
.test-box span,
.test-box p,
.switch-row span {
  color: var(--vscode-text-muted);
  font-size: 12px;
}

.metric-card strong {
  display: block;
  margin-top: 6px;
  font-size: 22px;
}

.metric-card em {
  display: block;
  margin-top: 6px;
  font-style: normal;
}

.panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 14px;
}

.panel-head {
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.engine-panel {
  grid-area: engines;
}

.test-panel {
  grid-area: test;
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
  margin: 0;
  font-size: 16px;
}

.engine-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.engine-card {
  padding: 12px;
}

.engine-head {
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.engine-card span,
.engine-card em,
.test-box span,
.test-box p {
  display: block;
  margin-top: 6px;
  font-style: normal;
}

.config-form {
  min-height: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
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
  white-space: pre-wrap;
}

.full {
  width: 100%;
}

@media (max-width: 1100px) {
  .metric-grid,
  .llm-workspace,
  .engine-grid,
  .form-grid {
    grid-template-columns: 1fr;
  }

  .llm-workspace {
    grid-template-areas: none;
  }
}
</style>
