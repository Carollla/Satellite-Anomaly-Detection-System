import { createRouter, createWebHashHistory } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'

const Dashboard = () => import('../views/Dashboard.vue')
const EarthView = () => import('../views/EarthView.vue')
const VisualEditor = () => import('../views/VisualEditor.vue')
const RemoteSensingWorkbench = () => import('../views/RemoteSensingWorkbench.vue')
const InstanceManagement = () => import('../views/topology/InstanceManagement.vue')
const LinkManagement = () => import('../views/topology/LinkManagement.vue')
const AgentChat = () => import('../views/AgentChat.vue')
const DagPipeline = () => import('../views/Workflows.vue')
const Blackboard = () => import('../views/Blackboard.vue')
const Faults = () => import('../views/Faults.vue')
const SatelliteDetail = () => import('../views/SatelliteDetail.vue')
const SecurityAudit = () => import('../views/SecurityAudit.vue')
const LlmStatus = () => import('../views/LlmStatus.vue')

const routes = [
  { path: '/', component: Dashboard, meta: { requiresAuth: true } },
  { path: '/earth', component: EarthView, meta: { requiresAuth: true } },
  { path: '/editor', component: VisualEditor, meta: { requiresAuth: true } },
  { path: '/remote-sensing', component: RemoteSensingWorkbench, meta: { requiresAuth: true } },
  { path: '/instances', component: InstanceManagement, meta: { requiresAuth: true } },
  { path: '/links', component: LinkManagement, meta: { requiresAuth: true } },
  { path: '/agent', component: AgentChat, meta: { requiresAuth: true } },
  { path: '/dag-pipeline', component: DagPipeline, meta: { requiresAuth: true } },
  { path: '/blackboard', component: Blackboard, meta: { requiresAuth: true } },
  { path: '/faults', component: Faults, meta: { requiresAuth: true } },
  { path: '/satellite/:id', component: SatelliteDetail, props: true, meta: { requiresAuth: true } },
  { path: '/security', component: SecurityAudit, meta: { requiresAuth: true } },
  { path: '/llm', component: LlmStatus, meta: { requiresAuth: true } },
  { path: '/topology/instances', redirect: '/instances' },
  { path: '/topology/links', redirect: '/links' },
  { path: '/workflows', redirect: '/dag-pipeline' },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()

  if (to.path === '/security' && authStore.user?.role === 'viewer') {
    ElMessage.warning('当前账号没有审计权限')
  }

  next()
})

export default router
