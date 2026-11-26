# Collaborative whiteboard — task runner

default:
    @just --list

# Backend API + WebSocket server on 0.0.0.0:8000
server:
    cd server && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend dev server on 0.0.0.0:5173 (proxies /api and /ws to :8000)
web:
    cd web && pnpm dev --host 0.0.0.0 --port 5173

# Both, backend in the background
dev:
    #!/usr/bin/env bash
    set -euo pipefail
    just server &
    trap 'kill 0' EXIT
    just web

test:
    cd server && uv run pytest -q
    cd web && pnpm test --run

lint:
    cd server && uv run ruff check . && uv run ruff format --check .
    cd web && pnpm exec tsc --noEmit && pnpm lint
