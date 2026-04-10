# Cloudflare Vite Plugin: Non-2xx POST Response Crash

## TL;DR

During local dev, if a worker route returns a non-2xx status code for a `POST` request, `@cloudflare/vite-plugin`'s dev middleware crashes with `Internal server error: fetch failed` and shows the Vite error overlay. The bug is in `miniflare@4.20260317.1` and later. `miniflare@4.20251217.0` and earlier are unaffected.

**Our fix: pin miniflare to `4.20251217.0` via package-manager `overrides`.** Both the monorepo root and the `create-deepspace` starter template force the dependency-graph resolution of `miniflare` to the last known-good version. `npm`, `pnpm`, `bun`, and `yarn` all honor root-level `overrides`, so scaffolded apps work with any package manager without postinstall hooks or patches.

**Upstream issue:** [cloudflare/workers-sdk#13013](https://github.com/cloudflare/workers-sdk/issues/13013). When fixed and released, bump miniflare and delete the override.

---

## Symptoms

Vite dev server logs the moment a POST + non-2xx response happens:

```
[vite] Internal server error: fetch failed
    at Object.processResponse (node_modules/undici/lib/web/fetch/index.js:237:16)
    at node_modules/undici/lib/web/fetch/index.js:1081:19
    at async fetch4 (node_modules/miniflare/dist/src/index.js:...)
    at async _Miniflare.dispatchFetch (node_modules/miniflare/dist/src/index.js:...)
    at async node_modules/@cloudflare/vite-plugin/dist/index.mjs:...
```

Client receives HTTP 500 with an HTML error overlay page instead of the intended 401 / 403 / 404 / 500.

## What triggers it

| Method | Status | Result |
|--------|--------|--------|
| GET    | any    | ✅ works |
| POST   | 2xx    | ✅ works |
| POST   | 4xx/5xx| ❌ crashes (broken miniflare only) |

## Root cause

`DispatchFetchDispatcher.dispatch()` in broken miniflare versions sets `options.reset = true` before handing the request to undici. That flag tells undici to forcibly close the TCP socket with a RST after the response. On `POST` + non-2xx, the worker often rejects early (`if (!session) return c.json(..., 401)`) without consuming the request body. When the socket reset races the unconsumed body, undici's `processResponse` throws a generic `fetch failed`. The error surfaces inside `@cloudflare/vite-plugin`'s `createRequestHandler`, which passes it to `next(error)` and produces the Vite overlay.

`options.reset = true` was added in [cloudflare/workers-sdk#11642](https://github.com/cloudflare/workers-sdk/pull/11642) ("Improve miniflare test stability") to prevent keep-alive pooling during tests. The intent was fine; the side effect races the POST body consumption.

GET requests have no body so there's nothing for the reset to race against. POST + 2xx works because workerd usually reads the body on the success path.

JS error handlers don't catch this because the failing `fetch` is miniflare's internal call from Node.js to workerd (not the worker's own outbound `fetch`), it happens in a microtask after the worker handler returned, and the error path is `undici.processResponse → fetch4 → dispatchFetch → Vite plugin` with zero frames from worker code. `app.onError`, `try/catch`, wrapping the Hono default export — none of it intercepts the error.

## The fix

Pin `miniflare` to `4.20251217.0` (the last release before PR #11642 shipped). Verified via `tar xzf miniflare-4.20251217.0.tgz && grep "options.reset = true" package/dist/src/index.js` — the line does not exist in that version.

### Monorepo root — `package.json`

```json
{
  "pnpm": {
    "overrides": {
      "miniflare": "4.20251217.0"
    }
  }
}
```

### Starter template — `packages/create-deepspace/templates/starter/package.json`

```json
{
  "overrides": {
    "miniflare": "4.20251217.0"
  }
}
```

The starter template uses the plain `overrides` field (not `pnpm.overrides`) so it works with whatever package manager the user runs — npm, pnpm, bun, and yarn-berry all respect root-level `overrides`.

## Compatibility verification

`wrangler@4.79.0` declares `miniflare: 4.20260329.0` as an exact dep, and `@cloudflare/vite-plugin@1.31.2` declares `miniflare: 4.20260409.0`. Both get forced to `4.20251217.0` by the override. Smoke-tested in a scratch project:

```bash
mkdir wrangler-pin-test && cd wrangler-pin-test
cat > package.json <<'EOF'
{
  "devDependencies": {
    "wrangler": "4.79.0",
    "@cloudflare/vite-plugin": "1.31.2"
  },
  "overrides": {
    "miniflare": "4.20251217.0"
  }
}
EOF
npm install
npx wrangler --version   # 4.79.0, clean exit
npx wrangler dev         # starts, serves requests, no miniflare API errors
```

No runtime errors. Wrangler boots against the old miniflare. `DispatchFetchDispatcher` and the rest of the public surface area are unchanged in this version window.

## When to revisit

Monitor [cloudflare/workers-sdk#13013](https://github.com/cloudflare/workers-sdk/issues/13013). When the fix lands and a new miniflare/wrangler/vite-plugin release rolls out:

1. Bump `wrangler` / `@cloudflare/vite-plugin` in the monorepo and starter template
2. Remove the `overrides` block from both `package.json` files
3. Delete this gotcha doc

If wrangler starts requiring a miniflare API that doesn't exist in `4.20251217.0` before the upstream fix lands, we'll need to switch to either `patch-package` (universal, needs a postinstall hook) or `pnpm.patchedDependencies` (pnpm-only but no postinstall). `patch-package` is the documented fallback.

## References

- [cloudflare/workers-sdk#13013](https://github.com/cloudflare/workers-sdk/issues/13013) — upstream bug, status: open
- [cloudflare/workers-sdk#11642](https://github.com/cloudflare/workers-sdk/pull/11642) — PR that introduced `options.reset = true`
- [nodejs/undici#4941](https://github.com/nodejs/undici/pull/4941) — undici-side fix in progress
