#!/usr/bin/env bash
# Ensure platform worker .dev.vars exist, syncing from Doppler if needed.
# Source this: source "$ROOT/scripts/lib/ensure-secrets.sh"
# Expects ROOT to be set by the caller.

: "${ROOT:?ROOT must be set}"

NEED_DOPPLER=false
for dir in platform/auth-worker platform/api-worker platform/deploy-worker platform/platform-worker; do
  if [ ! -f "$ROOT/$dir/.dev.vars" ]; then
    NEED_DOPPLER=true
    break
  fi
done

if [ "$NEED_DOPPLER" = true ]; then
  echo "→ Syncing secrets from Doppler..."
  "$ROOT/scripts/setup-env.sh" dev
fi
