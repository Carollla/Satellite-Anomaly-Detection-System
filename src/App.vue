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
const helperMessages = ref<HelperMessage[]>([
  {
    role: 'assistant',
    content: '这里是 SpaceMAN 智能运维助手。你可以让我检查卫星告警、分析链路异常、生成遥感任务建议，或者给出下一步处置方案。'
  }
])

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

async function sendHelper() {
  const question = helperInput.value.trim()
  if (!question || helperSending.value) return

  helperMessages.value.push({ role: 'user', content: question })
  helperInput.value = ''
  helperSending.value = true

  try {
    const response = await agentApi.chat({
      agent_type: 'coordinator',
      message: question,
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
      content: extras || '已收到请求，但当前没有可展示的结果。'
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
        <div class="chat-messages">
          <div
            v-for="(msg, index) in helperMessages"
            :key="index"
            class="msg-card"
            :class="msg.role === 'user' ? 'user-msg' : 'assistant-msg'"
          >
            <div class="msg-role">{{ msg.role === 'user' ? '用户' : '助手' }}</div>
            <div class="msg-content">{{ msg.content }}</div>
          </div>
        </div>
        <div class="chat-input-area">
          <el-input
            v-model="helperInput"
            placeholder="输入运维问题，例如：分析当前卫星告警"
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
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
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
