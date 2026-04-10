# Cloudflare Vite Plugin: Non-2xx POST Response Crash

## TL;DR

During local dev, if a Hono/worker route returns a non-2xx status code for a `POST` request, the `@cloudflare/vite-plugin` crashes with `Internal server error: fetch failed` and shows the Vite error overlay. `GET` requests with the same statuses work fine. `POST` + 2xx works fine. The worker handler itself is correct — the error happens in the transport layer between workerd and miniflare, bypassing all JS error handlers.

**Our fix: `safeJson` helper.** Workers always return HTTP 200 with the real status encoded in the response body as `{ ...data, status: number }`. Clients read `body.status` instead of `res.status` via `parseSafeResponse`. Production is unaffected (the bug only exists in the dev plugin).

**Upstream issue:** [cloudflare/workers-sdk#13013](https://github.com/cloudflare/workers-sdk/issues/13013), actively being worked on by the Cloudflare team.

---

## Symptoms

The Vite dev server logs (even with no client action):
```
[vite] Internal server error: fetch failed
    at Object.processResponse (node_modules/undici/lib/web/fetch/index.js:237:16)
    at node_modules/undici/lib/web/fetch/index.js:1081:19
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
    at async fetch4 (node_modules/miniflare/dist/src/index.js:57562:20)
    at async _Miniflare.dispatchFetch (node_modules/miniflare/dist/src/index.js:87758:22)
    at async node_modules/@cloudflare/vite-plugin/dist/index.mjs:11142:19
```

Client receives HTTP 500 with an HTML error overlay page instead of the intended 401 / 403 / 404 / 500.

## What triggers it

| Method | Status | Result |
|--------|--------|--------|
| GET    | 200    | ✅ works |
| GET    | 401    | ✅ works |
| POST   | 200    | ✅ works |
| POST   | 201    | ✅ works |
| POST   | 400    | ❌ crashes |
| POST   | 401    | ❌ crashes |
| POST   | 403    | ❌ crashes |
| POST   | 404    | ❌ crashes |
| POST   | 500    | ❌ crashes |

No route, framework, or response-construction choice matters. Verified:

- Hono `c.json(data, 401)` — crashes
- Raw `new Response(body, { status: 401 })` — crashes
- Static handler with no outbound fetch — crashes
- Handler that consumes `c.req.text()` before returning — crashes
- Any route path (`/api/test`, `/api/auth/token`, `/foo`) — crashes

## Root cause

The bug is in miniflare's `DispatchFetchDispatcher.dispatch()` in `packages/miniflare/src/http/fetch.ts`:

```js
dispatch(options, handler) {
  // ...
  if (origin === this.actualRuntimeOrigin) {
    options.origin = origin
    // ...
    options.reset = true  // ← THIS
    return this.runtimeDispatcher.dispatch(options, handler)
  }
  // ...
}
```

`options.reset = true` was added in [PR #11642 "Improve miniflare test stability"](https://github.com/cloudflare/workers-sdk/pull/11642) to prevent keep-alive socket issues during tests. The side effect: every request through the runtime dispatcher forcibly closes the socket with a TCP reset after the response.

On POST + non-2xx, a race condition emerges. The server (workerd) sends the response **before** fully consuming the request body — common when a handler rejects early (e.g. `if (!session) return c.json(..., 401)` never reads `c.req.text()`). When `options.reset = true` tears down the socket, undici sees the unconsumed request body as an unexpected state and rejects `processResponse` with a generic `fetch failed`. The error bubbles up to the Vite plugin's `createRequestHandler`, which passes it to `next(error)`, producing the Vite overlay.

Why the JS error handlers don't catch it:
- The `fetch` that throws is miniflare's **internal** `fetch4` call from Node.js to workerd, not the worker's own `fetch()` to external services.
- It happens in a microtask after the worker handler has already returned a Response.
- The error path is: `undici.processResponse → fetch4 → dispatchFetch → Vite plugin`, with no frames from worker code.

Wrapping the Hono default export in `try/catch`, adding `app.onError()`, or catching in the route handler has no effect — the error never reaches any of those layers.

## Why GET works but POST doesn't

GET requests have no body, so there's nothing for the socket reset to race against. The response completes cleanly before the reset. POST has a request body that the handler may or may not consume; if it doesn't consume it and the socket gets reset, undici throws.

## Proposed upstream fixes

From the issue thread:

1. **Miniflare side** — Replace `options.reset = true` with `headers.set("connection", "close")`. Same intent (no keep-alive pooling) without forcibly killing the socket mid-flight.

2. **Undici side** — [nodejs/undici#4941](https://github.com/nodejs/undici/pull/4941) has a related fix in progress. Once released and miniflare bumps its dep, the issue should resolve.

Neither is merged as of this writing. Cloudflare maintainers (`petebacondarwin`, `MattieTK`, `lrapoport-cf`) are tracking it.

## Workarounds

### Option A: Pin miniflare (quick but brittle)

In `package.json`:
```json
{
  "overrides": {
    "miniflare": "4.20251217.0"
  }
}
```

This rolls miniflare back to before the bad change. Works, but freezes you on an old version and breaks as soon as you need a newer feature.

### Option B (**what we do**): `safeJson` convention

Every worker always returns HTTP 200. The real status is encoded in the response body as a `status` field. Clients read `body.status` instead of `res.status`.

**Server (all platform workers and the starter template):**
```ts
import { safeJson } from 'deepspace/worker'

app.post('/api/auth/token', async (c) => {
  const { session } = await getSession(c)
  if (!session?.user) return safeJson(c, { token: null, error: 'Unauthorized' }, 401)
  // ...
  return safeJson(c, { token: jwt })
})
```

Wire format:
```json
{ "token": null, "error": "Unauthorized", "status": 401 }
```

HTTP status is always 200, so miniflare never hits the bad code path.

**Client:**
```ts
import { parseSafeResponse } from 'deepspace'

const res = await fetch('/api/auth/token', { method: 'POST', credentials: 'include' })
const { data, status, ok } = await parseSafeResponse<{ token?: string | null }>(res)
if (!ok) throw new Error(data.error)
```

`parseSafeResponse` reads `body.status` if present, falls back to `res.status` if not — so it works with legacy endpoints too.

Why this is the preferred solution:
- No dependency pinning, no patches to ship
- Immune to future miniflare regressions in this code path
- Production still sees the correct logical status via the body
- Symmetric between dev and prod (same wire format both places)
- DevTools network tab is slightly confusing (everything shows 200) but that's a minor tradeoff

The cost is that the network tab always shows 200, so you can't use status-code-based filters in DevTools. We think that's worth it.

## Files that enforce this

**SDK side:**
- `packages/deepspace/src/server/utils/response.ts` — `safeJson(c, data, status)` helper
- `packages/deepspace/src/shared/safe-response.ts` — `parseSafeResponse<T>(res)` client helper
- `packages/deepspace/src/client/auth/token.ts` — uses `parseSafeResponse` so `getAuthToken` works with 401s in dev
- `platform/auth-worker/src/worker.ts` — all non-2xx endpoints use `safeJson`
- `platform/api-worker/src/{worker,routes/*,middleware/auth}.ts` — all non-2xx endpoints use `safeJson`
- `packages/create-deepspace/templates/starter/worker.ts` — scaffolded apps inherit the pattern

**App side:**
- Apps scaffolded from the starter template get `safeJson` in their `worker.ts` for free
- If you add new routes that can return non-2xx, use `safeJson(c, data, status)` instead of `c.json(data, status)`

## Production impact

**None.** The bug exists only in `@cloudflare/vite-plugin`'s dev middleware. Production deploys use workerd directly without the miniflare-in-Vite dispatch layer. The `safeJson` format travels cleanly end-to-end in both dev and prod, so there's no dev/prod skew to worry about.

## How we debugged this

Preserved from the original investigation (2026-04-07), in case the bug resurfaces differently or someone needs to re-verify:

1. **Hardcoded GET fetch + return 200** — works (rules out outbound fetch)
2. **POST fetch with body + return 200** — works (rules out upstream 401 bleeding through)
3. **Dynamic URL from env + params** — works (rules out URL construction)
4. **Add `resolveAuth` before fetch** — works (rules out JWT verification)
5. **Add `X-Billing-User-Id` header** — works (rules out header forwarding)
6. **Change return to `new Response(data, { status: 401 })`** — **crashes** (status is the variable)
7. **`new Response(data, { status: 200 })`** — works
8. **`new Response(data, { status: 401 })`** — crashes
9. **`c.json(JSON.parse(data), 401)`** — crashes
10. **Hardcoded `c.json({}, 401)` with no fetch** — crashes
11. **Static handler, no outbound fetch, POST + 401** — crashes
12. **Same handler but POST + 200** — works

The isolating test is step 11+12: an empty handler with no side effects. That plus matching the stack trace against `miniflare/src/http/fetch.ts` line 57669 (`options.reset = true`) confirmed the root cause.

## References

- [cloudflare/workers-sdk#13013](https://github.com/cloudflare/workers-sdk/issues/13013) — upstream bug, status: open, assigned
- [cloudflare/workers-sdk#11642](https://github.com/cloudflare/workers-sdk/pull/11642) — the PR that introduced `options.reset = true`
- [cloudflare/workers-sdk#12967](https://github.com/cloudflare/workers-sdk/issues/12967) — related earlier report
- [nodejs/undici#4941](https://github.com/nodejs/undici/pull/4941) — undici-side fix in progress

## Versions where this reproduces

- `@cloudflare/vite-plugin` 1.30.0 through 1.31.2 (tested; likely wider)
- `miniflare` 4.20260317.1 through 4.20260409.0 (broken)
- `miniflare` 4.20251217.0 and earlier — not affected
- `vite` 8.0.x
- Platform: macOS, Linux (confirmed by multiple reporters in the upstream thread)

Last verified: 2026-04-09 — fix not yet released upstream.
