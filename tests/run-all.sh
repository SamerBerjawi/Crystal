#!/usr/bin/env bash
# Runs the whole Crystal test suite:
#   1. unit/API-free tests (npm test at the repo root)
#   2. the Playwright suite against a local QA stack:
#      embedded Postgres :54329, backend :3001, production build served on :4173
# Usage: tests/run-all.sh [extra playwright args]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
E2E="$ROOT/tests/e2e"
STACK="$E2E/.stack"
mkdir -p "$STACK"

cleanup() { [[ -n "${PREVIEW_PID:-}" ]] && kill "$PREVIEW_PID" 2>/dev/null || true; [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" 2>/dev/null || true; [[ -n "${PG_PID:-}" ]] && kill "$PG_PID" 2>/dev/null || true; }
trap cleanup EXIT

echo "== unit tests"
(cd "$ROOT" && npm test)

echo "== starting QA stack"
for port in 54329 3001 4173; do
  if lsof -nP -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; then echo "port $port is busy; stop the process using it first" >&2; exit 1; fi
done
(cd "$E2E" && node stack/pg.mjs > "$STACK/pg.log" 2>&1) & PG_PID=$!
for i in $(seq 1 60); do grep -q "PG READY" "$STACK/pg.log" 2>/dev/null && break; sleep 1; done
grep -q "PG READY" "$STACK/pg.log" || { echo "postgres failed to start"; cat "$STACK/pg.log"; exit 1; }

(cd "$ROOT/server" && DATABASE_HOST=127.0.0.1 DATABASE_PORT=54329 DATABASE_USER=crystal DATABASE_PASSWORD=crystal_qa_pw DATABASE_NAME=crystal \
  JWT_SECRET="qa-$(date +%s)-$RANDOM-$RANDOM" NODE_ENV=development npx --prefix .. tsx src/index.ts > "$STACK/backend.log" 2>&1) & BACKEND_PID=$!

(cd "$ROOT" && npx vite build --mode production --outDir "$STACK/dist" --emptyOutDir > "$STACK/build.log" 2>&1) || { echo "frontend build failed"; tail -30 "$STACK/build.log"; exit 1; }
(cd "$ROOT" && npx vite preview --outDir "$STACK/dist" --port 4173 --strictPort --host 127.0.0.1 > "$STACK/preview.log" 2>&1) & PREVIEW_PID=$!

for i in $(seq 1 60); do curl -sf -H "Host: crystal.localhost:4173" http://127.0.0.1:4173/api/health >/dev/null 2>&1 && break; sleep 1; done
curl -sf -H "Host: crystal.localhost:4173" http://127.0.0.1:4173/api/health >/dev/null || { echo "stack not healthy"; tail -20 "$STACK/backend.log"; exit 1; }

echo "== playwright"
(cd "$E2E" && npx playwright test "$@")
