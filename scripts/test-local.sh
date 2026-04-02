#!/usr/bin/env bash
set -euo pipefail

# Run local integration tests against real Cloudflare workers.
#
# Architecture:
#   auth-worker     (port 8794)  — Better Auth
#   api-worker      (port 8795)  — Billing
#   platform-worker (port 8792)  — Global DOs
#   app worker      (port 8780)  — App RecordRoom DO (via wrangler.dev.toml)
#   vite dev        (port 5173)  — Frontend, proxies /api + /ws → app worker
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
  echo "→ Clean."
}
trap cleanup EXIT

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

echo "=== DeepSpace Local Tests ==="

# ── Preflight ─────────────────────────────────────────────────────────
for dir in platform/auth-worker platform/api-worker platform/platform-worker templates/starter; do
  if [ ! -f "$ROOT/$dir/.dev.vars" ]; then
    echo "✗ Missing $dir/.dev.vars — run: ./scripts/setup-env.sh dev"
    exit 1
  fi
done

# ── Free ports + reset state ──────────────────────────────────────────
echo "→ Freeing ports..."
free_ports

echo "→ Resetting local databases..."
rm -rf "$ROOT/platform/auth-worker/.wrangler/state"
rm -rf "$ROOT/platform/api-worker/.wrangler/state"
rm -rf "$ROOT/platform/platform-worker/.wrangler/state"
rm -rf "$ROOT/templates/starter/.wrangler/state"

# ── Start workers ─────────────────────────────────────────────────────
echo "→ Starting auth-worker (port 8794)..."
cd "$ROOT/platform/auth-worker" && npx wrangler dev --port 8794 > /tmp/ds-local-auth.log 2>&1 &
PIDS+=($!); cd "$ROOT"
wait_for_url "http://localhost:8794/health" "auth-worker"

echo "→ Starting api-worker (port 8795)..."
cd "$ROOT/platform/api-worker" && npx wrangler dev --port 8795 > /tmp/ds-local-api.log 2>&1 &
PIDS+=($!); cd "$ROOT"
wait_for_url "http://localhost:8795/api/health" "api-worker"

echo "→ Starting platform-worker (port 8792)..."
cd "$ROOT/platform/platform-worker" && npx wrangler dev --port 8792 > /tmp/ds-local-platform.log 2>&1 &
PIDS+=($!); cd "$ROOT"
wait_for_url "http://localhost:8792/api/health" "platform-worker"

echo "→ Starting app worker (port 8780)..."
cd "$ROOT/templates/starter" && npx wrangler dev --config wrangler.dev.toml --port 8780 > /tmp/ds-local-appworker.log 2>&1 &
PIDS+=($!); cd "$ROOT"
sleep 3
echo "  ✓ app worker"

echo "→ Starting frontend (port 5173)..."
cd "$ROOT/templates/starter" && npx vite --port 5173 > /tmp/ds-local-vite.log 2>&1 &
PIDS+=($!); cd "$ROOT"
wait_for_url "http://localhost:5173" "frontend"

# ── Run tests ─────────────────────────────────────────────────────────
echo ""
echo "→ Running Playwright tests..."
cd "$ROOT/tests/local"
npx playwright install chromium 2>/dev/null || true
npx playwright test "$@"
