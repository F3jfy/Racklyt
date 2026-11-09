use crate::{api::notifications::RealtimeEvent, auth::SessionStore};
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Extension, Query,
    },
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio_stream::wrappers::BroadcastStream;

#[derive(Deserialize)]
pub struct WsAuthQuery {
    pub token: Option<String>,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    headers: HeaderMap,
    Query(query): Query<WsAuthQuery>,
    Extension(session_store): Extension<SessionStore>,
    Extension(event_tx): Extension<tokio::sync::broadcast::Sender<RealtimeEvent>>,
) -> Result<Response, (StatusCode, &'static str)> {
    // SEC-10 Hardening: Authenticate WebSocket client via query token, cookie, or Authorization header
    let token_opt = query
        .token
        .or_else(|| {
            headers
                .get(header::AUTHORIZATION)
                .and_then(|h| h.to_str().ok())
                .and_then(|h| h.strip_prefix("Bearer "))
                .map(|s| s.trim().to_string())
        })
        .or_else(|| {
            headers
                .get(header::COOKIE)
                .and_then(|h| h.to_str().ok())
                .and_then(|cookie_str| {
                    for cookie in cookie_str.split(';') {
                        let trimmed = cookie.trim();
                        if let Some(tok) = trimmed.strip_prefix("racklyt_session=") {
                            return Some(tok.to_string());
                        }
                    }
                    None
                })
        });

    let token = token_opt.ok_or((
        StatusCode::UNAUTHORIZED,
        "Missing authentication token for WebSocket",
    ))?;

    if session_store.get_user_id(&token).is_none() {
        return Err((
            StatusCode::UNAUTHORIZED,
            "Invalid or expired session for WebSocket",
        ));
    }

    Ok(ws
        .on_upgrade(move |socket| handle_socket(socket, event_tx))
        .into_response())
}

async fn handle_socket(socket: WebSocket, event_tx: tokio::sync::broadcast::Sender<RealtimeEvent>) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = BroadcastStream::new(event_tx.subscribe());

    // Task 1: forward broadcast events to websocket client
    let mut send_task = tokio::spawn(async move {
        while let Some(Ok(event)) = rx.next().await {
            if let Ok(msg_str) = serde_json::to_string(&event) {
                if sender.send(Message::Text(msg_str)).await.is_err() {
                    break;
                }
            }
        }
    });

    // Task 2: receive incoming ping or messages from client
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Close(_) = msg {
                break;
            }
        }
    });

    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };
}
