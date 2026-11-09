use axum::{
    extract::Extension,
    http::{header, Method},
};
use racklyt_hub::{
    api::{build_api_router, notifications::RealtimeEvent},
    auth::SessionStore,
    db::init_db_pool,
    engine::start_background_engine,
};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "racklyt_hub=info,tower_http=info".into()),
        )
        .init();

    info!("Starting Racklyt Hub Monitoring Engine...");

    let db_path = std::env::var("RACKLYT_DB_PATH").unwrap_or_else(|_| "racklyt.db".to_string());
    let pool = init_db_pool(&db_path)?;

    let session_store = SessionStore::new();
    let (event_tx, _event_rx) = tokio::sync::broadcast::channel::<RealtimeEvent>(200);
    let proxmox_state = std::sync::Arc::new(std::sync::RwLock::new(
        racklyt_hub::api::node_management::ProxmoxClusterState::default(),
    ));

    // Launch background tasks
    start_background_engine(pool.clone(), event_tx.clone(), session_store.clone());

    // CORS configuration for local web dev
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE, header::ACCEPT]);

    let dist_dir = std::env::var("RACKLYT_WEB_DIST").unwrap_or_else(|_| "web/dist".to_string());
    let router = build_api_router();

    let app = if std::path::Path::new(&dist_dir).exists() {
        let serve_dir = tower_http::services::ServeDir::new(&dist_dir).not_found_service(
            tower_http::services::ServeFile::new(format!("{}/index.html", dist_dir)),
        );
        router.fallback_service(serve_dir)
    } else {
        router
    };

    let app = app
        .layer(axum::middleware::map_response(add_security_headers))
        .layer(cors)
        .layer(Extension(pool))
        .layer(Extension(session_store))
        .layer(Extension(event_tx))
        .layer(Extension(proxmox_state));

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8443);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!("Racklyt Hub API listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn add_security_headers(res: axum::response::Response) -> axum::response::Response {
    let mut res = res;
    let headers = res.headers_mut();
    headers.insert(
        header::HeaderName::from_static("x-content-type-options"),
        header::HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        header::HeaderName::from_static("x-frame-options"),
        header::HeaderValue::from_static("SAMEORIGIN"),
    );
    headers.insert(
        header::HeaderName::from_static("referrer-policy"),
        header::HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
    headers.insert(
        header::HeaderName::from_static("permissions-policy"),
        header::HeaderValue::from_static("camera=(), microphone=(), geolocation=()"),
    );
    res
}
