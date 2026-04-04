#!/usr/bin/env bash
set -euo pipefail

# Sync Doppler secrets to Cloudflare Workers (production).
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

# Push secrets to a Cloudflare Worker via wrangler
sync_worker() {
  local worker_dir="$1"
  local worker_name="$2"
  shift 2
  local keys=("$@")

  local count=0
  local skipped=0

  echo "  $worker_name"

  for key in "${keys[@]}"; do
    value=$(get_secret "$key")
    if [ -n "$value" ]; then
      echo "$value" | npx wrangler secret put "$key" \
        --config "$worker_dir/wrangler.toml" \
        2>&1 | grep -q "Success" && count=$((count + 1)) || true
    else
      skipped=$((skipped + 1))
    fi
  done

  echo "    ✓ $count secrets synced ($skipped skipped)"
}

# ── Auth Worker ──────────────────────────────────────────────────────────────
sync_worker "$ROOT/platform/auth-worker" "deepspace-auth" \
  BETTER_AUTH_SECRET \
  JWT_PRIVATE_KEY \
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

echo ""
echo "✓ All Cloudflare Worker secrets synced from Doppler ($CONFIG)"
