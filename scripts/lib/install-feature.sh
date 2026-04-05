#!/usr/bin/env bash
# Install a feature into an app and wire it.
# Usage: ./scripts/lib/install-feature.sh <app-dir> <feature-id>
#
# Runs add-feature.cjs (copies files, injects schema),
# then adds one line to pages.ts for the route + nav.

set -euo pipefail

APP_DIR="${1:?Usage: install-feature.sh <app-dir> <feature-id>}"
FEATURE_ID="${2:?Usage: install-feature.sh <app-dir> <feature-id>}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FEATURES_DIR="$ROOT/packages/create-deepspace/features"

# Run add-feature script (copies files, injects schema)
node "$APP_DIR/.deepspace/scripts/add-feature.cjs" "$FEATURE_ID" "$APP_DIR"

# Read feature.json for route info
FEATURE_JSON="$FEATURES_DIR/$FEATURE_ID/feature.json"
if [ ! -f "$FEATURE_JSON" ]; then
  echo "  ✓ $FEATURE_ID installed (no feature.json)"
  exit 0
fi

# Add page entry to pages.ts using a helper script
node "$ROOT/scripts/lib/wire-page.cjs" "$APP_DIR" "$FEATURE_JSON"

echo "  ✓ $FEATURE_ID installed and wired"
