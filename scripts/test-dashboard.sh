#!/usr/bin/env bash
set -euo pipefail

# Run dashboard integration tests.
#
# Usage:
#   ./scripts/test-dashboard.sh                          # full run: start servers + run tests
#   ./scripts/test-dashboard.sh --no-reset               # skip DB reset
#   ./scripts/test-dashboard.sh --keep-servers            # leave servers running after tests
#   ./scripts/test-dashboard.sh -- --grep "apps"          # pass args to playwright
#   ./scripts/test-dashboard.sh -- tests/api.spec.ts      # run one file

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/lib/helpers.sh"

# Parse args
RESET=true
KEEP_SERVERS=false
PW_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-reset) RESET=false; shift ;;
    --keep-servers) KEEP_SERVERS=true; shift ;;
    --) shift; PW_ARGS=("$@"); break ;;
    *) shift ;;
  esac
done

PIDS=()

cleanup() {
  if [ "$KEEP_SERVERS" = true ]; then
    echo ""
    echo "→ Servers left running (--keep-servers). Kill with: kill ${PIDS[*]+"${PIDS[*]}"}"
    return
  fi
  echo ""
  echo "→ Stopping services..."
  for pid in "${PIDS[@]+"${PIDS[@]}"}"; do
    kill "$pid" 2>/dev/null && wait "$pid" 2>/dev/null || true
  done
  echo "→ Clean."
}
trap cleanup EXIT

echo "=== DeepSpace Dashboard Tests ==="

# Ensure secrets
source "$ROOT/scripts/lib/ensure-secrets.sh"

# Reset databases
if [ "$RESET" = true ]; then
  echo "→ Resetting local databases..."
  rm -rf "$ROOT/platform/auth-worker/.wrangler/state"
  rm -rf "$ROOT/platform/api-worker/.wrangler/state"
  rm -rf "$ROOT/platform/deploy-worker/.wrangler/state"
fi

# Start workers
echo "→ Freeing ports..."
free_ports

echo "→ Starting auth-worker (port 8794)..."
cd "$ROOT/platform/auth-worker" && npx wrangler dev --port 8794 > /tmp/ds-dash-auth.log 2>&1 &
PIDS+=($!); cd "$ROOT"
wait_for_url "http://localhost:8794/health" "auth-worker"

echo "→ Migrating auth DB..."
curl -sf -X POST http://localhost:8794/_migrate > /dev/null
echo "  ✓ auth DB ready"

echo "→ Starting api-worker (port 8795)..."
cd "$ROOT/platform/api-worker" && npx wrangler dev --port 8795 > /tmp/ds-dash-api.log 2>&1 &
PIDS+=($!); cd "$ROOT"
wait_for_url "http://localhost:8795/api/health" "api-worker"

echo "→ Starting deploy-worker (port 8796)..."
cd "$ROOT/platform/deploy-worker" && npx wrangler dev --port 8796 > /tmp/ds-dash-deploy.log 2>&1 &
PIDS+=($!); cd "$ROOT"
wait_for_url "http://localhost:8796/api/health" "deploy-worker"

echo "→ Starting dashboard (port 5174)..."
cd "$ROOT/apps/dashboard" && npx vite --port 5174 > /tmp/ds-dash-vite.log 2>&1 &
PIDS+=($!); cd "$ROOT"
wait_for_url "http://localhost:5174" "dashboard"

# Run tests
echo ""
echo "→ Running Playwright tests..."
cd "$ROOT/tests/dashboard"
npx playwright install chromium 2>/dev/null || true
npx playwright test "${PW_ARGS[@]+"${PW_ARGS[@]}"}"
