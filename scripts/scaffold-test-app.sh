#!/usr/bin/env bash
set -euo pipefail
# Scaffold a test app using local packages.
# Usage: ./scripts/scaffold-test-app.sh <app-name>
exec "$(dirname "$0")/lib/scaffold.sh" "$@"
