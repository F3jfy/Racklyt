use crate::{auth::AuthUser, db::DbPool};
use axum::{
    extract::{Extension, Path},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use racklyt_common::{AlertRule, AlertSeverity};
use serde::Deserialize;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct CreateAlertRulePayload {
    pub name: String,
    pub metric: String,
    pub operator: String,
    pub threshold: f64,
    pub duration_seconds: Option<u32>,
    pub severity: Option<String>,
    pub target_node_id: Option<String>,
    pub channel: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateAlertRulePayload {
    pub name: Option<String>,
    pub metric: Option<String>,
    pub operator: Option<String>,
    pub threshold: Option<f64>,
    pub duration_seconds: Option<u32>,
    pub severity: Option<String>,
    pub target_node_id: Option<String>,
    pub channel: Option<String>,
    pub is_enabled: Option<bool>,
}

pub async fn list_alert_rules_handler(
    user: AuthUser,
    Extension(pool): Extension<DbPool>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    if !user.has_permission("alerts:configure") && !user.has_permission("metrics:read") {
        return Err((StatusCode::FORBIDDEN, "Forbidden"));
    }

    let conn = pool.get().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Database connection error",
        )
    })?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, metric, operator, threshold, duration_seconds, severity, target_node_id, channel, is_enabled, created_at
             FROM alert_rules ORDER BY created_at ASC"
        )
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to prepare query"))?;

    let rules = stmt
        .query_map([], |row| {
            let sev_str: String = row.get(6)?;
            let severity = match sev_str.as_str() {
                "critical" => AlertSeverity::Critical,
                "info" => AlertSeverity::Info,
                _ => AlertSeverity::Warning,
            };

            Ok(AlertRule {
                id: row.get(0)?,
                name: row.get(1)?,
                metric: row.get(2)?,
                operator: row.get(3)?,
                threshold: row.get(4)?,
                duration_seconds: row.get(5)?,
                severity,
                target_node_id: row.get(7)?,
                channel: row.get(8)?,
                is_enabled: row.get::<_, i64>(9)? == 1,
                created_at: row.get(10)?,
            })
        })
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to execute query"))?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();

    Ok(Json(rules))
}

pub async fn create_alert_rule_handler(
    user: AuthUser,
    Extension(pool): Extension<DbPool>,
    Json(payload): Json<CreateAlertRulePayload>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    if !user.has_permission("alerts:configure") {
        return Err((StatusCode::FORBIDDEN, "Forbidden"));
    }

    let conn = pool.get().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Database connection error",
        )
    })?;
    let id = format!("rule_{}", Uuid::new_v4().simple());
    let now = chrono::Utc::now().timestamp();
    let duration = payload.duration_seconds.unwrap_or(60);
    let severity = payload.severity.unwrap_or_else(|| "warning".to_string());
    let channel = payload.channel.unwrap_or_else(|| "all".to_string());

    conn.execute(
        "INSERT INTO alert_rules (id, name, metric, operator, threshold, duration_seconds, severity, target_node_id, channel, is_enabled, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1, ?10)",
        rusqlite::params![
            id,
            payload.name,
            payload.metric,
            payload.operator,
            payload.threshold,
            duration,
            severity,
            payload.target_node_id,
            channel,
            now
        ],
    )
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to insert alert rule"))?;

    let sev = match severity.as_str() {
        "critical" => AlertSeverity::Critical,
        "info" => AlertSeverity::Info,
        _ => AlertSeverity::Warning,
    };

    Ok((
        StatusCode::CREATED,
        Json(AlertRule {
            id,
            name: payload.name,
            metric: payload.metric,
            operator: payload.operator,
            threshold: payload.threshold,
            duration_seconds: duration,
            severity: sev,
            target_node_id: payload.target_node_id,
            channel,
            is_enabled: true,
            created_at: now,
        }),
    ))
}

pub async fn update_alert_rule_handler(
    user: AuthUser,
    Path(id): Path<String>,
    Extension(pool): Extension<DbPool>,
    Json(payload): Json<UpdateAlertRulePayload>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    if !user.has_permission("alerts:configure") {
        return Err((StatusCode::FORBIDDEN, "Forbidden"));
    }

    let conn = pool.get().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Database connection error",
        )
    })?;

    let mut stmt = conn
        .prepare("SELECT name, metric, operator, threshold, duration_seconds, severity, target_node_id, channel, is_enabled FROM alert_rules WHERE id = ?1")
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    let existing: Result<
        (
            String,
            String,
            String,
            f64,
            u32,
            String,
            Option<String>,
            String,
            i64,
        ),
        _,
    > = stmt.query_row(rusqlite::params![id], |row| {
        Ok((
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
            row.get(4)?,
            row.get(5)?,
            row.get(6)?,
            row.get(7)?,
            row.get(8)?,
        ))
    });

    let (e_name, e_metric, e_op, e_thresh, e_dur, e_sev, e_node, e_chan, e_enabled) =
        existing.map_err(|_| (StatusCode::NOT_FOUND, "Alert rule not found"))?;

    let name = payload.name.unwrap_or(e_name);
    let metric = payload.metric.unwrap_or(e_metric);
    let operator = payload.operator.unwrap_or(e_op);
    let threshold = payload.threshold.unwrap_or(e_thresh);
    let duration = payload.duration_seconds.unwrap_or(e_dur);
    let severity = payload.severity.unwrap_or(e_sev);
    let target_node = if payload.target_node_id.is_some() {
        payload.target_node_id
    } else {
        e_node
    };
    let channel = payload.channel.unwrap_or(e_chan);
    let is_enabled = payload
        .is_enabled
        .map(|b| if b { 1 } else { 0 })
        .unwrap_or(e_enabled);

    conn.execute(
        "UPDATE alert_rules
         SET name = ?1, metric = ?2, operator = ?3, threshold = ?4, duration_seconds = ?5, severity = ?6, target_node_id = ?7, channel = ?8, is_enabled = ?9
         WHERE id = ?10",
        rusqlite::params![name, metric, operator, threshold, duration, severity, target_node, channel, is_enabled, id],
    )
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to update alert rule"))?;

    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn toggle_alert_rule_handler(
    user: AuthUser,
    Path(id): Path<String>,
    Extension(pool): Extension<DbPool>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    if !user.has_permission("alerts:configure") {
        return Err((StatusCode::FORBIDDEN, "Forbidden"));
    }

    let conn = pool.get().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Database connection error",
        )
    })?;
    conn.execute(
        "UPDATE alert_rules SET is_enabled = CASE WHEN is_enabled = 1 THEN 0 ELSE 1 END WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to toggle rule"))?;

    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn delete_alert_rule_handler(
    user: AuthUser,
    Path(id): Path<String>,
    Extension(pool): Extension<DbPool>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    if !user.has_permission("alerts:configure") {
        return Err((StatusCode::FORBIDDEN, "Forbidden"));
    }

    let conn = pool.get().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Database connection error",
        )
    })?;
    conn.execute(
        "DELETE FROM alert_rules WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to delete rule"))?;

    Ok(Json(serde_json::json!({ "success": true })))
}
