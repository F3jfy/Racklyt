use crate::{auth::AuthUser, db::DbPool};
use axum::{
    extract::{Extension, Path},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use racklyt_common::{DashboardConfig, WidgetConfig};
use serde::Deserialize;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct SaveDashboardRequest {
    pub title: String,
    pub description: Option<String>,
    pub is_public: bool,
    pub widgets: Vec<SaveWidgetRequest>,
}

#[derive(Deserialize)]
pub struct SaveWidgetRequest {
    pub id: Option<String>,
    pub widget_type: String,
    pub title: String,
    pub grid_x: u32,
    pub grid_y: u32,
    pub grid_w: u32,
    pub grid_h: u32,
    pub config: serde_json::Value,
}

#[derive(Deserialize)]
pub struct CreateDashboardRequest {
    pub title: String,
    pub description: Option<String>,
    pub is_public: Option<bool>,
    pub widgets: Option<Vec<SaveWidgetRequest>>,
}

pub async fn list_dashboards_handler(
    user: AuthUser,
    Extension(pool): Extension<DbPool>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    let conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    let mut stmt = conn
        .prepare(
            "SELECT d.id, d.user_id, d.title, d.description, d.is_default, d.is_public, d.created_at, d.updated_at,
                    (SELECT COUNT(*) FROM dashboard_widgets w WHERE w.dashboard_id = d.id) AS widget_count
             FROM dashboards d
             WHERE d.is_public = 1 OR d.user_id = ?1
             ORDER BY d.is_default DESC, d.created_at ASC",
        )
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Query failed"))?;

    let dashboards = stmt
        .query_map(rusqlite::params![user.id], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "user_id": row.get::<_, Option<String>>(1)?,
                "title": row.get::<_, String>(2)?,
                "description": row.get::<_, Option<String>>(3)?,
                "is_default": row.get::<_, i64>(4)? == 1,
                "is_public": row.get::<_, i64>(5)? == 1,
                "created_at": row.get::<_, i64>(6)?,
                "updated_at": row.get::<_, i64>(7)?,
                "widget_count": row.get::<_, i64>(8)?,
            }))
        })
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to read dashboards",
            )
        })?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();

    Ok(Json(dashboards))
}

pub async fn get_dashboard_handler(
    user: AuthUser,
    Path(dash_id): Path<String>,
    Extension(pool): Extension<DbPool>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    let conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, user_id, title, description, is_default, is_public, created_at, updated_at
             FROM dashboards WHERE id = ?1",
        )
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Query failed"))?;

    let dash = stmt
        .query_row(rusqlite::params![dash_id], |row| {
            let id: String = row.get(0)?;
            let user_id: Option<String> = row.get(1)?;
            let title: String = row.get(2)?;
            let description: Option<String> = row.get(3)?;
            let is_default: bool = row.get::<_, i64>(4)? == 1;
            let is_public: bool = row.get::<_, i64>(5)? == 1;
            let created_at: i64 = row.get(6)?;
            let updated_at: i64 = row.get(7)?;

            Ok((
                id,
                user_id,
                title,
                description,
                is_default,
                is_public,
                created_at,
                updated_at,
            ))
        })
        .map_err(|_| (StatusCode::NOT_FOUND, "Dashboard not found"))?;

    // Check access
    if !dash.5
        && dash.1.as_deref() != Some(&user.id)
        && !user.has_permission("dashboard:manage_public")
    {
        return Err((StatusCode::FORBIDDEN, "Forbidden"));
    }

    // Query widgets
    let mut widget_stmt = conn
        .prepare(
            "SELECT id, widget_type, title, grid_x, grid_y, grid_w, grid_h, config
             FROM dashboard_widgets WHERE dashboard_id = ?1 ORDER BY grid_y ASC, grid_x ASC",
        )
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Widgets query failed"))?;

    let widgets = widget_stmt
        .query_map(rusqlite::params![dash_id], |row| {
            let cfg_str: String = row.get(7)?;
            let config: serde_json::Value =
                serde_json::from_str(&cfg_str).unwrap_or(serde_json::json!({}));
            Ok(WidgetConfig {
                id: row.get(0)?,
                widget_type: row.get(1)?,
                title: row.get(2)?,
                grid_x: row.get::<_, i64>(3)? as u32,
                grid_y: row.get::<_, i64>(4)? as u32,
                grid_w: row.get::<_, i64>(5)? as u32,
                grid_h: row.get::<_, i64>(6)? as u32,
                config,
            })
        })
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read widgets"))?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();

    Ok(Json(DashboardConfig {
        id: dash.0,
        user_id: dash.1,
        title: dash.2,
        description: dash.3,
        is_default: dash.4,
        is_public: dash.5,
        widgets,
        created_at: dash.6,
        updated_at: dash.7,
    }))
}

pub async fn update_dashboard_handler(
    user: AuthUser,
    Path(dash_id): Path<String>,
    Extension(pool): Extension<DbPool>,
    Json(payload): Json<SaveDashboardRequest>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    let mut conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;
    let now = chrono::Utc::now().timestamp();

    // Verify ownership or admin
    let owner: Option<String> = conn
        .query_row(
            "SELECT user_id FROM dashboards WHERE id = ?1",
            rusqlite::params![dash_id],
            |r| r.get(0),
        )
        .map_err(|_| (StatusCode::NOT_FOUND, "Dashboard not found"))?;

    if owner.as_deref() != Some(&user.id) && !user.has_permission("dashboard:manage_public") {
        return Err((StatusCode::FORBIDDEN, "Forbidden"));
    }

    let tx = conn
        .transaction()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Tx error"))?;

    tx.execute(
        "UPDATE dashboards SET title = ?1, description = ?2, is_public = ?3, updated_at = ?4 WHERE id = ?5",
        rusqlite::params![payload.title, payload.description, payload.is_public as i64, now, dash_id],
    )
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Update dashboard failed"))?;

    // Replace widgets
    tx.execute(
        "DELETE FROM dashboard_widgets WHERE dashboard_id = ?1",
        rusqlite::params![dash_id],
    )
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Clear widgets failed"))?;

    for w in payload.widgets {
        let wid =
            w.id.unwrap_or_else(|| format!("w_{}", Uuid::new_v4().simple()));
        let cfg_str = serde_json::to_string(&w.config).unwrap_or_else(|_| "{}".to_string());

        tx.execute(
            "INSERT INTO dashboard_widgets (id, dashboard_id, widget_type, title, grid_x, grid_y, grid_w, grid_h, config, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![wid, dash_id, w.widget_type, w.title, w.grid_x, w.grid_y, w.grid_w, w.grid_h, cfg_str, now],
        )
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Insert widget failed"))?;
    }

    tx.commit()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Commit failed"))?;

    Ok(Json(serde_json::json!({ "success": true, "id": dash_id })))
}

pub async fn create_dashboard_handler(
    user: AuthUser,
    Extension(pool): Extension<DbPool>,
    Json(payload): Json<CreateDashboardRequest>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    let mut conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;
    let now = chrono::Utc::now().timestamp();
    let dash_id = format!("dash_{}", Uuid::new_v4().simple());
    let is_public = payload.is_public.unwrap_or(true);

    let tx = conn
        .transaction()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Tx error"))?;

    tx.execute(
        "INSERT INTO dashboards (id, user_id, title, description, is_default, is_public, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, ?6)",
        rusqlite::params![dash_id, user.id, payload.title, payload.description, is_public as i64, now],
    ).map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Insert dashboard failed"))?;

    if let Some(widgets) = payload.widgets {
        for w in widgets {
            let wid =
                w.id.unwrap_or_else(|| format!("w_{}", Uuid::new_v4().simple()));
            let cfg_str = serde_json::to_string(&w.config).unwrap_or_else(|_| "{}".to_string());
            tx.execute(
                "INSERT INTO dashboard_widgets (id, dashboard_id, widget_type, title, grid_x, grid_y, grid_w, grid_h, config, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                rusqlite::params![wid, dash_id, w.widget_type, w.title, w.grid_x, w.grid_y, w.grid_w, w.grid_h, cfg_str, now],
            ).map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Insert widget failed"))?;
        }
    }

    tx.commit()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Commit failed"))?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "id": dash_id, "title": payload.title })),
    ))
}

pub async fn delete_dashboard_handler(
    user: AuthUser,
    Path(dash_id): Path<String>,
    Extension(pool): Extension<DbPool>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    let conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    let (is_default, owner): (bool, Option<String>) = conn
        .query_row(
            "SELECT is_default, user_id FROM dashboards WHERE id = ?1",
            rusqlite::params![dash_id],
            |r| Ok((r.get::<_, i64>(0)? == 1, r.get(1)?)),
        )
        .map_err(|_| (StatusCode::NOT_FOUND, "Dashboard not found"))?;

    if is_default {
        return Err((
            StatusCode::BAD_REQUEST,
            "Cannot delete default system dashboard",
        ));
    }

    if owner.as_deref() != Some(&user.id) && !user.has_permission("dashboard:manage_public") {
        return Err((StatusCode::FORBIDDEN, "Forbidden"));
    }

    conn.execute(
        "DELETE FROM dashboards WHERE id = ?1",
        rusqlite::params![dash_id],
    )
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Delete failed"))?;

    Ok(Json(serde_json::json!({ "success": true })))
}
