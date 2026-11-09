use serde::{Deserialize, Serialize};

/// Node operational status
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum NodeStatus {
    Online,
    Degraded,
    #[default]
    Offline,
}

/// Representation of a monitored host (Server, RPi, etc.)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node {
    pub id: String,
    pub name: String,
    pub hostname: String,
    pub os: String,
    pub arch: String,
    pub ip_address: Option<String>,
    pub status: NodeStatus,
    pub push_interval_sec: u32,
    pub tags: Vec<String>,
    pub last_seen_at: Option<i64>,
    pub created_at: i64,
}

/// Incoming metric payload pushed by racklyt-agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetricsPayload {
    pub node_id: String,
    pub timestamp: i64,
    pub cpu: CpuMetric,
    pub memory: MemoryMetric,
    pub disks: Vec<DiskMetric>,
    pub network: Vec<NetworkMetric>,
    pub temperature_celsius: Option<f32>,
    pub uptime_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpuMetric {
    pub usage_percent: f32,
    pub per_core_percent: Vec<f32>,
    pub load_avg: [f32; 3], // 1m, 5m, 15m
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryMetric {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub free_bytes: u64,
    pub swap_total_bytes: u64,
    pub swap_used_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskMetric {
    pub mount_point: String,
    pub filesystem: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkMetric {
    pub interface: String,
    pub rx_bytes: u64,
    pub tx_bytes: u64,
    pub rx_errors: u64,
    pub tx_errors: u64,
}

/// User account representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub email: Option<String>,
    pub role_id: String,
    pub is_active: bool,
    #[serde(default)]
    pub password_locked: bool,
    #[serde(default)]
    pub two_factor_enabled: bool,
    #[serde(default)]
    pub two_factor_enforced: bool,
    #[serde(default)]
    pub initial_generated_password: Option<String>,
    #[serde(default)]
    pub scopes: Vec<ResourceScope>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Login audit event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginAuditEntry {
    pub id: String,
    pub user_id: Option<String>,
    pub username: String,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub status: String,
    pub failure_reason: Option<String>,
    pub attempted_at: i64,
}

/// Access role with permissions list
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Role {
    pub id: String,
    pub name: String,
    pub is_system: bool,
    pub permissions: Vec<String>,
    pub created_at: i64,
}

/// Scope restricting a user's view to specific resources
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", content = "value")]
pub enum ResourceScope {
    Global,
    Node(String),
    Cluster(String),
    Tag(String),
}

/// Notification / Alert severity
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AlertSeverity {
    Info,
    Warning,
    Critical,
}

/// Notification Item for Web and Mobile inbox
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationItem {
    pub id: String,
    pub user_id: Option<String>,
    pub alert_id: String,
    pub node_id: Option<String>,
    pub severity: AlertSeverity,
    pub title: String,
    pub body: String,
    pub deep_link: Option<String>,
    pub is_read: bool,
    pub is_acknowledged: bool,
    pub sent_at: i64,
}

/// Push notification registered device for iOS/Android
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationDevice {
    pub id: String,
    pub user_id: String,
    pub device_name: String,
    pub platform: String, // "ios", "android", "web"
    pub push_token: String,
    pub is_active: bool,
    pub created_at: i64,
    pub last_used_at: Option<i64>,
}

/// Editable Dashboard Layout
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardConfig {
    pub id: String,
    pub user_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub is_default: bool,
    pub is_public: bool,
    pub widgets: Vec<WidgetConfig>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Configurable Dashboard Widget
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WidgetConfig {
    pub id: String,
    pub widget_type: String, // e.g. "stat-card", "time-series", "fleet-status", "storage-gauge"
    pub title: String,
    pub grid_x: u32,
    pub grid_y: u32,
    pub grid_w: u32,
    pub grid_h: u32,
    pub config: serde_json::Value,
}

/// SMTP configuration for email alerts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    pub username: Option<String>,
    pub from_address: String,
    pub tls_mode: String, // "none", "starttls", "tls"
    pub is_enabled: bool,
}

/// Dynamic alert threshold rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertRule {
    pub id: String,
    pub name: String,
    pub metric: String,   // "cpu", "memory", "temp", "disk", "heartbeat"
    pub operator: String, // ">", ">=", "<", "<=", "=="
    pub threshold: f64,
    pub duration_seconds: u32,
    pub severity: AlertSeverity,
    pub target_node_id: Option<String>,
    pub channel: String, // "all", "email", "discord", "inbox"
    pub is_enabled: bool,
    pub created_at: i64,
}

/// Single historical time-series data point
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricPoint {
    pub timestamp: i64,
    pub value: f64,
}

/// Response payload for /api/v1/metrics/query
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsHistoryResponse {
    pub node_id: String,
    pub metric: String,
    pub range: String,
    pub points: Vec<MetricPoint>,
}
