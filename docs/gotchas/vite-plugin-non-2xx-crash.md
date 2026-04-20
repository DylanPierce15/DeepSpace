# Cloudflare Vite Plugin: Non-2xx POST Response Crash (Resolved)

## TL;DR

**Resolved as of 2026-04-20** by updating to `miniflare@4.20260420.0`+, which bundles `undici@7.24.8`+. The pin we carried from 2026-04-10 has been removed from both the monorepo root and the `create-deepspace` starter template.

Original bug: during local dev, if a worker route returned a non-2xx status for a `POST`, `@cloudflare/vite-plugin`'s dev middleware crashed with `Internal server error: fetch failed` and showed the Vite error overlay. Triggered by `miniflare@4.20260317.1` onward; `miniflare@4.20251217.0` and earlier were unaffected.

**Upstream issue:** [cloudflare/workers-sdk#13013](https://github.com/cloudflare/workers-sdk/issues/13013) — closed 2026-04-14. Actual fix in [nodejs/undici#4941](https://github.com/nodejs/undici/pull/4941), released in `undici@7.24.8`.

The doc is kept as a post-mortem reference. If a similar "fetch failed in vite dev middleware" symptom reappears, start here.

---

## Symptoms (historical)

Vite dev server logs the moment a POST + non-2xx response happens:

```
[vite] Internal server error: fetch failed
    at Object.processResponse (node_modules/undici/lib/web/fetch/index.js:237:16)
    at node_modules/undici/lib/web/fetch/index.js:1081:19
    at async fetch4 (node_modules/miniflare/dist/src/index.js:...)
    at async _Miniflare.dispatchFetch (node_modules/miniflare/dist/src/index.js:...)
    at async node_modules/@cloudflare/vite-plugin/dist/index.mjs:...
```

Client received HTTP 500 with an HTML error overlay page instead of the intended 401 / 403 / 404 / 500.

## What triggered it

| Method | Status | Result |
|--------|--------|--------|
| GET    | any    | ✅ works |
| POST   | 2xx    | ✅ works |
| POST   | 4xx/5xx| ❌ crashes (broken miniflare + pre-fix undici only) |

## Root cause

`DispatchFetchDispatcher.dispatch()` in newer miniflare versions sets `options.reset = true` before handing the request to undici. That flag tells undici to forcibly close the TCP socket with a RST after the response. On `POST` + non-2xx, the worker often rejects early (`if (!session) return c.json(..., 401)`) without consuming the request body. When the socket reset raced the unconsumed body, undici's `processResponse` threw a generic `fetch failed`. The error surfaced inside `@cloudflare/vite-plugin`'s `createRequestHandler`, which passed it to `next(error)` and produced the Vite overlay.

`options.reset = true` was added in [cloudflare/workers-sdk#11642](https://github.com/cloudflare/workers-sdk/pull/11642) ("Improve miniflare test stability") to prevent keep-alive pooling during tests. The intent was fine; the side effect raced POST body consumption.

GET requests have no body so there was nothing for the reset to race against. POST + 2xx worked because workerd usually reads the body on the success path.

JS error handlers didn't catch this because the failing `fetch` was miniflare's internal call from Node.js to workerd (not the worker's own outbound `fetch`), it happened in a microtask after the worker handler returned, and the error path was `undici.processResponse → fetch4 → dispatchFetch → Vite plugin` with zero frames from worker code. `app.onError`, `try/catch`, wrapping the Hono default export — none of it intercepted the error.

## The fix (resolved upstream)

The line `options.reset = true` is still present in miniflare — the fix was in **undici**, one layer down. [nodejs/undici#4941](https://github.com/nodejs/undici/pull/4941) taught undici to handle the reset-while-request-body-open race as a normal response close instead of a network error. Released in `undici@7.24.8` (2026-04-13) and `@8.0.3`, then pulled into `miniflare@4.20260420.0`'s `dependencies.undici`.

We removed the pin on 2026-04-20. The starter template now takes `@cloudflare/vite-plugin: ^1.33.0` without overrides, and the monorepo root no longer has a `pnpm.overrides.miniflare` block.

## Compatibility verification (post-unpin)

Validated 2026-04-20 via the full e2e suite — scaffolds a fresh app, deploys it to `*.app.space` (which runs the scaffolded app's `vite build` under the unpinned `@cloudflare/vite-plugin`), and runs 37 Playwright tests against it. Full pass, exit code 0.

```bash
npx tsx tests/e2e/scripts/run.ts --deploy
# → 37 passed
```

Note: the e2e suite proves *build-time* compatibility but not *runtime* reproduction of the original crash — it tests deployed workers, not local vite dev. If you want to exercise the exact reproduction path again:

```bash
# In a scratch scaffolded app:
npx deepspace dev
curl -X POST http://localhost:5173/api/auth/ok -d '{}'
# Before the fix: Vite overlay with "fetch failed"
# After the fix: a real 401 (or whatever the handler returns)
```

## Lessons

1. **Pin transitively, or don't pin.** We pinned `miniflare` but left `@cloudflare/vite-plugin: ^1.0.0` open. Ten days later, vite-plugin `1.32.0` started importing `CorePaths` from a newer miniflare API and npm install happily resolved into the incompatible combination. Next time: pin the consumers too, or use `patch-package` / `pnpm.patchedDependencies` so we can stay on current minor versions while carrying the fix locally.
2. **Dig one layer deeper.** This looked like a miniflare bug; the PR number, the stack trace, and the introduction of `options.reset = true` all pointed at miniflare. The actual fix was in undici, two dependencies down. When a fix seems "stuck" upstream, trace the call chain past the first obvious culprit.

## References

- [cloudflare/workers-sdk#13013](https://github.com/cloudflare/workers-sdk/issues/13013) — upstream bug, closed 2026-04-14
- [cloudflare/workers-sdk#11642](https://github.com/cloudflare/workers-sdk/pull/11642) — PR that introduced `options.reset = true`
- [nodejs/undici#4941](https://github.com/nodejs/undici/pull/4941) — the real fix, in undici
- Companion post-mortem: [`../known-issues/miniflare-pin.md`](../known-issues/miniflare-pin.md)
