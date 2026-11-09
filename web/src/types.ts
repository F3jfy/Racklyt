export interface User {
  id: string;
  username: string;
  email?: string;
  role_id: string;
  is_active: boolean;
  password_locked?: boolean;
  two_factor_enabled?: boolean;
  two_factor_enforced?: boolean;
  initial_generated_password?: string;
  scopes?: ResourceScope[];
  created_at: number;
}

export interface Role {
  id: string;
  name: string;
  is_system: boolean;
  permissions: string[];
}

export type ResourceScope = 
  | { type: 'Global'; value?: string }
  | { type: 'Node'; value: string }
  | { type: 'Cluster'; value: string }
  | { type: 'Tag'; value: string };

export type NodeStatus = 'online' | 'degraded' | 'offline';

export interface NodeMetricsSnapshot {
  cpu_percent?: number;
  memory_used_bytes?: number;
  memory_total_bytes?: number;
  disk_used_bytes?: number;
  disk_total_bytes?: number;
  net_rx_bytes?: number;
  net_tx_bytes?: number;
  temp_celsius?: number;
  timestamp?: number;
}

export interface Node {
  id: string;
  name: string;
  hostname: string;
  os: string;
  arch: string;
  ip_address?: string;
  status: NodeStatus;
  push_interval_sec: number;
  tags: string[];
  last_seen_at?: number;
  created_at: number;
  latest_metrics?: NodeMetricsSnapshot;
}

export type WidgetType =
  | 'fleet-status'
  | 'stat-card'
  | 'time-series'
  | 'circular-gauge'
  | 'storage-gauge'
  | 'recent-alerts'
  | 'sysinfo'
  | 'cpu-breakdown'
  | 'network-traffic'
  | 'docker-fleet'
  | 'proxmox-summary'
  | 'log-stream'
  | 'ports-table';

export interface WidgetConfig {
  id: string;
  widget_type: WidgetType | string;
  title: string;
  grid_x: number;
  grid_y: number;
  grid_w: number;
  grid_h: number;
  config: Record<string, any>;
}

export interface DashboardConfig {
  id: string;
  user_id?: string;
  title: string;
  description?: string;
  is_default: boolean;
  is_public: boolean;
  widgets: WidgetConfig[];
  widget_count?: number;
  created_at: number;
  updated_at: number;
}

export interface NotificationItem {
  id: string;
  user_id?: string;
  alert_id: string;
  node_id?: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  body: string;
  deep_link?: string;
  is_read: boolean;
  is_acknowledged: boolean;
  sent_at: number;
}

export interface SmtpConfig {
  host: string;
  port: number;
  username?: string;
  from_address: string;
  tls_mode: string;
  is_enabled: boolean;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: 'cpu' | 'memory' | 'temp' | 'disk' | 'heartbeat';
  operator: '>' | '>=' | '<' | '<=' | '==';
  threshold: number;
  duration_seconds: number;
  severity: 'info' | 'warning' | 'critical';
  target_node_id?: string | null;
  channel: string;
  is_enabled: boolean;
  created_at: number;
}

export interface MetricPoint {
  timestamp: number;
  value: number;
}

export interface MetricsHistoryResponse {
  node_id: string;
  metric: string;
  range: string;
  points: MetricPoint[];
}
