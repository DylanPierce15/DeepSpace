#!/usr/bin/env bash
# Scaffold an app into .test-apps/ using local packages.
#
# Usage:
#   ./scripts/lib/scaffold.sh <app-name>                   # bare starter + test-page
#   ./scripts/lib/scaffold.sh <app-name> --with-messaging   # add messaging feature
#   ./scripts/lib/scaffold.sh <app-name> --full             # all test features

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP_NAME="${1:?Usage: scaffold.sh <app-name> [--with-messaging] [--full]}"
shift
APP_DIR="$ROOT/.test-apps/$APP_NAME"

# Parse feature flags
WITH_MESSAGING=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-messaging) WITH_MESSAGING=true; shift ;;
    --full) WITH_MESSAGING=true; shift ;;
    *) shift ;;
  esac
done

if [ -d "$APP_DIR" ]; then
  echo "→ Removing existing .test-apps/$APP_NAME..."
  rm -rf "$APP_DIR"
fi

# Build (always rebuilds to ensure dist/ is fresh before npm pack)
"$ROOT/scripts/lib/build.sh"

# Delete any stale tarballs so npm pack creates a fresh one
rm -f "$ROOT/.test-apps"/deepspace-*.tgz 2>/dev/null || true

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
"$ROOT/scripts/lib/install-feature.sh" "$APP_DIR" "testing"

# Install messaging if requested
if [ "$WITH_MESSAGING" = true ]; then
  "$ROOT/scripts/lib/install-feature.sh" "$APP_DIR" "messaging"
fi

echo ""
echo "✓ App ready at .test-apps/$APP_NAME"
