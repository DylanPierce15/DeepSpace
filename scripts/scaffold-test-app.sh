#!/usr/bin/env bash
set -euo pipefail

# Scaffold a test app using local packages (no npm registry).
#
# Usage: ./scripts/scaffold-test-app.sh <app-name>
#
# The app is created in .test-apps/<app-name>/.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="${1:?Usage: scaffold-test-app.sh <app-name>}"
APP_DIR="$ROOT/.test-apps/$APP_NAME"

if [ -d "$APP_DIR" ]; then
  echo "→ Removing existing .test-apps/$APP_NAME..."
  rm -rf "$APP_DIR"
fi

# ── Build packages ───────────────────────────────────────────────────────────
echo "→ Building deepspace..."
cd "$ROOT/packages/deepspace" && pnpm build > /dev/null 2>&1

echo "→ Building create-deepspace..."
cd "$ROOT/packages/create-deepspace" && pnpm build > /dev/null 2>&1

# ── Scaffold ─────────────────────────────────────────────────────────────────
cd "$ROOT/.test-apps"
"$ROOT/packages/create-deepspace/dist/index.js" "$APP_NAME" --local "$ROOT"

# ── Copy .dev.vars ───────────────────────────────────────────────────────────
if [ -f "$ROOT/platform/platform-worker/.dev.vars" ]; then
  echo "→ Copying .dev.vars..."
  {
    grep "^AUTH_JWT_PUBLIC_KEY=" "$ROOT/platform/platform-worker/.dev.vars" || true
    grep "^AUTH_JWT_ISSUER=" "$ROOT/platform/platform-worker/.dev.vars" || true
    grep "^INTERNAL_STORAGE_HMAC_SECRET=" "$ROOT/platform/platform-worker/.dev.vars" || true
    echo "AUTH_WORKER_URL=http://localhost:8794"
    echo "OWNER_USER_ID=test-owner"
  } > "$APP_DIR/.dev.vars"
fi

echo ""
echo "✓ Test app ready at .test-apps/$APP_NAME"
