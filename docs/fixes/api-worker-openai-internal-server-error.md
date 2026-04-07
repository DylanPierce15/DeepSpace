# Fix: API Worker "Internal server error" on Integration Calls

## Symptoms

Calling any integration endpoint returned `{"error":"Internal server error"}` with no useful error message.

## Root causes (two issues)

### 1. Missing `caller_user_id` column

The D1 `integration_usage` table was missing the `caller_user_id` column that was added to the Drizzle schema. The `ALTER TABLE` command ran on the local database but not the remote.

**Fix:**
```bash
npx wrangler d1 execute deepspace-billing --remote --command "ALTER TABLE integration_usage ADD COLUMN caller_user_id TEXT"
```

### 2. Missing OpenAI API key

The production API worker didn't have `OPENAI_API_KEY` set as a wrangler secret.

**Fix:**
```bash
doppler secrets get OPENAI_API_KEY --project deepspace-sdk --config prd --plain | npx wrangler secret put OPENAI_API_KEY --config platform/api-worker/wrangler.toml
```

### 3. No error details from Hono

Hono's default error handler returns `"Internal server error"` with no details. Added `app.onError` to the API worker to return the actual error message.

## How to test against the prod API worker

### Direct curl
```bash
# Refresh JWT
npx deepspace whoami

# Call integration directly
TOKEN=$(cat ~/.deepspace/token)
curl -s "https://deepspace-api.eudaimonicincorporated.workers.dev/api/integrations/openai/chat-completion" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"messages":[{"role":"user","content":"Say hello"}],"model":"gpt-4o-mini","max_tokens":20}'
```

### Via the app (browser)
```bash
# Start dev server pointed at prod
cd ~/GitHub/test-app-1
npx deepspace dev --prod

# Open http://localhost:5173/integration-test
# Sign in, click Send Request
```

### Via Playwright
```bash
# .dev.vars must point to prod (run deepspace dev --prod first, then kill it)
cd ~/GitHub/test-app-1
npx playwright test tests/integration.spec.ts --config tests/playwright.config.ts
```

Note: `npx deepspace test` always writes `.dev.vars` pointing to dev workers. To test against prod, run `npx deepspace dev --prod` first to write the prod `.dev.vars`, then run Playwright manually.

## Sync all API keys

To set all integration API keys on the prod API worker from Doppler:
```bash
./scripts/sync-secrets.sh prd
```
