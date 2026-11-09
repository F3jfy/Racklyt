use crate::{auth::AuthUser, db::DbPool};
use axum::{
    extract::{Extension, Path, Query},
    http::StatusCode,
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse,
    },
    Json,
};
use futures_util::stream::Stream;
use racklyt_common::{AlertSeverity, NotificationItem};
use serde::{Deserialize, Serialize};
use std::{convert::Infallible, time::Duration};
use tokio_stream::{wrappers::BroadcastStream, StreamExt};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RealtimeEvent {
    pub event_type: String, // "alert_triggered", "alert_acknowledged", "metric_tick", "node_status"
    pub payload: serde_json::Value,
}

#[derive(Deserialize)]
pub struct NotificationQuery {
    pub unread_only: Option<bool>,
}

#[derive(Deserialize)]
pub struct RegisterDeviceRequest {
    pub device_name: String,
    pub platform: String,
    pub push_token: String,
}

pub async fn list_notifications_handler(
    user: AuthUser,
    Query(params): Query<NotificationQuery>,
    Extension(pool): Extension<DbPool>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    let conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    let sql = if params.unread_only.unwrap_or(false) {
        "SELECT id, user_id, alert_id, node_id, severity, title, body, metadata_json, is_read, is_acknowledged, sent_at
         FROM notifications_log
         WHERE (user_id IS NULL OR user_id = ?1) AND is_read = 0
         ORDER BY sent_at DESC LIMIT 50"
    } else {
        "SELECT id, user_id, alert_id, node_id, severity, title, body, metadata_json, is_read, is_acknowledged, sent_at
         FROM notifications_log
         WHERE user_id IS NULL OR user_id = ?1
         ORDER BY sent_at DESC LIMIT 50"
    };

    let mut stmt = conn
        .prepare(sql)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Query failed"))?;

    let items = stmt
        .query_map(rusqlite::params![user.id], |row| {
            let sev_str: String = row.get(4)?;
            let severity = match sev_str.as_str() {
                "critical" => AlertSeverity::Critical,
                "warning" => AlertSeverity::Warning,
                _ => AlertSeverity::Info,
            };

            Ok(NotificationItem {
                id: row.get(0)?,
                user_id: row.get(1)?,
                alert_id: row.get(2)?,
                node_id: row.get(3)?,
                severity,
                title: row.get(5)?,
                body: row.get(6)?,
                deep_link: row.get(7)?,
                is_read: row.get::<_, i64>(8)? == 1,
                is_acknowledged: row.get::<_, i64>(9)? == 1,
                sent_at: row.get(10)?,
            })
        })
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Read notifications failed",
            )
        })?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();

    Ok(Json(items))
}

pub async fn unread_count_handler(
    user: AuthUser,
    Extension(pool): Extension<DbPool>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    let conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM notifications_log WHERE (user_id IS NULL OR user_id = ?1) AND is_read = 0",
            rusqlite::params![user.id],
            |r| r.get(0),
        )
        .unwrap_or(0);

    Ok(Json(serde_json::json!({ "unread_count": count })))
}

pub async fn ack_notification_handler(
    user: AuthUser,
    Path(notif_id): Path<String>,
    Extension(pool): Extension<DbPool>,
    Extension(event_tx): Extension<tokio::sync::broadcast::Sender<RealtimeEvent>>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    let conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    conn.execute(
        "UPDATE notifications_log SET is_acknowledged = 1, is_read = 1 WHERE id = ?1",
        rusqlite::params![notif_id],
    )
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Update failed"))?;

    let _ = event_tx.send(RealtimeEvent {
        event_type: "alert_acknowledged".to_string(),
        payload: serde_json::json!({ "notification_id": notif_id, "user_id": user.id }),
    });

    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn register_device_handler(
    user: AuthUser,
    Extension(pool): Extension<DbPool>,
    Json(payload): Json<RegisterDeviceRequest>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    let conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;
    let now = chrono::Utc::now().timestamp();
    let dev_id = format!("dev_{}", Uuid::new_v4().simple());

    conn.execute(
        "INSERT INTO notification_devices (id, user_id, device_name, platform, push_token, is_active, created_at, last_used_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?6)
         ON CONFLICT(push_token) DO UPDATE SET user_id = ?2, device_name = ?3, last_used_at = ?6, is_active = 1",
        rusqlite::params![dev_id, user.id, payload.device_name, payload.platform, payload.push_token, now],
    )
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Device registration failed"))?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "success": true, "device_id": dev_id })),
    ))
}

pub async fn sse_stream_handler(
    _user: AuthUser,
    Extension(event_tx): Extension<tokio::sync::broadcast::Sender<RealtimeEvent>>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let rx = event_tx.subscribe();
    let stream = BroadcastStream::new(rx).filter_map(|res| match res {
        Ok(evt) => {
            let data = serde_json::to_string(&evt).unwrap_or_default();
            Some(Ok(Event::default().event(&evt.event_type).data(data)))
        }
        Err(_) => None,
    });

    Sse::new(stream).keep_alive(KeepAlive::new().interval(Duration::from_secs(15)))
}
