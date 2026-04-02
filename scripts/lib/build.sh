#!/usr/bin/env bash
# Build deepspace and create-deepspace packages.
# Usage: ./scripts/lib/build.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "→ Building deepspace..."
cd "$ROOT/packages/deepspace" && pnpm build > /dev/null 2>&1

echo "→ Building create-deepspace..."
cd "$ROOT/packages/create-deepspace" && pnpm build > /dev/null 2>&1
