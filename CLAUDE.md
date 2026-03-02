# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

oops-game-kit is a monorepo game development template with three parts:
- **Game client**: Cocos Creator 3.8.7 + TypeScript, using the Oops Framework (ECS-based)
- **Backend API**: Rust with Loco framework (Axum + SeaORM + Tokio)
- **Admin dashboard**: React 18 + TypeScript, built with Rsbuild

## Common Commands

### Backend (Rust) — run from `backend/`

```bash
cargo loco start                    # Start dev server on :5150
cargo test --all-features --all     # Run all tests
cargo fmt --all                     # Format code
cargo fmt --all -- --check          # Check formatting
cargo clippy --all-features -- -D warnings -W clippy::pedantic -W clippy::nursery -W rust-2018-idioms  # Lint
```

### Admin Dashboard — run from `backend/frontend/`

```bash
npm install && npm run build   # Build for production
npm run dev                    # Dev server on :5173 (proxies /api to :5150)
npm run lint                   # Lint with Biome
```

### Game Client

Open in Cocos Creator 3.8.7. Before first use, run plugin update scripts from repo root:
```bash
./update-oops-plugin-framework.sh       # Core framework plugin
./update-oops-plugin-hot-update.sh      # Hot update plugin
./update-oops-plugin-excel-to-json.sh   # Excel-to-JSON config plugin
```

## Architecture

### Game Client (`assets/script/`)

Entry point: `Main.ts` extends `Root` from Oops Framework. On startup it:
1. Initializes GUI with `UIConfigData` from `GameUIConfig.ts`
2. Creates ECS singleton entities (Initialize, Login) via `SingletonModuleComp`

Key patterns:
- **ECS**: Entities/Components via `oops-framework/libs/ecs/ECS`. Singleton modules registered in `SingletonModuleComp.ts` and accessed via exported `smc` object
- **GUI layers**: UI screens registered in `GameUIConfig.ts` with `UIID` enum → `UIConfig` mapping (layer type + prefab path). Opened via `oops.gui.open(UIID.xxx)`
- **Events**: Global game events defined in `GameEvent.ts` enum
- **Module structure**: Each feature (`initialize/`, `login/`, `shopping/`, etc.) follows ECS entity pattern with Model/View components
- **Oops Framework** lives in `extensions/oops-plugin-framework/` — imported via `db://oops-framework/` protocol

### Backend (`backend/`)

Standard Loco MVC structure:
- `src/app.rs` — App hooks, route registration, worker setup, DB seed/truncate
- `src/controllers/auth.rs` — Auth endpoints (register, login, JWT, magic-link, password reset, email verification)
- `src/models/users.rs` — User model with auth logic (bcrypt, JWT, tokens)
- `src/views/auth.rs` — Response DTOs
- `src/mailers/auth.rs` — Email templates
- `src/workers/downloader.rs` — Background download worker
- `migration/` — SeaORM database migrations
- `config/` — Environment configs (development.yaml, test.yaml, production.yaml)

Routes are added in `app.rs` → `routes()` method. New controllers follow the pattern in `controllers/auth.rs`.

### Admin Dashboard (`backend/frontend/`)

Minimal React app. Rsbuild config proxies `/api` to the backend at `127.0.0.1:5150`.

## CI (backend only)

Defined in `backend/.github/workflows/ci.yaml`. Three jobs:
1. `rustfmt` — format check
2. `clippy` — lint with pedantic + nursery warnings
3. `test` — requires PostgreSQL + Redis services, builds frontend first

## Key Config

- Rust formatting: max_width 100 (`backend/.rustfmt.toml`)
- Frontend linting: Biome with recommended rules, 2-space indent (`backend/frontend/biome.json`)
- Dev database: PostgreSQL at `localhost:5432` (configurable via `DATABASE_URL` env var)
- Dev SMTP: localhost:1025 (MailHog compatible)
- JWT secret and expiration configured in `backend/config/development.yaml`
- Game project version: 3.6.3, Cocos Creator 3.8.7
