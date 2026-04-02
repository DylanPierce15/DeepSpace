#!/usr/bin/env bash
# Shared helpers for DeepSpace scripts.
# Source this file: source "$(dirname "$0")/lib/helpers.sh"

PORTS=(8794 8795 8792 8780 5173 9235 9236 9233 9237)

free_ports() {
  for port in "${PORTS[@]}"; do
    local pids
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
      echo "  killing process on port $port"
      echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
  done
  sleep 1
}

wait_for_url() {
  local url="$1" name="$2" max_wait="${3:-20}"
  local elapsed=0
  while [ $elapsed -lt "$max_wait" ]; do
    if curl -sf "$url" > /dev/null 2>&1; then
      echo "  ✓ $name"
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  echo "  ✗ $name not ready at $url after ${max_wait}s"
  exit 1
}
