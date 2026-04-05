#!/usr/bin/env bash
# Scaffold an app into .test-apps/ using local packages.
# Usage: ./scripts/lib/scaffold.sh <app-name>

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP_NAME="${1:?Usage: scaffold.sh <app-name>}"
APP_DIR="$ROOT/.test-apps/$APP_NAME"

if [ -d "$APP_DIR" ]; then
  echo "→ Removing existing .test-apps/$APP_NAME..."
  rm -rf "$APP_DIR"
fi

# Build
"$ROOT/scripts/lib/build.sh"

# Scaffold
cd "$ROOT/.test-apps"
"$ROOT/packages/create-deepspace/dist/index.js" "$APP_NAME" --local "$ROOT"

# Copy .dev.vars
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

# Install test-page feature (needed for core e2e tests)
"$ROOT/scripts/lib/install-feature.sh" "$APP_DIR" "test-page"

echo ""
echo "✓ App ready at .test-apps/$APP_NAME"
