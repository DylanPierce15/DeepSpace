# 2026-04-07: Integration Proxy Fetch Bug

## Context

We're building the DeepSpace SDK integration API — a proxy in the app worker that forwards requests to the API worker for third-party integrations (OpenAI, weather, etc.).

**Architecture:**
- App worker runs locally via Cloudflare Vite plugin (miniflare inside Vite)
- App worker has routes that proxy to external Cloudflare Workers
- Auth proxy (`/api/auth/*`) forwards to `deepspace-auth-dev.eudaimonicincorporated.workers.dev`
- Integration proxy (`/api/integrations/:name/:endpoint`) forwards to `deepspace-api-dev.eudaimonicincorporated.workers.dev`

## The Bug

POST fetch to external URLs fails from the `/api/integrations/:name/:endpoint` route but works from other routes in the same worker.

## What Was Tested

### Test 1: Auth proxy POST — WORKS
```
curl -X POST http://localhost:5173/api/auth/sign-up/email -H "Content-Type: application/json" -d '{"email":"test@test.local","password":"testpass123","name":"Test"}'
→ {"token":"...","user":{...}}
```
The auth proxy uses `fetch(authUrl, { method, headers: c.req.raw.headers, body: c.req.raw.body })` and successfully POSTs to `deepspace-auth-dev.eudaimonicincorporated.workers.dev`.

### Test 2: Custom test route POST — WORKS
```ts
// In worker.ts:
app.post('/api/test-fetch/:a/:b', async (c) => {
  const body = await c.req.text()
  const res = await fetch(`${c.env.API_WORKER_URL}/api/integrations/${c.req.param('a')}/${c.req.param('b')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body || '{}',
  })
  const data = await res.text()
  return c.json({ status: res.status, data })
})
```
```
curl -X POST http://localhost:5173/api/test-fetch/openai/chat-completion -H "Content-Type: application/json" -d '{"test":true}'
→ {"status":401,"data":"{\"error\":\"Missing authorization token\"}"}
```
This hits the exact same external URL and works.

### Test 3: Integration route returning JSON (no fetch) — WORKS
```ts
app.post('/api/integrations/:name/:endpoint', async (c) => {
  return c.json({ debug: 'route reached', name: c.req.param('name') })
})
```
```
curl -X POST http://localhost:5173/api/integrations/openai/chat-completion -H "Content-Type: application/json" -d '{}'
→ {"debug":"route reached","name":"openai"}
```
The route itself is reachable.

### Test 4: Integration route with fetch — FAILS
```ts
app.post('/api/integrations/:name/:endpoint', async (c) => {
  const body = await c.req.text()
  const url = `${c.env.API_WORKER_URL}/api/integrations/${c.req.param('name')}/${c.req.param('endpoint')}`
  const res = await fetch(url, {
    method: c.req.method,
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  const data = await res.text()
  return new Response(data, { status: res.status, headers: { 'Content-Type': 'application/json' } })
})
```
```
curl -X POST http://localhost:5173/api/integrations/openai/chat-completion -H "Content-Type: application/json" -d '{"test":true}'
→ 500 Internal Server Error (HTML error overlay from Vite plugin)
```
Error: `fetch failed` at `miniflare/dist/src/index.js:57561` → `@cloudflare/vite-plugin/dist/index.mjs:11142`

### Test 5: Integration route with try/catch around fetch — UNCLEAR
```ts
app.post('/api/integrations/:name/:endpoint', async (c) => {
  try {
    const res = await fetch('https://deepspace-api-dev.eudaimonicincorporated.workers.dev/api/health')
    const data = await res.text()
    return c.json({ ok: true, data })
  } catch (err: any) {
    return c.json({ ok: false, error: err.message }, 500)
  }
})
```
When tested with curl directly after a server restart, this returned `{"ok":true,...}`. But when tested via Playwright, the Vite error overlay still appeared. Testing methodology was unreliable — server was being started/stopped between tests, making it unclear which code was actually running.

### Test 6: GET from integration route — WORKS
```
curl http://localhost:5173/api/integrations/openai/chat-completion
→ {"error":"Not found"}
```
GET fetch to the same external URL works from the same route. Only POST fails.

## Summary of Findings

| Route | Method | Fetch Target | Body | Result |
|---|---|---|---|---|
| `/api/auth/*` | POST | auth-dev worker | c.req.raw.body | ✅ Works |
| `/api/test-fetch/:a/:b` | POST | api-dev worker | await c.req.text() | ✅ Works |
| `/api/integrations/:name/:endpoint` | GET | api-dev worker | none | ✅ Works |
| `/api/integrations/:name/:endpoint` | POST | api-dev worker | await c.req.text() | ❌ Fails |
| `/api/integrations/:name/:endpoint` | POST | none (return JSON) | n/a | ✅ Works |

## The Unexplained

Test 2 and Test 4 have:
- Same route handler code (fetch with POST to same URL, same body handling)
- Same worker file
- Same Hono instance
- Same Vite plugin / miniflare runtime
- Only the route path differs (`/api/test-fetch/:a/:b` vs `/api/integrations/:name/:endpoint`)

## What Hasn't Been Checked

1. Whether the Vite plugin or miniflare has special handling for paths containing "integrations"
2. Whether `app.all` vs `app.post` matters (was changed during debugging, unclear if retested cleanly)
3. Whether the `import { integrations } from './src/integrations.js'` at the top of the worker is somehow interfering with the route (the variable name `integrations` shadows or conflicts with the route path)
4. Whether HMR is reloading the worker module correctly when changes are made (stale code possibility)
5. Checking miniflare logs at debug level for the actual fetch error cause

## Files Involved

- Template worker: `packages/create-deepspace/templates/starter/worker.ts`
- Test app worker: `~/GitHub/test-app-1/worker.ts`
- Integration config: `packages/create-deepspace/templates/starter/src/integrations.ts`
- Integration client: `packages/deepspace/src/client/integration/index.ts`
- API worker route: `platform/api-worker/src/routes/integrations.ts`

## What Was Built (Working, Before This Bug)

- `integration` client singleton (`import { integration } from 'deepspace'`)
- Per-integration billing config (`src/integrations.ts`)
- `X-Billing-User-Id` header support in API worker
- `caller_user_id` column in billing DB
- `tools.integration` for server actions
- Dev + prod API workers deployed and working
