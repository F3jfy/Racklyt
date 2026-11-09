## Description

<!-- Provide a brief explanation of the motivation and summary of changes -->

Fixes #(issue)

## Type of Change

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] ⚡ Performance improvement
- [ ] 📝 Documentation update
- [ ] 🧹 Code refactor / cleanup
- [ ] 🔧 Build / CI / tooling update

## Component(s) Modified

- [ ] `crates/racklyt-hub` (Axum API, SQLite, Engine)
- [ ] `crates/racklyt-agent` (Syscall readers, telemetry)
- [ ] `crates/racklyt-common` (Wire protocols, models)
- [ ] `web` (React UI, Tailwind, Widgets)
- [ ] Documentation / Docker / Configs

## Checklist

- [ ] My code adheres to the project's [Coding Standards](docs/backend_instructions/coding_standards.md)
- [ ] I have formatted my Rust code with `cargo fmt --all -- --check`
- [ ] I have run `cargo clippy --workspace --all-targets -- -D warnings` with zero warnings
- [ ] I have verified that all unit tests pass with `cargo test --workspace`
- [ ] If changing the web frontend, I have verified `cd web && npm run build` compiles with zero errors
- [ ] I have not committed any sensitive data, database files (`*.db`), secrets, or private tokens
- [ ] I have updated relevant documentation where appropriate
