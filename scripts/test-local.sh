#!/usr/bin/env bash
set -euo pipefail

# Run local integration tests against real Cloudflare workers (via wrangler dev).
# Handles starting/stopping services, DB initialization, and cleanup.
#
# Prerequisites:
#   - .dev.vars in each worker dir (run: ./scripts/setup-env.sh dev)
#   - Playwright chromium (auto-installed if missing)
#
# Usage:
#   ./scripts/test-local.sh              # run tests
#   ./scripts/test-local.sh --headed     # run with visible browser

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PIDS=()
PORTS=(8794 8792 5173 9235 9233)

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
      echo "  killing existing process on port $port"
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

# ── Preflight checks ──────────────────────────────────────────────────
for worker in auth-worker platform-worker; do
  if [ ! -f "$ROOT/platform/$worker/.dev.vars" ]; then
    echo "✗ Missing platform/$worker/.dev.vars"
    echo "  Run: ./scripts/setup-env.sh dev"
    exit 1
  fi
done

# ── Free ports ────────────────────────────────────────────────────────
echo "→ Freeing ports..."
free_ports

# ── Reset local D1 data for clean state ───────────────────────────────
echo "→ Resetting local D1 databases..."
rm -rf "$ROOT/platform/auth-worker/.wrangler/state"
rm -rf "$ROOT/platform/platform-worker/.wrangler/state"

# ── Start auth-worker ─────────────────────────────────────────────────
echo "→ Starting auth-worker (port 8794)..."
cd "$ROOT/platform/auth-worker"
npx wrangler dev --port 8794 > /tmp/ds-local-auth.log 2>&1 &
PIDS+=($!)
cd "$ROOT"
wait_for_url "http://localhost:8794/health" "auth-worker"

# ── Start platform-worker ─────────────────────────────────────────────
echo "→ Starting platform-worker (port 8792)..."
cd "$ROOT/platform/platform-worker"
npx wrangler dev --port 8792 > /tmp/ds-local-platform.log 2>&1 &
PIDS+=($!)
cd "$ROOT"
wait_for_url "http://localhost:8792/api/health" "platform-worker"

# ── Start template dev server ─────────────────────────────────────────
echo "→ Starting template app (port 5173)..."
cd "$ROOT/templates/starter"
npx vite --port 5173 > /tmp/ds-local-app.log 2>&1 &
PIDS+=($!)
cd "$ROOT"
wait_for_url "http://localhost:5173" "template app"

# ── Run tests ─────────────────────────────────────────────────────────
echo ""
echo "→ Running Playwright tests..."
cd "$ROOT/tests/local"
npx playwright install chromium 2>/dev/null || true
npx playwright test "$@"
