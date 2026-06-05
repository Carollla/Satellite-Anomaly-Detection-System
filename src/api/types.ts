export interface ApiResponse<T = any> {
  code: number
  msg: string
  data: T
}

export interface PageRequest {
  page_index?: number
  page_size?: number
  key_word?: string
}

export interface Instance {
  instance_id: string
  name: string
  type: string
  start: boolean
  node_index: number
  extra: Record<string, string>
}

export interface ResourceLimit {
  nano_cpu: number
  memory_byte: number
}

export interface ConnectionInfo {
  link_id: string
  instance_id: string
  instance_type: string
  end_node_index: number
}

export interface InstanceDetail extends Instance {
  image: string
  resource_limit: ResourceLimit
  connections: Record<string, ConnectionInfo>
}

export interface InstanceResource {
  cpu_usage: number
  mem_byte: number
  swap_mem_byte: number
}

export interface LinkResource {
  recv_bps: number
  send_bps: number
  recv_pps: number
  send_pps: number
  recv_err_pps: number
  send_err_pps: number
  recv_drop_pps: number
  send_drop_pps: number
}

export interface HostResource {
  cpu_usage: number
  mem_byte: number
  swap_mem_byte: number
}

export interface TimedInstanceResource extends InstanceResource {
  time: string
}

export interface TimedLinkResource extends LinkResource {
  time: string
}

export interface TimedHostResource extends HostResource {
  time: string
}

export interface Link {
  link_id: string
  type: string
  enable: boolean
  connect_instance: [string, string]
  node_index: number
}

export interface LinkDetail extends Link {
  address_infos: [Record<string, string>, Record<string, string>]
  end_infos: [EndInfo, EndInfo]
  extra: Record<string, string>
}

export interface EndInfo {
  instance_id: string
  instance_type: string
  end_node_index: number
}

export interface Node {
  node_index: number
  free_instance: number
  is_master_node: boolean
  l_3_addr_v_4: string
  l_3_addr_v_6: string
  l_2_addr: string
}

export interface InstanceTypeConfig {
  image: string
  envs: Record<string, string>
  resource_limit: ResourceLimit
}

export interface EmulationConfig {
  instance_type_config: Record<string, InstanceTypeConfig>
  running: boolean
}

export interface TopologyInstance {
  type: string
  extra?: Record<string, string>
  device_need?: Record<string, DeviceRequireInfo>
}

export interface DeviceRequireInfo {
  dev_name: string
  need_num: number
  is_mutex: boolean
}

export interface TopologyLink {
  end_indexes: [number, number]
  type: string
  init_parameter?: Record<string, number>
  address_infos?: [Record<string, string>, Record<string, string>]
  extra?: Record<string, string>
}

export interface TopologyRequest {
  instances: TopologyInstance[]
  links: TopologyLink[]
}

export interface TypeConfigRequest {
  image: string
  container_envs?: Record<string, string>
  resource_limit: {
    nano_cpu: string
    memory_byte: string
  }
}

export type ConfigEmulationRequest = Record<string, TypeConfigRequest>

export interface Position {
  latitude: number
  longitude: number
  altitude: number
}

export type PositionMap = Record<string, Position>

// ===== 故障注入 / 异常相关 =====

export interface Fault {
  fault_id: string
  type: string
  target: string
  status: 'active' | 'resolved'
  parameters: Record<string, any>
  created_at: string
  resolved_at?: string
}

// ===== 卫星状态 / 控制 =====

export interface SatelliteAttitude {
  pitch: number
  yaw: number
  roll: number
}

export interface SatellitePower {
  battery_percent: number
  solar_panel_active: boolean
  power_mode: string
}

export interface SatelliteCommunication {
  band: string
  frequency_ghz: number
  power_dbm: number
}

export interface SatelliteThermal {
  internal_temp_c: number
  external_temp_c: number
}

export interface SatellitePayload {
  id: string
  name: string
  status: string
}

export interface SatelliteStatus {
  satellite_id: string
  status: string
  mode: string
  attitude: SatelliteAttitude
  power: SatellitePower
  communication: SatelliteCommunication
  thermal: SatelliteThermal
  payloads?: SatellitePayload[]
}

// ===== Agent / LLM / 工作流 =====

export interface AgentCoordinatorStatus {
  status: string
  model: string
  provider: string
  active_tasks: number
}

export interface AgentSpecialistStatus {
  name: string
  status: string
  pending_actions: number
  model?: string
}

export interface AgentEdgeStatus {
  satellite_id: string
  status: string
  last_heartbeat: string
  model?: string
}

export interface AgentStatus {
  coordinator: AgentCoordinatorStatus
  specialists: AgentSpecialistStatus[]
  edge_agents: AgentEdgeStatus[]
}

export interface AgentChatHistoryItem {
  role: 'user' | 'assistant'
  content: string
}

export interface AgentChatRequest {
  agent_type: 'coordinator' | 'network' | 'health' | 'data' | 'ops' | 'security' | string
  message: string
  context?: Record<string, any>
  history?: AgentChatHistoryItem[]
}

export interface PendingApproval {
  id: string
  action: string
  target: string
  parameters: Record<string, any>
  security_level: string
}

export interface AgentChatResponse {
  response: string
  actions_taken: any[]
  suggestions: string[]
  pending_approvals: PendingApproval[]
  grounding?: {
    llm_used?: boolean
    tool_count?: number
    generated_at?: string
    [key: string]: any
  }
}

export interface AgentTaskAction {
  tool: string
  status: string
  result: any
}

export interface AgentTask {
  task_id: string
  agent_type: string
  description: string
  status: 'running' | 'pending' | 'completed' | 'failed'
  created_at: string
  progress: number
  actions: AgentTaskAction[]
}

export interface WorkflowSummary {
  workflow_id: string
  name: string
  status: string
  steps_count: number
  created_at: string
}

export interface WorkflowStep {
  id: string
  name: string
  tool: string
  params: Record<string, any>
  condition?: string
}

export interface WorkflowDetail {
  workflow_id: string
  name: string
  description: string
  status: string
  steps: WorkflowStep[]
  created_at: string
}

export interface WorkflowExecution {
  execution_id: string
  workflow_id: string
  status: string
  progress?: number
  started_at?: string
  finished_at?: string
}

export interface WorkflowTemplate {
  template_id: string
  name: string
  description: string
  category: string
}

// ===== LLM 状态 / 配置 =====

export interface LlmEngineStatus {
  status: string
  model: string
  [key: string]: any
}

export interface LlmStatus {
  [engine: string]: LlmEngineStatus
}

export interface LlmConfig {
  [key: string]: any
}

export interface LlmGenerateRequest {
  model?: string
  prompt: string
  max_tokens?: number
  temperature?: number
  [key: string]: any
}

export interface LlmGenerateResponse {
  output: string
  usage?: Record<string, any>
}

export interface LlmTestResult {
  connected: boolean
  provider: string
  model: string
  endpoint: string
  reply: string
}

// ===== 安全 / 审计 =====

export interface AuditLog {
  log_id: string
  timestamp: string
  user: string
  action: string
  target: string
  result: string
  details?: Record<string, any>
  ip_address?: string
}


export interface FileInfo {
  name: string
  size: number
  modify_time: string
  is_dir: boolean
}

// ===== SatOps v4.0 coordinator / DAG / blackboard =====

export interface CoordinatorChatRequest {
  message: string
  trace_id?: string
}

export interface CoordinatorChatAcceptance {
  trace_id: string
  status: string
  message: string
}

export interface TracePlanItem {
  task: string
  assignee: string
  status: 'pending' | 'running' | 'completed' | 'failed'
}

export interface TraceReview {
  summary: string
  verdict: string
  approved_actions?: string[]
}

export interface TraceDetail {
  trace_id: string
  current_phase: 'plan' | 'execute' | 'review' | 'completed'
  plan: TracePlanItem[]
  final_review: TraceReview | null
}

export interface BlackboardState {
  trace_id: string
  findings: Record<string, any>
  updated_at: string
}

export interface SandboxFileResponse {
  path: string
  content: string
  mime_type?: string
}

export interface ApprovalRequest {
  request_id: string
  action: string
  target: string
  security_level: 'high' | 'critical' | string
  reason?: string
  created_at: string
  status: 'pending' | 'approved' | 'rejected'
}

export interface ApprovalDecisionRequest {
  decision: 'approve' | 'reject'
  reason: string
}

export interface RemoteSensingTaskRequest {
  target_latitude: number
  target_longitude: number
  task_type: string
  priority: 'low' | 'medium' | 'high'
}

export interface FastLineRequest {
  source_gs_id: string
  dest_gs_id: string
  bandwidth_mbps: number
  latency_limit_ms: number
}

export interface A2ANegotiation {
  negotiation_id: string
  type: string
  status: string
  participating_agents: string[]
  result: string
}

// ===== God Node (卫星物理操作) v1 =====

export interface GodNodeOrbitalState {
  altitude_km: number
  velocity_kmps: number
  inclination_deg: number
  eccentricity: number
  semi_major_axis_km: number
}

export interface GodNodeState {
  satellite_id: string
  mode: string
  orbital: GodNodeOrbitalState
  attitude: SatelliteAttitude
  power: SatellitePower
  timestamp: string
}

export interface GodNodeActionRequest {
  satellite_id: string
  action_type: string
  parameters: Record<string, any>
}

export interface GodNodeActionResponse {
  action_id: string
  status: string
  message?: string
}

export interface GodNodeLinksRequest {
  satellite_ids?: string[]
  link_type?: string
}

export interface GodNodeLink {
  link_id: string
  source: string
  target: string
  status: string
  link_type?: string
  latency_ms?: number
  bandwidth_mbps?: number
}
