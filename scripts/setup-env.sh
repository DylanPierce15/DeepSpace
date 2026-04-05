#!/usr/bin/env bash
set -euo pipefail

# Sync Doppler secrets to .dev.vars files for local Cloudflare Workers development.
# Usage: ./scripts/setup-env.sh [dev|prd]

DOPPLER_PROJECT="deepspace-sdk"
CONFIG="${1:-dev}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "→ Syncing Doppler secrets (project=$DOPPLER_PROJECT, config=$CONFIG)"

# Download all secrets as KEY=VALUE pairs
SECRETS=$(doppler secrets download \
  --project "$DOPPLER_PROJECT" \
  --config "$CONFIG" \
  --no-file \
  --format env-no-quotes 2>/dev/null)

# ── Per-worker secret mapping ────────────────────────────────────────────────

write_dev_vars() {
  local dir="$1"
  shift
  local keys=("$@")
  local outfile="$dir/.dev.vars"

  mkdir -p "$dir"
  : > "$outfile"

  for key in "${keys[@]}"; do
    value=$(echo "$SECRETS" | grep "^${key}=" | head -1 | cut -d= -f2- || true)
    if [ -n "$value" ]; then
      echo "${key}=${value}" >> "$outfile"
    fi
  done

  echo "  ✓ $(wc -l < "$outfile" | tr -d ' ') secrets → $outfile"
}

# ── Auth Worker ──────────────────────────────────────────────────────────────
write_dev_vars "$ROOT/platform/auth-worker" \
  BETTER_AUTH_SECRET \
  JWT_PRIVATE_KEY \
  AUTH_BASE_URL \
  GOOGLE_CLIENT_ID \
  GOOGLE_CLIENT_SECRET \
  GITHUB_CLIENT_ID \
  GITHUB_CLIENT_SECRET

# ── API Worker ───────────────────────────────────────────────────────────────
write_dev_vars "$ROOT/platform/api-worker" \
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
  AUTH_JWT_PUBLIC_KEY \
  AUTH_JWT_ISSUER \
  INTERNAL_STORAGE_HMAC_SECRET \
  OPENAI_API_KEY \
  FREEPIK_API_KEY \
  SERPAPI_API_KEY \
  OPENWEATHER_API_KEY \
  NASA_API_KEY \
  EXA_API_KEY \
  NEWS_API_KEY

# ── Platform Worker ──────────────────────────────────────────────────────────
write_dev_vars "$ROOT/platform/platform-worker" \
  AUTH_JWT_PUBLIC_KEY \
  AUTH_JWT_ISSUER \
  AUTH_JWT_AUDIENCE \
  AUTH_JWT_CLOCK_SKEW_MS \
  INTERNAL_STORAGE_HMAC_SECRET

# ── Dispatch Worker ──────────────────────────────────────────────────────────
write_dev_vars "$ROOT/platform/dispatch-worker" \
  INTERNAL_STORAGE_HMAC_SECRET

echo "✓ All .dev.vars synced from Doppler ($CONFIG)"
echo "  Note: test app .dev.vars are created by scripts/scaffold-test-app.sh"
