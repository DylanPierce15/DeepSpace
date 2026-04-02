#!/usr/bin/env bash
set -euo pipefail

# Start the full local development stack.
#
# Architecture:
#   auth-worker     (port 8794)  — Better Auth + JWT issuance
#   api-worker      (port 8795)  — Billing, user profiles
#   platform-worker (port 8792)  — Global DOs (conv, dir, workspace)
#   app worker      (port 8780)  — App's own RecordRoom DO (via wrangler.dev.toml)
#   vite dev        (port 5173)  — Frontend HMR, proxies /api + /ws → app worker
#
# Prerequisites: ./scripts/setup-env.sh dev

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PIDS=()
PORTS=(8794 8795 8792 8780 5173 9235 9236 9233 9237)

cleanup() {
  echo ""
  echo "→ Stopping services..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null && wait "$pid" 2>/dev/null || true
  done
  echo "→ Done."
}
trap cleanup EXIT INT TERM

free_ports() {
  for port in "${PORTS[@]}"; do
    local pids
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
      echo "  killing process on port $port"
      echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
  done
  sleep 1
}

wait_for_url() {
  local url="$1" name="$2" max_wait="${3:-20}"
  local elapsed=0
  while [ $elapsed -lt "$max_wait" ]; do
    if curl -sf "$url" > /dev/null 2>&1; then
      echo "  ✓ $name"
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  echo "  ✗ $name not ready at $url after ${max_wait}s"
  exit 1
}

echo "=== DeepSpace Local Dev ==="

# ── Preflight ─────────────────────────────────────────────────────────
for dir in platform/auth-worker platform/api-worker platform/platform-worker templates/starter; do
  if [ ! -f "$ROOT/$dir/.dev.vars" ]; then
    echo "✗ Missing $dir/.dev.vars — run: ./scripts/setup-env.sh dev"
    exit 1
  fi
done

# ── Free ports ────────────────────────────────────────────────────────
echo "→ Freeing ports..."
free_ports

# ── Start workers ─────────────────────────────────────────────────────
echo "→ Starting auth-worker (port 8794)..."
cd "$ROOT/platform/auth-worker" && npx wrangler dev --port 8794 > /tmp/ds-dev-auth.log 2>&1 &
PIDS+=($!); cd "$ROOT"
wait_for_url "http://localhost:8794/health" "auth-worker"

echo "→ Migrating auth DB..."
curl -sf -X POST http://localhost:8794/_migrate > /dev/null
echo "  ✓ auth DB ready"

echo "→ Starting api-worker (port 8795)..."
cd "$ROOT/platform/api-worker" && npx wrangler dev --port 8795 > /tmp/ds-dev-api.log 2>&1 &
PIDS+=($!); cd "$ROOT"
wait_for_url "http://localhost:8795/api/health" "api-worker"

echo "→ Starting platform-worker (port 8792)..."
cd "$ROOT/platform/platform-worker" && npx wrangler dev --port 8792 > /tmp/ds-dev-platform.log 2>&1 &
PIDS+=($!); cd "$ROOT"
wait_for_url "http://localhost:8792/api/health" "platform-worker"

echo "→ Starting app worker (port 8780)..."
cd "$ROOT/templates/starter" && npx wrangler dev --config wrangler.dev.toml --port 8780 > /tmp/ds-dev-appworker.log 2>&1 &
PIDS+=($!); cd "$ROOT"
sleep 3
echo "  ✓ app worker"

echo "→ Starting frontend (port 5173)..."
cd "$ROOT/templates/starter" && npx vite --port 5173 > /tmp/ds-dev-vite.log 2>&1 &
PIDS+=($!); cd "$ROOT"
wait_for_url "http://localhost:5173" "frontend"

echo ""
echo "  App:          http://localhost:5173"
echo "  App Worker:   http://localhost:8780"
echo "  Auth:         http://localhost:8794"
echo "  API:          http://localhost:8795"
echo "  Platform:     http://localhost:8792"
echo ""
echo "  Press Ctrl+C to stop."

open "http://localhost:5173" 2>/dev/null || true
wait
