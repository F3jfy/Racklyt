pub mod alerts;
pub mod auth;
pub mod dashboards;
pub mod ingest;
pub mod install;
pub mod metrics;
pub mod node_management;
pub mod nodes;
pub mod notifications;
pub mod smtp;
pub mod system;
pub mod users;
pub mod ws;

use axum::{
    routing::{delete, get, post, put},
    Router,
};

pub fn build_api_router() -> Router {
    Router::new()
        // One-Line Agent Deployment & Binary Downloads
        .route("/install.sh", get(install::install_script_handler))
        .route("/api/v1/install.sh", get(install::install_script_handler))
        .route(
            "/download/racklyt-agent",
            get(install::download_agent_binary_handler),
        )
        .route(
            "/download/racklyt-agent.py",
            get(install::download_agent_python_handler),
        )
        // Auth & Security & 2-Phase Login
        .route("/api/v1/auth/login", post(auth::login_handler))
        .route(
            "/api/v1/auth/2fa/verify",
            post(auth::two_factor_verify_handler),
        )
        .route(
            "/api/v1/auth/2fa/re-enroll",
            post(auth::two_factor_re_enroll_handler),
        )
        .route("/api/v1/auth/2fa/status", get(auth::get_2fa_status_handler))
        .route("/api/v1/auth/2fa/setup", post(auth::setup_2fa_handler))
        .route("/api/v1/auth/2fa/enable", post(auth::enable_2fa_handler))
        .route("/api/v1/auth/2fa/disable", post(auth::disable_2fa_handler))
        .route("/api/v1/auth/logout", post(auth::logout_handler))
        .route("/api/v1/auth/me", get(auth::me_handler))
        .route(
            "/api/v1/auth/change-password",
            post(auth::change_password_handler),
        )
        .route("/api/v1/auth/audit-log", get(auth::audit_log_handler))
        .route(
            "/api/v1/auth/active-sessions",
            get(auth::active_sessions_handler),
        )
        .route(
            "/api/v1/auth/active-sessions/:token",
            delete(auth::revoke_session_handler),
        )
        // System & Onboarding
        .route(
            "/api/v1/system/setup-status",
            get(system::get_setup_status_handler),
        )
        .route(
            "/api/v1/system/setup-complete",
            post(system::complete_setup_handler),
        )
        .route(
            "/api/v1/system/settings",
            get(system::get_system_settings_handler)
                .post(system::update_system_settings_handler)
                .put(system::update_system_settings_handler),
        )
        .route(
            "/api/v1/system/maintenance/vacuum",
            post(system::vacuum_database_handler),
        )
        .route(
            "/api/v1/system/maintenance/stats",
            get(system::get_database_stats_handler),
        )
        .route(
            "/api/v1/system/test-discord",
            post(system::test_discord_handler),
        )
        // Multi-Account RBAC & Server Scopes
        .route(
            "/api/v1/users",
            get(users::list_users_handler).post(users::create_user_handler),
        )
        .route("/api/v1/users/:id", delete(users::delete_user_handler))
        .route(
            "/api/v1/users/:id/scopes",
            put(users::update_user_scopes_handler),
        )
        .route("/api/v1/roles", get(users::list_roles_handler))
        // Nodes & Deep Dive Diagnostics
        .route("/api/v1/nodes", get(nodes::list_nodes_handler))
        .route(
            "/api/v1/nodes/spawn-test-node",
            post(nodes::spawn_test_node_handler),
        )
        .route(
            "/api/v1/nodes/:id",
            get(nodes::get_node_handler).delete(nodes::delete_node_handler),
        )
        .route(
            "/api/v1/nodes/:id/deepdive",
            get(node_management::get_node_deepdive_handler),
        )
        .route(
            "/api/v1/nodes/:id/processes",
            get(node_management::get_node_processes_handler),
        )
        .route(
            "/api/v1/nodes/:id/processes/:pid/kill",
            post(node_management::kill_process_handler),
        )
        .route(
            "/api/v1/nodes/:id/services",
            get(node_management::get_node_services_handler),
        )
        .route(
            "/api/v1/nodes/:id/services/:service_name/action",
            post(node_management::service_action_handler),
        )
        .route(
            "/api/v1/nodes/:id/containers",
            get(node_management::get_node_containers_handler),
        )
        .route(
            "/api/v1/nodes/:id/containers/:container_id/action",
            post(node_management::container_action_handler),
        )
        .route(
            "/api/v1/nodes/:id/containers/:container_id/logs",
            get(node_management::get_container_logs_handler),
        )
        .route(
            "/api/v1/nodes/:id/journal",
            get(node_management::get_node_journal_handler),
        )
        .route(
            "/api/v1/nodes/:id/sockets",
            get(node_management::get_node_sockets_handler),
        )
        // Alert Rules Engine
        .route(
            "/api/v1/alerts/rules",
            get(alerts::list_alert_rules_handler).post(alerts::create_alert_rule_handler),
        )
        .route(
            "/api/v1/alerts/rules/:id",
            put(alerts::update_alert_rule_handler).delete(alerts::delete_alert_rule_handler),
        )
        .route(
            "/api/v1/alerts/rules/:id/toggle",
            post(alerts::toggle_alert_rule_handler),
        )
        // Historical Metrics Telemetry Query
        .route("/api/v1/metrics/query", get(metrics::query_metrics_handler))
        // Proxmox VE Hypervisor Power Controls & Cluster Overcommit
        .route(
            "/api/v1/proxmox/cluster",
            get(node_management::get_proxmox_cluster_handler),
        )
        .route(
            "/api/v1/proxmox/:type/:vmid/action",
            post(node_management::proxmox_power_action_handler),
        )
        // Dashboards
        .route(
            "/api/v1/dashboards",
            get(dashboards::list_dashboards_handler).post(dashboards::create_dashboard_handler),
        )
        .route(
            "/api/v1/dashboards/:id",
            get(dashboards::get_dashboard_handler)
                .put(dashboards::update_dashboard_handler)
                .delete(dashboards::delete_dashboard_handler),
        )
        // Notifications & Mobile App API
        .route(
            "/api/v1/notifications",
            get(notifications::list_notifications_handler),
        )
        .route(
            "/api/v1/notifications/unread-count",
            get(notifications::unread_count_handler),
        )
        .route(
            "/api/v1/notifications/:id/ack",
            post(notifications::ack_notification_handler),
        )
        .route(
            "/api/v1/notifications/stream",
            get(notifications::sse_stream_handler),
        )
        .route(
            "/api/v1/devices/push",
            post(notifications::register_device_handler),
        )
        // Ingest
        .route(
            "/api/v1/ingest/metrics",
            post(ingest::ingest_metrics_handler),
        )
        // Email / SMTP
        .route(
            "/api/v1/settings/smtp",
            get(smtp::get_smtp_handler).put(smtp::update_smtp_handler),
        )
        .route("/api/v1/settings/smtp/test", post(smtp::test_smtp_handler))
        // WebSocket live feed
        .route("/ws", get(ws::ws_handler))
        .route("/api/v1/ws", get(ws::ws_handler))
}
