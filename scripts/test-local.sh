#!/usr/bin/env bash
set -euo pipefail

# Run local integration tests.
#
# Usage:
#   ./scripts/test-local.sh                             # scaffold with all features + run all tests
#   ./scripts/test-local.sh --no-scaffold                # reuse existing app, reset DBs
#   ./scripts/test-local.sh --no-scaffold --no-reset     # reuse everything, just run tests
#   ./scripts/test-local.sh my-app                       # use a specific app name
#   ./scripts/test-local.sh -- --grep "messaging"        # pass args to playwright
#   ./scripts/test-local.sh -- tests/messaging.spec.ts   # run one file
#   ./scripts/test-local.sh --keep-servers               # leave servers running after tests

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/lib/helpers.sh"

# Parse args
APP_NAME="test-default"
SCAFFOLD=true
RESET=true
KEEP_SERVERS=false
PW_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-scaffold) SCAFFOLD=false; shift ;;
    --no-reset) RESET=false; shift ;;
    --keep-servers) KEEP_SERVERS=true; shift ;;
    --) shift; PW_ARGS=("$@"); break ;;
    *) APP_NAME="$1"; shift ;;
  esac
done

APP_DIR="$ROOT/.test-apps/$APP_NAME"
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

echo "=== DeepSpace Local Tests (app: $APP_NAME) ==="

# Scaffold with all features enabled
if [ "$SCAFFOLD" = true ]; then
  "$ROOT/scripts/lib/scaffold.sh" "$APP_NAME"
elif [ ! -d "$APP_DIR" ]; then
  echo "✗ No app at $APP_DIR — run without --no-scaffold first"
  exit 1
fi

# Ensure secrets
source "$ROOT/scripts/lib/ensure-secrets.sh"

if [ ! -f "$APP_DIR/.dev.vars" ]; then
  echo "✗ Missing $APP_DIR/.dev.vars — scaffold may have failed"
  exit 1
fi

# Reset databases
if [ "$RESET" = true ]; then
  echo "→ Resetting local databases..."
  rm -rf "$ROOT/platform/auth-worker/.wrangler/state"
  rm -rf "$ROOT/platform/api-worker/.wrangler/state"
  rm -rf "$ROOT/platform/deploy-worker/.wrangler/state"
  rm -rf "$ROOT/platform/platform-worker/.wrangler/state"
  rm -rf "$APP_DIR/.wrangler/state"
fi

# Start everything
source "$ROOT/scripts/lib/start-servers.sh"

# Run tests
echo ""
echo "→ Running Playwright tests..."
cd "$ROOT/tests/local"
npx playwright install chromium 2>/dev/null || true
npx playwright test "${PW_ARGS[@]+"${PW_ARGS[@]}"}"
