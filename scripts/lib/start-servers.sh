#!/usr/bin/env bash
# Start all local workers + app worker + frontend.
# Source this: source "$ROOT/scripts/lib/start-servers.sh"
# Expects ROOT, APP_DIR, and PIDS to be set by the caller.

: "${ROOT:?ROOT must be set}"
: "${APP_DIR:?APP_DIR must be set}"

source "$ROOT/scripts/lib/helpers.sh"

echo "→ Freeing ports..."
free_ports

echo "→ Starting auth-worker (port 8794)..."
cd "$ROOT/platform/auth-worker" && npx wrangler dev --port 8794 > /tmp/ds-local-auth.log 2>&1 &
PIDS+=($!); cd "$ROOT"
wait_for_url "http://localhost:8794/health" "auth-worker"

echo "→ Migrating auth DB..."
curl -sf -X POST http://localhost:8794/_migrate > /dev/null
echo "  ✓ auth DB ready"

echo "→ Starting api-worker (port 8795)..."
cd "$ROOT/platform/api-worker" && npx wrangler dev --port 8795 > /tmp/ds-local-api.log 2>&1 &
PIDS+=($!); cd "$ROOT"
wait_for_url "http://localhost:8795/api/health" "api-worker"

echo "→ Starting deploy-worker (port 8796)..."
cd "$ROOT/platform/deploy-worker" && npx wrangler dev --port 8796 > /tmp/ds-local-deploy.log 2>&1 &
PIDS+=($!); cd "$ROOT"
wait_for_url "http://localhost:8796/api/health" "deploy-worker"

echo "→ Starting platform-worker (port 8792)..."
cd "$ROOT/platform/platform-worker" && npx wrangler dev --port 8792 > /tmp/ds-local-platform.log 2>&1 &
PIDS+=($!); cd "$ROOT"
wait_for_url "http://localhost:8792/api/health" "platform-worker"

echo "→ Starting app worker (port 8780)..."
mkdir -p "$APP_DIR/dist"
cd "$APP_DIR" && npx wrangler dev --port 8780 > /tmp/ds-local-appworker.log 2>&1 &
PIDS+=($!); cd "$ROOT"
sleep 3
echo "  ✓ app worker"

echo "→ Starting frontend (port 5173)..."
cd "$APP_DIR" && npx vite --port 5173 > /tmp/ds-local-vite.log 2>&1 &
PIDS+=($!); cd "$ROOT"
wait_for_url "http://localhost:5173" "frontend"
