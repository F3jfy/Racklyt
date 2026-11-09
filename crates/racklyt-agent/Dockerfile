# Build Stage
FROM rust:1.81-alpine AS builder

RUN apk add --no-cache musl-dev

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates

RUN cargo build --release -p racklyt-agent

# Runtime Stage: Ultra-lightweight scratch/alpine container
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /app/target/release/racklyt-agent /usr/local/bin/racklyt-agent

ENV RACKLYT_HUB_URL="http://127.0.0.1:8443" \
    RACKLYT_INTERVAL_SECS="5" \
    RACKLYT_AUTH_TOKEN="agent_default_token"

ENTRYPOINT ["/usr/local/bin/racklyt-agent"]
