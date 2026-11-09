# Contributing to Racklyt

First off, thank you for considering contributing to **Racklyt**! 🎉

Racklyt is an ultra-lightweight, zero-trust infrastructure monitoring platform built with Rust, Axum, SQLite, and React. Whether you're fixing a bug, adding support for a new hardware metric, improving documentation, or refining dashboard widgets, your contributions are welcome.

---

## 1. Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please report any unacceptable behavior to `community@racklyt.dev`.

---

## 2. Workspace Overview

The repository is organized as a Cargo workspace with a bundled React frontend:

```
Racklyt/
├── crates/
│   ├── racklyt-common/     # Shared metric structs, payloads, and wire protocol definitions
│   ├── racklyt-hub/        # Axum HTTP API, WebSocket engine, SQLite store, RBAC & Proxmox poller
│   └── racklyt-agent/      # Direct /proc & /sys telemetry reader daemon for Linux & Raspberry Pi
├── web/                    # Single-Page App (React 18, Vite, Tailwind CSS, Lucide icons)
├── docs/                   # Architectural blueprints & design specifications
└── scratch/                # Local development verification scripts (git-ignored)
```

---

## 3. Getting Started & Development Setup

### 3.1 Prerequisites
- **Rust Toolchain:** Stable 1.80 or newer (`rustup default stable`)
- **Node.js & npm:** Node.js v18+ and npm v9+
- **C Compiler / musl:** Standard development tools (e.g. `build-essential` on Ubuntu/Debian, `base-devel` on Arch, or `gcc` on Fedora)

### 3.2 Building the Web Frontend
The Hub serves static assets from `web/dist` in production, or proxies to Vite during local development:

```bash
cd web
npm install
npm run build      # Produces optimized production bundle in web/dist
```

For live frontend development with hot-module reload (HMR):
```bash
npm run dev        # Launches Vite dev server at http://localhost:5173
```

### 3.3 Running the Hub Backend
Run the Hub from the repository root:

```bash
# In the repository root
cargo run -p racklyt-hub
```
By default, the Hub binds to `0.0.0.0:8443` and initializes `racklyt.db` in the working directory.

### 3.4 Running the Telemetry Agent
To test agent metric collection against your local Hub:

```bash
# In another terminal
cargo run -p racklyt-agent
```
The agent reads `/proc` and `/sys` and transmits payloads to the configured Hub endpoint.

---

## 4. Coding Standards & Linter Checks

We hold the Racklyt codebase to strict quality, safety, and performance standards as detailed in [Coding Standards](docs/backend_instructions/coding_standards.md).

Before submitting a Pull Request, ensure all checks pass locally:

### 4.1 Rust Code Quality
```bash
# 1. Format check
cargo fmt --all -- --check

# 2. Strict Clippy linter
cargo clippy --workspace --all-targets -- -D warnings

# 3. Test suite
cargo test --workspace
```

### 4.2 Frontend Quality
```bash
cd web
npm run build     # Runs TypeScript compiler check (`tsc`) + Vite build
```

### 4.3 Core Rules
1. **Safety First:** `#![forbid(unsafe_code)]` is enforced across high-level application crates. Low-level syscall wrappers (`statvfs`) must be encapsulated with explicit safety comments.
2. **No Unhandled Panics:** Do **not** use `unwrap()` or `expect()` in request handlers, ingest paths, or agent polling loops. Use `?` operator and typed errors via `thiserror`.
3. **Minimize Allocations:** Avoid unnecessary `.clone()` calls, leverage borrowed slices (`&str`, `&[u8]`), and reuse buffers where possible.
4. **Non-Glass Flat UI:** Frontend components must adhere to the modern dark gray design system (`#121316` base, `#1C1E24` cards, `#2E323D` borders). Avoid heavy backdrop filters, blurry glassmorphism, or unreadable low-contrast elements.

---

## 5. Commit Guidelines & Conventional Commits

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` A new user-facing feature or metric
- `fix:` A bug fix in Hub, Agent, or Frontend
- `docs:` Documentation changes or guides
- `perf:` Performance optimizations or memory reductions
- `refactor:` Code restructuring without functional changes
- `test:` Adding or updating unit/integration tests
- `chore:` Dependency bumps, CI updates, or build tooling

*Example:* `feat(agent): support NVMe drive temperature extraction via hwmon`

---

## 6. Submitting a Pull Request

1. **Fork & Branch:** Create a feature branch off `main` (`git checkout -b feat/my-new-feature`).
2. **Keep it Focused:** Make small, atomic commits addressing one feature or fix.
3. **Write Tests:** Include unit tests for new business logic, parsing helpers, or API routes.
4. **Verify Checks:** Run `cargo fmt`, `cargo clippy`, `cargo test`, and `npm run build`.
5. **Open PR:** Submit your PR against the `main` branch. Fill out the [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md).

---

## 7. Reporting Bugs & Proposing Features

- **Bug Reports:** Use the [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.yml). Include host operating system, kernel version, Proxmox version (if applicable), and relevant log outputs.
- **Feature Requests:** Use the [Feature Request Template](.github/ISSUE_TEMPLATE/feature_request.yml) with your proposed design and use cases.
- **Security Vulnerabilities:** DO NOT open public issues for security vulnerabilities. Follow [SECURITY.md](SECURITY.md).
