#!/usr/bin/env bash
set -euo pipefail

# Run local integration tests.
# Usage: ./scripts/test-local.sh [app-name] [-- playwright-args...]

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/lib/helpers.sh"

# Parse args
APP_NAME="test-default"
PW_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --) shift; PW_ARGS=("$@"); break ;;
    *) APP_NAME="$1"; shift ;;
  esac
done

APP_DIR="$ROOT/.test-apps/$APP_NAME"
PIDS=()

cleanup() {
  echo ""
  echo "→ Stopping services..."
  for pid in "${PIDS[@]+"${PIDS[@]}"}"; do
    kill "$pid" 2>/dev/null && wait "$pid" 2>/dev/null || true
  done
  echo "→ Clean."
}
trap cleanup EXIT

echo "=== DeepSpace Local Tests (app: $APP_NAME) ==="

# Scaffold fresh
"$ROOT/scripts/lib/scaffold.sh" "$APP_NAME"

# Ensure secrets
source "$ROOT/scripts/lib/ensure-secrets.sh"

if [ ! -f "$APP_DIR/.dev.vars" ]; then
  echo "✗ Missing $APP_DIR/.dev.vars — scaffold may have failed"
  exit 1
fi

# Reset databases
echo "→ Resetting local databases..."
rm -rf "$ROOT/platform/auth-worker/.wrangler/state"
rm -rf "$ROOT/platform/api-worker/.wrangler/state"
rm -rf "$ROOT/platform/platform-worker/.wrangler/state"
rm -rf "$APP_DIR/.wrangler/state"

# Start everything
source "$ROOT/scripts/lib/start-servers.sh"

# Run tests
echo ""
echo "→ Running Playwright tests..."
cd "$ROOT/tests/local"
npx playwright install chromium 2>/dev/null || true
npx playwright test "${PW_ARGS[@]+"${PW_ARGS[@]}"}"
