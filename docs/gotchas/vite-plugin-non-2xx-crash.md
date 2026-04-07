# Cloudflare Vite Plugin: Non-2xx Response Crash

## Problem

Returning a non-2xx status code from certain Hono routes causes the Cloudflare Vite plugin to crash with "fetch failed" during local dev.

## Reproduction

Worker route in `worker.ts`:
```ts
app.post('/api/integrations/:name/:endpoint', async (c) => {
  return c.json({ test: 'hello' }, 401)  // CRASHES
})
```

Error:
```
Internal server error: fetch failed
  at miniflare/dist/src/index.js:87682
  at @cloudflare/vite-plugin/dist/index.mjs:11142
```

## Systematic debugging

### Step 1: Hardcoded GET fetch, return c.json 200
```ts
app.post('/api/integrations/:name/:endpoint', async (c) => {
  const res = await fetch('https://deepspace-api-dev..../api/health')
  const data = await res.text()
  return c.json({ ok: true, data })
})
```
**Result: WORKS**

### Step 2: POST fetch with body, return c.json 200
```ts
const body = await c.req.text()
const res = await fetch('https://deepspace-api-dev..../api/integrations/openai/chat-completion', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
})
const data = await res.text()
return c.json({ ok: true, status: res.status, data })
```
**Result: WORKS** (res.status is 401, but we return 200)

### Step 3: Dynamic URL from env + params
```ts
const url = `${c.env.API_WORKER_URL}/api/integrations/${c.req.param('name')}/${c.req.param('endpoint')}`
// same fetch + c.json pattern
```
**Result: WORKS**

### Step 4: Add resolveAuth before fetch
```ts
const auth = await resolveAuth(c.req.raw, c.env)
// same fetch + c.json pattern
```
**Result: WORKS**

### Step 5a: Add X-Billing-User-Id header
```ts
headers: { 'Content-Type': 'application/json', 'X-Billing-User-Id': c.env.OWNER_USER_ID }
// same c.json return
```
**Result: WORKS**

### Step 5b: Change return from c.json to new Response with res.status (401)
```ts
return new Response(data, { status: res.status, headers: { 'Content-Type': 'application/json' } })
```
**Result: CRASHES**

### Step 5c: new Response with status 200
```ts
return new Response(data, { status: 200, headers: { 'Content-Type': 'application/json' } })
```
**Result: WORKS**

### Step 5d: new Response with status 401
```ts
return new Response(data, { status: 401, headers: { 'Content-Type': 'application/json' } })
```
**Result: CRASHES**

### Step 5e: c.json with 401
```ts
return c.json(JSON.parse(data), 401)
```
**Result: CRASHES**

### Step 5f: Hardcoded c.json 401, NO fetch at all
```ts
app.post('/api/integrations/:name/:endpoint', async (c) => {
  return c.json({ test: 'returning 401' }, 401)
})
```
**Result: CRASHES**

## Key finding

ANY non-2xx response from the `/api/integrations/:name/:endpoint` route crashes the Vite plugin. No external fetch is involved — even a hardcoded `c.json({}, 401)` crashes.

## Root cause

The Cloudflare Vite plugin (`@cloudflare/vite-plugin@1.31.0`) crashes on ALL non-2xx responses from the worker, regardless of route, framework, or response construction method. This affects every route, not just integrations.

Verified by testing:
- `app.post('/api/test-401', (c) => c.json({}, 401))` — crashes
- `app.post('/api/auth/test-401', (c) => c.json({}, 401))` — crashes
- `app.post('/api/x/y/z', (c) => c.json({}, 401))` — crashes
- Raw worker handler (no Hono): `new Response('{}', { status: 401 })` — crashes
- Auth proxy wrong password (returns 403 from upstream) — also crashes

## Why auth appears to work

The app's auth flow (sign-in, sign-out, wrong password errors) works despite this bug because Better Auth's client-side code is resilient — it handles 500/error responses gracefully and treats them as auth failures. The browser gets `status: 500` with an HTML error overlay, not the actual 401/403 from the worker.

## Impact

- Non-2xx responses return 500 + HTML error overlay to the client
- Server logs show "Internal server error: fetch failed" 
- The worker code itself is correct — the error is in the Vite plugin's response forwarding
- Production deploys are NOT affected (no Vite plugin in production)
- Client code that tolerates errors (like Better Auth) works fine
- Client code that expects specific status codes will break in dev

## Workaround

For integration proxy and other routes that need to return non-2xx:
- Always return 200 from the worker, include actual status in the response body
- Or: ensure client code handles 500 + HTML error overlay gracefully
- Production works correctly — this is dev-only

## Plugin version

`@cloudflare/vite-plugin@1.31.0` (latest as of 2026-04-07)
