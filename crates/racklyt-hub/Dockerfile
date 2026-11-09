# ==============================================================================
# Multi-stage Dockerfile for Racklyt Hub
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Frontend Assets
# ------------------------------------------------------------------------------
FROM node:20-alpine AS web-builder

WORKDIR /app/web
COPY web/ ./
RUN if [ ! -f "dist/index.html" ]; then npm ci && npm run build; fi

# ------------------------------------------------------------------------------
# Stage 2: Build Rust Hub Binary
# ------------------------------------------------------------------------------
FROM rust:alpine AS rust-builder

RUN apk add --no-cache musl-dev

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates

RUN cargo build --release -p racklyt-hub

# ------------------------------------------------------------------------------
# Stage 3: Minimal Production Runtime
# ------------------------------------------------------------------------------
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata sqlite-libs

WORKDIR /app

# Copy compiled backend binary
COPY --from=rust-builder /app/target/release/racklyt-hub /usr/local/bin/racklyt-hub

# Copy compiled frontend assets
COPY --from=web-builder /app/web/dist /app/web/dist

# Expose default HTTP/WSS monitoring port
EXPOSE 8443

# Environment variables
ENV RACKLYT_HOST="0.0.0.0" \
    RACKLYT_PORT="8443" \
    RACKLYT_DB_PATH="/data/racklyt.db" \
    RACKLYT_WEB_DIST="/app/web/dist" \
    RUST_LOG="racklyt_hub=info,tower_http=info"

VOLUME ["/data"]

ENTRYPOINT ["/usr/local/bin/racklyt-hub"]
