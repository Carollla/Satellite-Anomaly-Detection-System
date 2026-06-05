<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import {
  ChatLineRound,
  Close,
  Connection,
  Cpu,
  Document,
  Fold,
  Grid,
  Link,
  Monitor,
  Notification,
  Odometer,
  Operation,
  Picture,
  Position,
  Setting,
  User
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from './stores/auth'
import { agentApi } from './api'
import logoUrl from './assets/logo.svg'
import { renderMarkdown } from './utils/markdown'

interface NavChild {
  path?: string
  label: string
  icon?: any
}

interface NavGroup {
  id: string
  label: string
  icon: any
  children: NavChild[]
}

interface HelperMessage {
  role: 'user' | 'assistant'
  content: string
  targetLabel?: string
  reasoning?: ReasoningStep[]
  tools?: ToolStep[]
  grounding?: Record<string, any>
}

interface ReasoningStep {
  label: string
  detail: string
  tone?: 'blue' | 'green' | 'amber' | 'violet'
}

interface ToolStep {
  tool: string
  result: string
}

interface HelperAgent {
  id: string
  label: string
  group: 'command' | 'specialist'
  status: string
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const collapsed = ref(false)
const agentDrawerVisible = ref(false)
const isDark = ref(false)
const loginVisible = ref(false)
const loginForm = ref({ username: 'admin', password: 'admin' })
const helperInput = ref('')
const helperSending = ref(false)
const selectedAgentGroup = ref<'command' | 'specialist'>('command')
const selectedHelperAgent = ref('coordinator')
const helperMessages = ref<HelperMessage[]>([
  {
    role: 'assistant',
    content: '我是卫星智能运维助手。你可以选择上方任意 Agent 发起对话，当前所有 Agent 会先统一接入同一个后端智能体接口。',
    targetLabel: 'L1 总指挥'
  }
])

const helperAgents: HelperAgent[] = [
  { id: 'coordinator', label: 'L1 总指挥', group: 'command', status: '统一入口' },
  { id: 'planner', label: '任务规划', group: 'command', status: '统一入口' },
  { id: 'reviewer', label: '结果复核', group: 'command', status: '统一入口' },
  { id: 'network', label: '网络专家', group: 'specialist', status: '统一入口' },
  { id: 'health', label: '健康专家', group: 'specialist', status: '统一入口' },
  { id: 'security', label: '安全专家', group: 'specialist', status: '统一入口' },
  { id: 'ops', label: '运维专家', group: 'specialist', status: '统一入口' }
]

const visibleHelperAgents = computed(() => helperAgents.filter((item) => item.group === selectedAgentGroup.value))
const selectedHelperAgentMeta = computed(
  () => helperAgents.find((item) => item.id === selectedHelperAgent.value) || helperAgents[0]
)

const groups: NavGroup[] = [
  {
    id: 'overview',
    label: '总览',
    icon: Monitor,
    children: [
      { path: '/', label: '运维仪表盘', icon: Odometer },
      { path: '/earth', label: '卫星群视图', icon: Position },
      { path: '/editor', label: '可视化编辑', icon: Operation },
      { path: '/remote-sensing', label: '遥感工作台', icon: Picture }
    ]
  },
  {
    id: 'topology',
    label: '节点与链路',
    icon: Grid,
    children: [
      { path: '/instances', label: '节点实例', icon: Grid },
      { path: '/links', label: '链路拓扑', icon: Link }
    ]
  },
  {
    id: 'agent',
    label: '智能协作',
    icon: Connection,
    children: [
      { path: '/agent', label: '异常监测 Agent', icon: ChatLineRound },
      { path: '/dag-pipeline', label: '执行流图', icon: Connection },
      { path: '/blackboard', label: '黑板状态', icon: Document }
    ]
  },
  {
    id: 'ops',
    label: '运行控制',
    icon: Operation,
    children: [
      { path: '/faults', label: '故障注入', icon: Notification },
      { path: '/security', label: '安全审计', icon: Document },
      { path: '/llm', label: '模型配置', icon: Cpu }
    ]
  }
]

onMounted(() => {
  authStore.loadAuth()
  if (!authStore.isAuthenticated) {
    loginVisible.value = true
  }

  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'dark') {
    isDark.value = true
    document.documentElement.classList.add('dark')
  }
})

function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

async function handleLogin() {
  const success = await authStore.login(loginForm.value.username, loginForm.value.password)
  if (success) {
    loginVisible.value = false
    if (route.path === '/login') {
      router.push('/')
    }
  }
}

function handleLogout() {
  authStore.logout()
  loginVisible.value = true
}

function handleNav(path: string | undefined) {
  if (path) router.push(path)
}

function isActive(path: string | undefined) {
  return path && (route.path === path || (path !== '/' && route.path.startsWith(path)))
}

function selectAgentGroup(group: 'command' | 'specialist') {
  selectedAgentGroup.value = group
  const firstAgent = helperAgents.find((item) => item.group === group)
  if (firstAgent) selectedHelperAgent.value = firstAgent.id
}

function selectHelperAgent(agentId: string) {
  selectedHelperAgent.value = agentId
}

function renderMessage(content: string) {
  return renderMarkdown(content)
}

function toOneLine(value: any) {
  if (value === null || value === undefined) return '无返回摘要'
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim()
  try {
    return JSON.stringify(value).replace(/\s+/g, ' ').slice(0, 180)
  } catch {
    return String(value)
  }
}

function normalizeTools(actions: any[] = []) {
  return actions.map((action) => ({
    tool: String(action?.tool || action?.name || 'tool'),
    result: toOneLine(action?.result ?? action?.status ?? action)
  }))
}

function buildHelperReasoning(
  question: string,
  reply: { grounding?: Record<string, any>; actions_taken?: any[] },
  agentLabel: string
): ReasoningStep[] {
  const grounding = reply.grounding || {}
  const toolCount = Number(grounding.tool_count ?? reply.actions_taken?.length ?? 0)
  return [
    {
      label: '任务识别',
      detail: `${agentLabel} 接收问题“${question.slice(0, 34)}${question.length > 34 ? '...' : ''}”，先判断是实时运维查询、平台机制解释还是通用问答。`,
      tone: 'blue'
    },
    {
      label: '上下文检索',
      detail: toolCount > 0
        ? `本轮使用 ${toolCount} 个工具或平台上下文，回答会优先依据实时状态和工具结果。`
        : '本轮未命中实时工具，直接使用统一大模型能力回答知识、代码、方案或解释类问题。',
      tone: 'green'
    },
    {
      label: '模型生成',
      detail: grounding.llm_used ? '已调用当前配置的大模型生成回答，并按 Markdown 输出。' : '大模型未使用或不可用，后端 Agent 使用规则与上下文生成回答。',
      tone: grounding.llm_used ? 'violet' : 'amber'
    },
    {
      label: '结果回传',
      detail: '答案已回写到当前对话，工具链摘要保存在本条消息的可展开面板中。',
      tone: 'blue'
    }
  ]
}

function getHelperReasoning(msg: HelperMessage): ReasoningStep[] {
  if (msg.reasoning?.length) return msg.reasoning
  if (msg.role !== 'assistant') return []
  const label = msg.targetLabel || '统一 Agent'
  const answerLength = msg.content.replace(/\s+/g, '').length
  return [
    {
      label: '任务识别',
      detail: `${label} 已接收并分类当前问题，判断需要平台上下文、工具结果还是通用模型能力。`,
      tone: 'blue'
    },
    {
      label: '上下文利用',
      detail: '如果后端没有返回工具轨迹，前端会展示本轮统一 Agent 的可解释执行摘要。',
      tone: 'green'
    },
    {
      label: '答案生成',
      detail: `回答已按 Markdown 渲染，当前正文长度约 ${answerLength} 字。`,
      tone: 'violet'
    }
  ]
}

async function sendHelper() {
  const question = helperInput.value.trim()
  if (!question || helperSending.value) return

  helperMessages.value.push({ role: 'user', content: question })
  helperInput.value = ''
  helperSending.value = true

  try {
    const response = await agentApi.chat({
      // 当前所有前端 Agent 先统一接入同一个后端 Agent。
      agent_type: 'coordinator',
      message: question,
      context: {
        channel: 'frontend_sidebar',
        human_facing: true,
        selected_agent: selectedHelperAgent.value,
        selected_agent_label: selectedHelperAgentMeta.value.label,
        responder: selectedHelperAgentMeta.value.label
      },
      history: helperMessages.value
        .slice(-8)
        .map((item) => ({ role: item.role, content: item.content }))
    })

    const extras = [
      response.response,
      response.suggestions?.length ? `建议：${response.suggestions.join('；')}` : '',
      response.pending_approvals?.length ? `待审批：${response.pending_approvals.length} 项` : ''
    ]
      .filter(Boolean)
      .join('\n\n')

    helperMessages.value.push({
      role: 'assistant',
      content: extras || '已收到请求，但当前没有可展示的结果。',
      targetLabel: selectedHelperAgentMeta.value.label,
      reasoning: buildHelperReasoning(question, response, selectedHelperAgentMeta.value.label),
      tools: normalizeTools(response.actions_taken),
      grounding: response.grounding
    })
  } catch (error: any) {
    ElMessage.error(error?.message || '助手请求失败')
    helperMessages.value.push({
      role: 'assistant',
      content: '当前助手服务不可用。你仍然可以进入 Agent 页面查看已有任务和状态。'
    })
  } finally {
    helperSending.value = false
  }
}

const currentTitle = computed(() => {
  if (route.path.startsWith('/satellite/')) return '卫星详情'
  for (const group of groups) {
    const match = group.children.find((child) => child.path === route.path)
    if (match) return match.label
  }
  return '运维仪表盘'
})
</script>

<template>
  <div class="ops-shell" :class="{ 'is-dark': isDark }">
    <aside class="sidebar" :class="{ collapsed }">
      <div class="sidebar-header">
        <img v-if="!collapsed" :src="logoUrl" alt="SpaceMAN" class="logo" />
        <span v-if="!collapsed" class="title">SpaceMAN</span>
        <el-icon class="collapse-btn" @click="collapsed = !collapsed">
          <Fold />
        </el-icon>
      </div>

      <nav class="sidebar-menu">
        <section v-for="group in groups" :key="group.id" class="menu-group">
          <div v-if="!collapsed" class="group-title">{{ group.label }}</div>
          <button
            v-for="child in group.children"
            :key="child.path"
            class="menu-item"
            :class="{ active: isActive(child.path) }"
            :title="collapsed ? child.label : ''"
            @click="handleNav(child.path)"
          >
            <el-icon><component :is="child.icon" /></el-icon>
            <span v-if="!collapsed">{{ child.label }}</span>
          </button>
        </section>
      </nav>

      <div class="sidebar-footer">
        <button class="menu-item" @click="toggleTheme">
          <el-icon><Setting /></el-icon>
          <span v-if="!collapsed">{{ isDark ? '浅色模式' : '深色模式' }}</span>
        </button>
        <button class="menu-item" @click="authStore.isAuthenticated ? handleLogout() : (loginVisible = true)">
          <el-icon><User /></el-icon>
          <span v-if="!collapsed" class="truncate">
            {{ authStore.isAuthenticated ? authStore.user?.username || '退出登录' : '登录' }}
          </span>
        </button>
      </div>
    </aside>

    <main class="workspace">
      <header class="workspace-header">
        <div class="breadcrumbs">
          <span class="view-title">{{ currentTitle }}</span>
        </div>
        <div class="actions">
          <el-button plain size="small" @click="router.push('/remote-sensing')">
            <el-icon><Picture /></el-icon>
            <span>遥感工作台</span>
          </el-button>
          <el-button type="primary" plain size="small" @click="agentDrawerVisible = true">
            <el-icon><ChatLineRound /></el-icon>
            <span>智能助手</span>
          </el-button>
        </div>
      </header>

      <div class="workspace-content">
        <RouterView />
      </div>
    </main>

    <aside class="agent-panel" :class="{ 'is-open': agentDrawerVisible }">
      <div class="agent-header">
        <span class="agent-title">智能运维助手</span>
        <el-icon class="agent-close" @click="agentDrawerVisible = false"><Close /></el-icon>
      </div>
      <div class="drawer-chat">
        <div class="chat-groups">
          <div class="chat-group-tabs">
            <button
              class="chat-group-tab"
              :class="{ active: selectedAgentGroup === 'command' }"
              @click="selectAgentGroup('command')"
            >
              指挥链
            </button>
            <button
              class="chat-group-tab"
              :class="{ active: selectedAgentGroup === 'specialist' }"
              @click="selectAgentGroup('specialist')"
            >
              专家组
            </button>
          </div>
          <div class="chat-agent-list">
            <button
              v-for="agent in visibleHelperAgents"
              :key="agent.id"
              class="chat-agent-pill"
              :class="{ active: selectedHelperAgent === agent.id }"
              @click="selectHelperAgent(agent.id)"
            >
              <span>{{ agent.label }}</span>
              <small>{{ agent.status }}</small>
            </button>
          </div>
          <div class="chat-group-note">
            当前选中：{{ selectedHelperAgentMeta.label }}。现阶段所有前端 Agent 统一接入同一个后端智能体。
          </div>
        </div>
        <div class="chat-messages">
          <div
            v-for="(msg, index) in helperMessages"
            :key="index"
            class="msg-card"
            :class="msg.role === 'user' ? 'user-msg' : 'assistant-msg'"
          >
            <div class="msg-role">{{ msg.role === 'user' ? '用户' : msg.targetLabel || '助手' }}</div>
            <div class="msg-content markdown-body" v-html="renderMessage(msg.content)"></div>
            <details v-if="msg.role === 'assistant'" class="helper-reasoning">
              <summary class="helper-reasoning-title">
                <strong>思考过程 / 工具利用链</strong>
                <span>点击展开 · {{ msg.tools?.length || 0 }} 个工具</span>
              </summary>
                <div class="helper-reasoning-body">
                  <div class="helper-reasoning-timeline">
                    <div v-for="step in getHelperReasoning(msg)" :key="step.label" class="helper-reasoning-step" :class="step.tone">
                      <span>{{ step.label }}</span>
                      <p>{{ step.detail }}</p>
                    </div>
                  </div>
                  <div v-if="msg.tools?.length" class="helper-tool-list">
                    <div v-for="tool in msg.tools" :key="`${tool.tool}-${tool.result}`" class="helper-tool-item">
                      <strong>{{ tool.tool }}</strong>
                      <span>{{ tool.result }}</span>
                    </div>
                  </div>
                  <div v-else class="helper-tool-item">
                    <strong>未调用实时工具</strong>
                    <span>本轮按通用模型能力或已有上下文直接生成回答。</span>
                  </div>
                </div>
            </details>
          </div>
        </div>
        <div class="chat-input-area">
          <el-input
            v-model="helperInput"
            placeholder="输入任意问题，例如：分析当前卫星告警、解释黑板状态或写代码"
            :disabled="helperSending"
            @keyup.enter="sendHelper"
          />
          <el-button type="primary" class="send-btn" :loading="helperSending" @click="sendHelper">
            发送
          </el-button>
        </div>
      </div>
    </aside>

    <el-dialog
      v-model="loginVisible"
      title="系统登录"
      width="380px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      center
      class="login-dialog"
    >
      <el-form label-position="top">
        <el-form-item label="用户名">
          <el-input v-model="loginForm.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="loginForm.password"
            type="password"
            placeholder="请输入密码"
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-button type="primary" class="login-btn" @click="handleLogin">
          登录进入系统
        </el-button>
      </el-form>
    </el-dialog>
  </div>
</template>

<style>
:root {
  --vscode-bg: #f6f8fb;
  --vscode-sidebar-bg: #ffffff;
  --vscode-header-bg: #ffffff;
  --vscode-border: #dbe3ef;
  --vscode-text: #172033;
  --vscode-text-muted: #667085;
  --vscode-hover: #eef3fa;
  --vscode-active: #e7f0ff;
  --vscode-primary: #2563eb;
  --vscode-primary-text: #ffffff;
  --vscode-shadow: rgba(15, 23, 42, 0.08);
  --el-color-primary: var(--vscode-primary);
  --el-bg-color: var(--vscode-bg);
  --el-bg-color-overlay: var(--vscode-sidebar-bg);
  --el-text-color-primary: var(--vscode-text);
  --el-text-color-regular: var(--vscode-text-muted);
  --el-border-color: var(--vscode-border);
  --el-border-color-light: var(--vscode-border);
  --el-border-color-lighter: var(--vscode-hover);
}

html.dark {
  --vscode-bg: #0f172a;
  --vscode-sidebar-bg: #151f32;
  --vscode-header-bg: #151f32;
  --vscode-border: rgba(226, 232, 240, 0.12);
  --vscode-text: #f8fafc;
  --vscode-text-muted: #a9b6c8;
  --vscode-hover: rgba(255, 255, 255, 0.07);
  --vscode-active: rgba(37, 99, 235, 0.2);
  --vscode-primary: #60a5fa;
  --vscode-primary-text: #0f172a;
  --vscode-shadow: rgba(0, 0, 0, 0.36);
  --el-bg-color: var(--vscode-bg);
  --el-bg-color-overlay: var(--vscode-sidebar-bg);
  --el-text-color-primary: var(--vscode-text);
  --el-text-color-regular: var(--vscode-text-muted);
  --el-border-color: var(--vscode-border);
  --el-border-color-light: var(--vscode-border);
}

html,
body,
#app {
  margin: 0;
  width: 100%;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: var(--vscode-bg);
  color: var(--vscode-text);
  overflow: hidden;
}

* {
  box-sizing: border-box;
}

button {
  font: inherit;
}

.ops-shell {
  display: flex;
  width: 100vw;
  height: 100vh;
  background: var(--vscode-bg);
  color: var(--vscode-text);
}

.sidebar {
  width: 248px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background: var(--vscode-sidebar-bg);
  border-right: 1px solid var(--vscode-border);
  transition: width 0.2s ease;
}

.sidebar.collapsed {
  width: 64px;
}

.sidebar-header {
  height: 56px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 18px;
  border-bottom: 1px solid var(--vscode-border);
}

.logo {
  width: 26px;
  height: 26px;
}

.title {
  font-weight: 700;
  flex: 1;
}

.collapse-btn {
  cursor: pointer;
  color: var(--vscode-text-muted);
}

.sidebar-menu {
  flex: 1;
  overflow-y: auto;
  padding: 14px 0;
}

.menu-group {
  margin-bottom: 16px;
}

.group-title {
  padding: 0 18px 8px;
  color: var(--vscode-text-muted);
  font-size: 12px;
  font-weight: 700;
}

.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
  border: 0;
  border-left: 3px solid transparent;
  background: transparent;
  color: var(--vscode-text-muted);
  text-align: left;
  cursor: pointer;
}

.sidebar.collapsed .menu-item {
  justify-content: center;
  padding: 13px 0;
  border-left: none;
}

.menu-item:hover {
  background: var(--vscode-hover);
  color: var(--vscode-text);
}

.menu-item.active {
  background: var(--vscode-active);
  border-left-color: var(--vscode-primary);
  color: var(--vscode-primary);
}

.menu-item .el-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.sidebar-footer {
  border-top: 1px solid var(--vscode-border);
  padding: 10px 0;
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.workspace-header {
  height: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 22px;
  border-bottom: 1px solid var(--vscode-border);
  background: var(--vscode-header-bg);
}

.view-title {
  font-size: 16px;
  font-weight: 700;
}

.actions {
  display: flex;
  gap: 8px;
}

.workspace-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.workspace-content .ops-page {
  background:
    linear-gradient(180deg, rgba(37, 99, 235, 0.05), transparent 24%),
    linear-gradient(90deg, rgba(15, 23, 42, 0.03) 1px, transparent 1px),
    linear-gradient(rgba(15, 23, 42, 0.03) 1px, transparent 1px),
    var(--vscode-bg);
  background-size: auto, 28px 28px, 28px 28px, auto;
}

.workspace-content .page-head {
  position: relative;
  padding: 14px 16px;
  border: 1px solid var(--vscode-border);
  border-radius: 8px;
  background:
    linear-gradient(90deg, rgba(37, 99, 235, 0.11), transparent 42%),
    var(--vscode-sidebar-bg);
  box-shadow: 0 10px 24px var(--vscode-shadow);
}

.workspace-content .page-head::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  border-radius: 8px 0 0 8px;
  background: linear-gradient(180deg, #2563eb, #0ea5e9);
}

.workspace-content .page-head h1 {
  letter-spacing: 0;
}

.workspace-content .page-head > div:first-child span {
  color: var(--vscode-primary);
  letter-spacing: 0.04em;
}

.workspace-content .metric-card {
  position: relative;
  overflow: hidden;
  box-shadow: 0 8px 20px var(--vscode-shadow);
  transition: transform 0.16s ease, border-color 0.16s ease;
}

.workspace-content .metric-card:hover {
  transform: translateY(-1px);
  border-color: rgba(37, 99, 235, 0.34);
}

.workspace-content .metric-card::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: #2563eb;
}

.workspace-content .metric-card:nth-child(1) {
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.14), var(--vscode-sidebar-bg) 54%);
}

.workspace-content .metric-card:nth-child(2) {
  background: linear-gradient(135deg, rgba(22, 163, 74, 0.14), var(--vscode-sidebar-bg) 54%);
}

.workspace-content .metric-card:nth-child(2)::before {
  background: #16a34a;
}

.workspace-content .metric-card:nth-child(3) {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.16), var(--vscode-sidebar-bg) 54%);
}

.workspace-content .metric-card:nth-child(3)::before {
  background: #f59e0b;
}

.workspace-content .metric-card:nth-child(4) {
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.14), var(--vscode-sidebar-bg) 54%);
}

.workspace-content .metric-card:nth-child(4)::before {
  background: #0ea5e9;
}

.workspace-content .metric-card strong {
  font-variant-numeric: tabular-nums;
}

.workspace-content .panel {
  border-color: rgba(148, 163, 184, 0.35);
  box-shadow: 0 10px 26px var(--vscode-shadow);
}

.workspace-content .panel-head {
  padding-bottom: 8px;
  border-bottom: 1px solid var(--vscode-border);
}

.workspace-content .panel-head h3 {
  position: relative;
  padding-left: 10px;
}

.workspace-content .panel-head h3::before {
  content: '';
  position: absolute;
  left: 0;
  top: 3px;
  bottom: 3px;
  width: 3px;
  border-radius: 2px;
  background: var(--vscode-primary);
}

.workspace-content .el-table {
  --el-table-header-bg-color: rgba(37, 99, 235, 0.08);
  --el-table-row-hover-bg-color: rgba(37, 99, 235, 0.06);
  border-radius: 8px;
}

.workspace-content .el-table th.el-table__cell {
  color: var(--vscode-text);
  font-weight: 700;
}

.workspace-content .el-tag {
  border-radius: 6px;
  font-weight: 700;
}

.workspace-content .el-button {
  border-radius: 6px;
  font-weight: 700;
}

.workspace-content .topology-canvas,
.workspace-content .dag-canvas,
.workspace-content .evidence-box,
.workspace-content .output-box {
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.05);
}

.workspace-content .topology-node,
.workspace-content .dag-node,
.workspace-content .finding-card,
.workspace-content .engine-card,
.workspace-content .action-card,
.workspace-content .detail-card {
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.06);
}

.workspace-content .workflow-row.active,
.workspace-content .template-row.active {
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.2);
}

html.dark .workspace-content .ops-page {
  background:
    linear-gradient(180deg, rgba(96, 165, 250, 0.08), transparent 24%),
    linear-gradient(90deg, rgba(226, 232, 240, 0.035) 1px, transparent 1px),
    linear-gradient(rgba(226, 232, 240, 0.035) 1px, transparent 1px),
    var(--vscode-bg);
  background-size: auto, 28px 28px, 28px 28px, auto;
}

.agent-panel {
  width: 0;
  flex-shrink: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--vscode-sidebar-bg);
  border-left: 1px solid transparent;
  box-shadow: -8px 0 24px var(--vscode-shadow);
  transition: width 0.2s ease, border-color 0.2s ease;
}

.agent-panel.is-open {
  width: 360px;
  border-left-color: var(--vscode-border);
}

.agent-header {
  min-width: 360px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  border-bottom: 1px solid var(--vscode-border);
}

.agent-title {
  font-weight: 700;
}

.agent-close {
  cursor: pointer;
  color: var(--vscode-text-muted);
}

.drawer-chat {
  min-width: 360px;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chat-groups {
  min-width: 360px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--vscode-border);
  background: color-mix(in srgb, var(--vscode-sidebar-bg) 86%, var(--vscode-primary) 14%);
}

.chat-group-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.chat-group-tab {
  height: 32px;
  border: 1px solid var(--vscode-border);
  border-radius: 6px;
  background: var(--vscode-sidebar-bg);
  color: var(--vscode-text-muted);
  cursor: pointer;
  font-weight: 700;
}

.chat-group-tab.active {
  border-color: var(--vscode-primary);
  background: var(--vscode-primary);
  color: var(--vscode-primary-text);
}

.chat-agent-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.chat-agent-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--vscode-border);
  border-radius: 6px;
  background: var(--vscode-sidebar-bg);
  color: var(--vscode-text);
  cursor: pointer;
  font-size: 12px;
}

.chat-agent-pill span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-agent-pill small {
  flex-shrink: 0;
  color: var(--vscode-text-muted);
  font-size: 11px;
}

.chat-agent-pill.active {
  border-color: var(--vscode-primary);
  background: var(--vscode-active);
}

.chat-group-note {
  margin-top: 8px;
  color: var(--vscode-text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.chat-messages {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  padding: 18px;
}

.msg-card {
  margin-bottom: 14px;
}

.msg-role {
  margin-bottom: 6px;
  color: var(--vscode-text-muted);
  font-size: 12px;
  font-weight: 700;
}

.msg-content {
  padding: 12px 14px;
  border: 1px solid var(--vscode-border);
  border-radius: 12px;
  background: var(--vscode-bg);
  line-height: 1.7;
}

.helper-reasoning {
  margin-top: 8px;
  border: 1px solid color-mix(in srgb, var(--vscode-border) 78%, #2563eb);
  border-radius: 12px;
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.12), transparent 52%),
    color-mix(in srgb, var(--vscode-bg) 88%, transparent);
  overflow: hidden;
}

.helper-reasoning summary {
  list-style: none;
}

.helper-reasoning summary::-webkit-details-marker {
  display: none;
}

.helper-reasoning[open] .helper-reasoning-title {
  border-bottom: 1px solid var(--vscode-border);
}

.helper-reasoning-title {
  min-width: 0;
  width: 100%;
  height: 40px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.helper-reasoning-title::before {
  content: '';
  flex: 0 0 auto;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.14), 0 0 14px rgba(34, 197, 94, 0.42);
}

.helper-reasoning-title strong,
.helper-reasoning-title span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.helper-reasoning-title strong {
  font-size: 12px;
}

.helper-reasoning-title span {
  margin-left: auto;
  color: var(--vscode-text-muted);
  font-size: 12px;
}

.helper-reasoning-body {
  max-height: 260px;
  overflow: auto;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(160px, 0.9fr);
  gap: 10px;
  padding: 10px;
}

.helper-reasoning-timeline {
  position: relative;
  min-width: 0;
  display: grid;
  gap: 8px;
  padding-left: 6px;
}

.helper-reasoning-timeline::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 18px;
  bottom: 18px;
  width: 1px;
  background: linear-gradient(180deg, rgba(37, 99, 235, 0.65), rgba(124, 58, 237, 0.26));
}

.helper-reasoning-step,
.helper-tool-item {
  position: relative;
  min-width: 0;
  padding: 9px 10px 9px 14px;
  border: 1px solid var(--vscode-border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--vscode-sidebar-bg) 76%, transparent);
}

.helper-reasoning-step {
  border-left: 0;
}

.helper-reasoning-step::before {
  content: '';
  position: absolute;
  left: -5px;
  top: 14px;
  width: 9px;
  height: 9px;
  border: 2px solid #2563eb;
  border-radius: 50%;
  background: var(--vscode-sidebar-bg);
}

.helper-reasoning-step.green::before {
  border-color: #16a34a;
}

.helper-reasoning-step.amber::before {
  border-color: #f59e0b;
}

.helper-reasoning-step.violet::before {
  border-color: #7c3aed;
}

.helper-reasoning-step span,
.helper-tool-item strong {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 800;
}

.helper-reasoning-step p,
.helper-tool-item span {
  margin: 0;
  color: var(--vscode-text-muted);
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.helper-tool-list {
  display: grid;
  gap: 7px;
}

.helper-tool-list,
.helper-tool-item {
  align-self: start;
}

@media (max-width: 1180px) {
  .helper-reasoning-body {
    grid-template-columns: 1fr;
  }
}

.markdown-body {
  color: var(--vscode-text);
  overflow-wrap: anywhere;
  word-break: break-word;
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4 {
  margin: 12px 0 8px;
  line-height: 1.28;
  letter-spacing: 0;
}

.markdown-body h1 {
  font-size: 22px;
}

.markdown-body h2 {
  font-size: 19px;
}

.markdown-body h3 {
  font-size: 17px;
}

.markdown-body h4 {
  font-size: 15px;
}

.markdown-body p {
  margin: 8px 0;
}

.markdown-body ul,
.markdown-body ol {
  margin: 8px 0;
  padding-left: 20px;
}

.markdown-body li {
  margin: 4px 0;
}

.markdown-body strong {
  color: var(--vscode-text);
  font-weight: 800;
}

.markdown-body a {
  color: var(--vscode-primary);
  text-decoration: none;
}

.markdown-body a:hover {
  text-decoration: underline;
}

.markdown-body code {
  padding: 2px 5px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--vscode-hover) 82%, #2563eb);
  color: var(--vscode-text);
  font-family: 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.92em;
}

.markdown-body pre {
  margin: 10px 0;
  padding: 12px;
  border: 1px solid var(--vscode-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--vscode-bg) 78%, #0f172a);
  overflow: auto;
}

.markdown-body pre code {
  display: block;
  padding: 0;
  background: transparent;
  white-space: pre;
}

.markdown-body blockquote {
  margin: 10px 0;
  padding: 8px 12px;
  border-left: 3px solid var(--vscode-primary);
  border-radius: 6px;
  background: color-mix(in srgb, var(--vscode-hover) 70%, transparent);
  color: var(--vscode-text-muted);
}

.markdown-body hr {
  margin: 12px 0;
  border: 0;
  border-top: 1px solid var(--vscode-border);
}

.markdown-body .md-table-wrap {
  width: 100%;
  margin: 10px 0;
  overflow-x: auto;
  border: 1px solid var(--vscode-border);
  border-radius: 8px;
}

.markdown-body table {
  width: 100%;
  min-width: 520px;
  border-collapse: collapse;
  font-size: 13px;
}

.markdown-body th,
.markdown-body td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--vscode-border);
  border-right: 1px solid var(--vscode-border);
  text-align: left;
  vertical-align: top;
}

.markdown-body th {
  background: color-mix(in srgb, var(--vscode-hover) 72%, #2563eb);
  color: var(--vscode-text);
  font-weight: 800;
}

.markdown-body tr:last-child td {
  border-bottom: 0;
}

.markdown-body th:last-child,
.markdown-body td:last-child {
  border-right: 0;
}

.markdown-body .math-inline,
.markdown-body .math-block {
  font-family: 'Cambria Math', 'Times New Roman', serif;
  color: color-mix(in srgb, var(--vscode-text) 86%, #2563eb);
}

.markdown-body .math-block {
  display: block;
  margin: 10px 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--vscode-hover) 64%, transparent);
  overflow-x: auto;
  white-space: pre-wrap;
}

.assistant-msg .msg-role {
  color: var(--vscode-primary);
}

.chat-input-area {
  padding: 16px;
  border-top: 1px solid var(--vscode-border);
}

.send-btn,
.login-btn {
  width: 100%;
  margin-top: 10px;
}

.login-dialog .el-dialog {
  border-radius: 14px;
  background: var(--vscode-sidebar-bg);
}
</style>
