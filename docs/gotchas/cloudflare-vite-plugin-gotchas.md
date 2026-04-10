# Cloudflare Vite Plugin Gotchas

## POST + non-2xx response crashes dev server

The Cloudflare Vite plugin crashes with `fetch failed` when a worker route returns any non-2xx status for a POST request. GET works, POST + 2xx works, POST + non-2xx does not.

**See [vite-plugin-non-2xx-crash.md](./vite-plugin-non-2xx-crash.md) for the full story**, including the root cause (miniflare's `options.reset = true`), the upstream issue ([cloudflare/workers-sdk#13013](https://github.com/cloudflare/workers-sdk/issues/13013)), and the `safeJson` solution we use across the SDK.

**Short version:** use `safeJson(c, data, status)` from `deepspace/worker` instead of `c.json(data, status)` for any response with a non-2xx status. The wire format is always HTTP 200 with the real status in `body.status`. Clients use `parseSafeResponse` from `deepspace` to read the real status.

## Previous (incorrect) theory

An earlier version of this doc claimed unhandled `fetch()` errors inside worker routes caused the crash, and recommended wrapping every outbound fetch in try/catch. That turned out to be wrong — the bug triggers even with no outbound fetch, even with a static handler that just returns `c.json({}, 401)`. Wrapping fetches is still good hygiene, but it's unrelated to this bug. The file is kept as a pointer so anyone searching for old symptoms lands here and reads the correct explanation.
