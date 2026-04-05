#!/usr/bin/env bash
# Scaffold an app into .test-apps/ using local packages.
#
# Usage:
#   ./scripts/lib/scaffold.sh <app-name>                   # bare starter
#   ./scripts/lib/scaffold.sh <app-name> --with-messaging   # add messaging feature
#   ./scripts/lib/scaffold.sh <app-name> --with-test-page   # add test-page feature
#   ./scripts/lib/scaffold.sh <app-name> --full             # all features

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP_NAME="${1:?Usage: scaffold.sh <app-name> [--with-messaging] [--with-test-page] [--full]}"
shift
APP_DIR="$ROOT/.test-apps/$APP_NAME"

# Parse feature flags
WITH_MESSAGING=false
WITH_TEST_PAGE=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-messaging) WITH_MESSAGING=true; shift ;;
    --with-test-page) WITH_TEST_PAGE=true; shift ;;
    --full) WITH_MESSAGING=true; WITH_TEST_PAGE=true; shift ;;
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

# ── Install SDK-imported features via direct file edits ──────────────

SCHEMAS_FILE="$APP_DIR/src/schemas.ts"
PAGES_FILE="$APP_DIR/src/pages.ts"

# Helper: add an import + schema entry to schemas.ts
add_schema() {
  local import_line="$1"  # e.g. "import { testItemsSchema } from 'deepspace/worker'"
  local schema_entry="$2" # e.g. "testItemsSchema," or "...messagingSchemas,"

  # Insert import before the schemas array
  sed -i '' "s|export const schemas|${import_line}\n\nexport const schemas|" "$SCHEMAS_FILE"
  # Insert schema entry into the array (after the opening bracket line)
  sed -i '' "s|export const schemas: CollectionSchema\[\] = \[|export const schemas: CollectionSchema[] = [\n  ${schema_entry}|" "$SCHEMAS_FILE"
}

# Helper: add a page entry to pages.ts
add_page() {
  local path="$1"
  local label="$2"
  local import_expr="$3"  # e.g. "import('deepspace').then(m => ({ default: m.ChatPage }))"

  sed -i '' "s|// ── Features add pages below this line ──|// ── Features add pages below this line ──\n  { path: '${path}', label: '${label}', component: lazy(() => ${import_expr}) },|" "$PAGES_FILE"
}

# Test page (for core e2e tests)
if [ "$WITH_TEST_PAGE" = true ]; then
  echo "→ Adding test-page feature (SDK import)..."
  add_schema "import { testItemsSchema } from 'deepspace/worker'" "testItemsSchema,"
  add_page "/test" "Test" "import('deepspace').then(m => ({ default: m.TestPage }))"
  echo "  ✓ test-page added"
fi

# Messaging
if [ "$WITH_MESSAGING" = true ]; then
  echo "→ Adding messaging feature (SDK import)..."
  add_schema "import { messagingSchemas } from 'deepspace/worker'" "...messagingSchemas,"
  add_page "/chat" "Chat" "import('deepspace').then(m => ({ default: m.ChatPage }))"
  echo "  ✓ messaging added"
fi

echo ""
echo "✓ App ready at .test-apps/$APP_NAME"
