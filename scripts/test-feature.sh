#!/usr/bin/env bash
set -euo pipefail

# Test a single feature end-to-end.
#
# Usage:
#   ./scripts/test-feature.sh items-crud
#   ./scripts/test-feature.sh chat-messaging
#   ./scripts/test-feature.sh --all                # run all feature tests
#   ./scripts/test-feature.sh items-crud --no-scaffold  # reuse existing app

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/lib/helpers.sh"

FEATURES_DIR="$ROOT/packages/create-deepspace/features"
SCAFFOLD=true
FEATURES=()

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-scaffold) SCAFFOLD=false; shift ;;
    --all)
      for d in "$FEATURES_DIR"/*/tests; do
        [ -d "$d" ] && FEATURES+=("$(basename "$(dirname "$d")")")
      done
      shift ;;
    *) FEATURES+=("$1"); shift ;;
  esac
done

if [ ${#FEATURES[@]} -eq 0 ]; then
  echo "Usage: ./scripts/test-feature.sh <feature-id> [--no-scaffold]"
  echo "       ./scripts/test-feature.sh --all"
  echo ""
  echo "Features with tests:"
  for d in "$FEATURES_DIR"/*/tests; do
    [ -d "$d" ] && echo "  $(basename "$(dirname "$d")")"
  done
  exit 1
fi

APP_NAME="test-feature"
APP_DIR="$ROOT/.test-apps/$APP_NAME"
PIDS=()
FAILED=()
PASSED=()

cleanup() {
  echo ""
  echo "→ Stopping services..."
  for pid in "${PIDS[@]+"${PIDS[@]}"}"; do
    kill "$pid" 2>/dev/null && wait "$pid" 2>/dev/null || true
  done
  echo "→ Clean."
}
trap cleanup EXIT

for FEATURE in "${FEATURES[@]}"; do
  FEATURE_DIR="$FEATURES_DIR/$FEATURE"
  TEST_DIR="$FEATURE_DIR/tests"

  if [ ! -d "$TEST_DIR" ]; then
    echo "⚠ No tests for $FEATURE — skipping"
    continue
  fi

  echo ""
  echo "=== Testing feature: $FEATURE ==="

  # Scaffold fresh app for each feature
  if [ "$SCAFFOLD" = true ]; then
    # Kill any running servers from previous feature
    for pid in "${PIDS[@]+"${PIDS[@]}"}"; do
      kill "$pid" 2>/dev/null && wait "$pid" 2>/dev/null || true
    done
    PIDS=()

    # Fresh scaffold
    "$ROOT/scripts/lib/scaffold.sh" "$APP_NAME"

    # Ensure secrets
    source "$ROOT/scripts/lib/ensure-secrets.sh"
    if [ ! -f "$APP_DIR/.dev.vars" ]; then
      echo "✗ Missing $APP_DIR/.dev.vars"
      exit 1
    fi

    # Reset databases
    rm -rf "$ROOT/platform/auth-worker/.wrangler/state"
    rm -rf "$ROOT/platform/api-worker/.wrangler/state"
    rm -rf "$ROOT/platform/platform-worker/.wrangler/state"
    rm -rf "$APP_DIR/.wrangler/state"

    # Install the feature
    "$ROOT/scripts/lib/install-feature.sh" "$APP_DIR" "$FEATURE"

    # Start servers
    source "$ROOT/scripts/lib/start-servers.sh"
  fi

  # Run this feature's Playwright tests
  echo ""
  echo "→ Running $FEATURE tests..."
  cd "$ROOT/tests/local"
  npx playwright install chromium 2>/dev/null || true

  # Use features config which has testDir pointing at features/
  if npx playwright test --config "$ROOT/tests/local/playwright.features.config.ts" "$TEST_DIR"; then
    PASSED+=("$FEATURE")
  else
    FAILED+=("$FEATURE")
  fi
done

# Summary
echo ""
echo "=== Feature Test Summary ==="
echo "Passed: ${#PASSED[@]}"
for f in "${PASSED[@]+"${PASSED[@]}"}"; do echo "  ✓ $f"; done
if [ ${#FAILED[@]} -gt 0 ]; then
  echo "Failed: ${#FAILED[@]}"
  for f in "${FAILED[@]}"; do echo "  ✗ $f"; done
  exit 1
fi
