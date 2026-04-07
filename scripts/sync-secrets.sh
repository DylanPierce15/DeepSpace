#!/usr/bin/env bash
set -euo pipefail

# Sync Doppler secrets to Cloudflare Workers (production + dev environments).
# Usage: ./scripts/sync-secrets.sh [dev|prd]
#
# For local development (.dev.vars), use setup-env.sh instead.

DOPPLER_PROJECT="deepspace-sdk"
CONFIG="${1:-prd}"

echo "→ Syncing Doppler secrets → Cloudflare Workers (project=$DOPPLER_PROJECT, config=$CONFIG)"
echo ""

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Download all secrets as JSON
SECRETS_JSON=$(doppler secrets download \
  --project "$DOPPLER_PROJECT" \
  --config "$CONFIG" \
  --no-file \
  --format json 2>/dev/null)

get_secret() {
  echo "$SECRETS_JSON" | jq -r ".\"$1\" // empty"
}

# Push secrets to a Cloudflare Worker via wrangler.
# Usage: sync_worker <worker_dir> <worker_name> [--env <env>] <key1> <key2> ...
# Supports key remapping with KEY_FROM=KEY_TO syntax (Doppler key → wrangler secret name).
sync_worker() {
  local worker_dir="$1"
  local worker_name="$2"
  shift 2

  local env_args=()
  if [ "${1:-}" = "--env" ]; then
    env_args=("--env" "$2")
    shift 2
  fi

  local keys=("$@")
  local count=0
  local skipped=0

  echo "  $worker_name${env_args[*]:+ (${env_args[1]})}"

  for entry in "${keys[@]}"; do
    # Support KEY_FROM=KEY_TO remapping
    local doppler_key="${entry%%=*}"
    local wrangler_key="${entry##*=}"
    if [ "$doppler_key" = "$wrangler_key" ]; then
      wrangler_key="$doppler_key"
    fi

    value=$(get_secret "$doppler_key")
    if [ -n "$value" ]; then
      echo "$value" | npx wrangler secret put "$wrangler_key" \
        --config "$worker_dir/wrangler.toml" \
        "${env_args[@]}" \
        2>&1 | grep -q "Success" && count=$((count + 1)) || true
    else
      skipped=$((skipped + 1))
    fi
  done

  echo "    ✓ $count secrets synced ($skipped skipped)"
}

# =============================================================================
# Production Workers
# =============================================================================

# ── Auth Worker ──────────────────────────────────────────────────────────────
sync_worker "$ROOT/platform/auth-worker" "deepspace-auth" \
  BETTER_AUTH_SECRET \
  JWT_PRIVATE_KEY \
  AUTH_JWT_PUBLIC_KEY \
  AUTH_BASE_URL \
  GOOGLE_CLIENT_ID \
  GOOGLE_CLIENT_SECRET \
  GITHUB_CLIENT_ID \
  GITHUB_CLIENT_SECRET

# ── API Worker ───────────────────────────────────────────────────────────────
sync_worker "$ROOT/platform/api-worker" "deepspace-api" \
  AUTH_JWT_PUBLIC_KEY \
  AUTH_JWT_ISSUER \
  STRIPE_SECRET_KEY \
  STRIPE_WEBHOOK_SECRET \
  STRIPE_PUBLISHABLE_KEY \
  STRIPE_PREMIUM_MONTHLY_PRICE_ID \
  STRIPE_PREMIUM_YEARLY_PRICE_ID \
  STRIPE_ENTERPRISE_MONTHLY_PRICE_ID \
  STRIPE_ENTERPRISE_YEARLY_PRICE_ID \
  STRIPE_STARTER_MONTHLY_PRICE_ID \
  STRIPE_PAY_PER_CREDIT_PRICE_ID \
  STRIPE_CONNECT_WEBHOOK_SECRET \
  OPENAI_API_KEY \
  FREEPIK_API_KEY \
  SERP_API_KEY \
  INTERNAL_STORAGE_HMAC_SECRET

# ── Deploy Worker ────────────────────────────────────────────────────────────
sync_worker "$ROOT/platform/deploy-worker" "deepspace-deploy" \
  AUTH_JWT_PUBLIC_KEY \
  AUTH_JWT_ISSUER \
  CLOUDFLARE_API_TOKEN \
  CLOUDFLARE_ACCOUNT_ID \
  JWT_PUBLIC_KEY \
  AUTH_WORKER_URL \
  INTERNAL_STORAGE_HMAC_SECRET

# ── Platform Worker ──────────────────────────────────────────────────────────
sync_worker "$ROOT/platform/platform-worker" "deepspace-platform-worker" \
  AUTH_JWT_PUBLIC_KEY \
  AUTH_JWT_ISSUER \
  INTERNAL_STORAGE_HMAC_SECRET

# =============================================================================
# Dev Workers (devnet — separate DB, separate JWT keys)
# =============================================================================

# ── Auth Worker (dev) ────────────────────────────────────────────────────────
# Uses _DEV suffixed Doppler keys, remapped to the standard secret names.
# Google OAuth uses the same credentials as prod (extra redirect URI added).
sync_worker "$ROOT/platform/auth-worker" "deepspace-auth" --env dev \
  BETTER_AUTH_SECRET_DEV=BETTER_AUTH_SECRET \
  JWT_PRIVATE_KEY_DEV=JWT_PRIVATE_KEY \
  AUTH_JWT_PUBLIC_KEY_DEV=AUTH_JWT_PUBLIC_KEY \
  AUTH_BASE_URL_DEV=AUTH_BASE_URL \
  GITHUB_CLIENT_ID_DEV=GITHUB_CLIENT_ID \
  GITHUB_CLIENT_SECRET_DEV=GITHUB_CLIENT_SECRET \
  GOOGLE_CLIENT_ID \
  GOOGLE_CLIENT_SECRET

# ── API Worker (dev) ─────────────────────────────────────────────────────────
sync_worker "$ROOT/platform/api-worker" "deepspace-api" --env dev \
  AUTH_JWT_PUBLIC_KEY_DEV=AUTH_JWT_PUBLIC_KEY \
  AUTH_JWT_ISSUER_DEV=AUTH_JWT_ISSUER

echo ""
echo "✓ All Cloudflare Worker secrets synced from Doppler ($CONFIG)"
