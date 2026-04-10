# API Worker

Hono-based Cloudflare Worker for billing, Stripe, integration proxying, and AI proxy.

## Testing
- `pnpm test` — Vitest with `@cloudflare/vitest-pool-workers` (runs in Workers runtime with real D1).
- Tests use real API keys from `.dev.vars` (synced from Doppler). Integration tests that need real keys use `skipIf(!hasRealKey(...))`.
- Test JWT signing uses a dedicated ES256 key pair in `vitest.config.ts` / `test-helpers.ts`.
- `authedFetch(path, userId)` helper signs a JWT and makes an authenticated request via `SELF`.

## AI Proxy Routes (`/api/proxy/`)
- Transparent forwarding to LLM providers (Anthropic, OpenAI).
- Auth accepts both `Authorization: Bearer <jwt>` and `X-Auth-Token: <jwt>`. The X-Auth-Token alternative exists because AI SDK providers set their own Authorization/x-api-key headers that conflict with JWT auth.
- Credit gate: `creditsAvailableForUser` must return > 0. Throws if user has no billing profile — callers must ensure the user exists in `user_profiles` first.
- Streaming: uses `tee()` on the response body — one branch goes to client, the other is read in `waitUntil()` for billing.
- Token pricing is per-model with a fallback default. Billing records use integration name = provider, endpoint = "proxy".
