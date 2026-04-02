#!/usr/bin/env bash
set -euo pipefail

# Start the full local development stack.
# Usage: pnpm dev [app-name]

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/lib/helpers.sh"

APP_NAME="${1:-dev-app}"
APP_DIR="$ROOT/.test-apps/$APP_NAME"
PIDS=()

cleanup() {
  echo ""
  echo "→ Stopping services..."
  for pid in "${PIDS[@]+"${PIDS[@]}"}"; do
    kill "$pid" 2>/dev/null && wait "$pid" 2>/dev/null || true
  done
  echo "→ Done."
}
trap cleanup EXIT INT TERM

echo "=== DeepSpace Local Dev (app: $APP_NAME) ==="

# Scaffold if needed
if [ ! -d "$APP_DIR" ]; then
  "$ROOT/scripts/lib/scaffold.sh" "$APP_NAME"
fi

# Ensure secrets
source "$ROOT/scripts/lib/ensure-secrets.sh"

# Start everything
source "$ROOT/scripts/lib/start-servers.sh"

echo ""
echo "  App:          http://localhost:5173"
echo "  App Worker:   http://localhost:8780"
echo "  Auth:         http://localhost:8794"
echo "  API:          http://localhost:8795"
echo "  Platform:     http://localhost:8792"
echo "  App dir:      $APP_DIR"
echo ""
echo "  Edit the app at: $APP_DIR/src/"
echo "  Press Ctrl+C to stop."

open "http://localhost:5173" 2>/dev/null || true
wait
