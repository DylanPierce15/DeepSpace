# Cloudflare Vite Plugin Gotchas

## POST + non-2xx response crashes dev server

The Cloudflare Vite plugin crashes with `fetch failed` when a worker route returns any non-2xx status for a POST request. GET works, POST + 2xx works, POST + non-2xx does not.

Root cause: miniflare's `options.reset = true` in the plugin's request handler (upstream issue: [cloudflare/workers-sdk#13013](https://github.com/cloudflare/workers-sdk/issues/13013)).

**Fix:** patched locally via `patches/miniflare*.patch` (pnpm patch). Worker code uses normal `c.json(data, status)` — no workaround needed in application code.
