# Resolved: miniflare pin removed (was 4.20251217.0)

## Status

**Resolved** — pin removed 2026-04-20. Upstream fix shipped in `undici@7.24.8` (2026-04-13) and is now bundled into `miniflare@4.20260420.0` and later. Tracking issue [cloudflare/workers-sdk#13013](https://github.com/cloudflare/workers-sdk/issues/13013) closed 2026-04-14.

Kept here as a post-mortem so the next person who trips on a similar miniflare/undici interaction has a paper trail.

## What was pinned (2026-04-10 → 2026-04-20)

`miniflare` was forced to version `4.20251217.0` via package-manager `overrides` in two places:

- **Monorepo root** — `package.json` → `pnpm.overrides.miniflare`
- **Starter template** — `packages/create-deepspace/templates/starter/package.json` → `overrides.miniflare`

`wrangler` and `@cloudflare/vite-plugin` both declared newer miniflare versions as direct deps. The `overrides` block forced both to resolve to the pinned older version at install time, regardless of package manager (npm, pnpm, bun, yarn-berry all honor it).

On 2026-04-20, immediately before we unpinned, we also briefly pinned `@cloudflare/vite-plugin` to `1.31.2` because `1.32.0+` began importing `CorePaths` from miniflare — an API that didn't exist in the pinned `4.20251217.0`. Classic forward-compat drift: hold one dep back long enough and another dep pulls ahead of it. That pin was reverted in the same commit that removed the miniflare override.

## Root cause (diagnosis)

Originally suspected as a miniflare bug because `miniflare@4.20260317.1` ([workers-sdk#11642](https://github.com/cloudflare/workers-sdk/pull/11642)) introduced `options.reset = true` in `DispatchFetchDispatcher.dispatch()`. Under the `@cloudflare/vite-plugin` dev middleware, POST requests that returned non-2xx status codes crashed with `Internal server error: fetch failed` — the response was lost and the client saw a Vite error overlay instead of the real 401/403/etc.

The actual defect was one layer deeper. `options.reset = true` is an undici flag that forcibly resets the underlying socket after the request completes. When workerd responded with a non-2xx *before fully consuming the POST body*, undici treated the "reset-while-request-body-still-open" race as a network error and rejected the fetch promise instead of returning the response. The miniflare line was the trigger; the bug was in undici's lifecycle handling.

Fix landed in [nodejs/undici#4941](https://github.com/nodejs/undici/pull/4941) and was released in `undici@7.24.8` (2026-04-13) / `8.0.3`. Cloudflare bumped miniflare's undici dep and the whole chain resolved without any miniflare source change — the `options.reset = true` line is still there, undici just handles it correctly now.

Verified end-to-end with a scratch project on 2026-04-10:

| miniflare version | POST /401 result |
|---|---|
| 4.20251217.0 (pinned) | real 401 ✅ |
| 4.20260329.0 (pre-fix miniflare + pre-fix undici) | crash with `fetch failed` ❌ |
| 4.20260420.0 (unpinned, undici 7.24.8) | real 401 ✅ |

## Unpinning procedure (for reference — already done)

The sequence we ran on 2026-04-20:

1. Confirmed [#13013](https://github.com/cloudflare/workers-sdk/issues/13013) closed + read through the thread to find that the fix was in undici, not miniflare.
2. Confirmed `npm view miniflare@latest` ships `undici@7.24.8` or newer by pulling the tarball and checking `package/package.json`.
3. Removed the `pnpm.overrides.miniflare` block from the monorepo root `package.json`.
4. Removed the template's `overrides` block and set `@cloudflare/vite-plugin` back to `^1.33.0`.
5. `pnpm install` at the repo root to refresh the lockfile.
6. `pnpm --filter deepspace build`.
7. Ran `npx tsx tests/e2e/scripts/run.ts --deploy` — the deploy step is the real validator because it runs the scaffolded app's `vite build` with the unpinned plugin against the unpinned miniflare. All 37 tests passed (app + auth + cli).

Note: the e2e suite validates *build-time* compatibility (the `CorePaths` import must resolve) but does **not** directly reproduce the runtime POST/non-2xx bug, since e2e hits deployed workers rather than local vite dev. If a similar regression shows up in the future, use the reproduction recipe in [`../gotchas/vite-plugin-non-2xx-crash.md`](../gotchas/vite-plugin-non-2xx-crash.md) to exercise the local dev path.

## Forward-compatibility lesson

Pinning one dep back while leaving another on its caret range (`@cloudflare/vite-plugin: ^1.0.0`) is a slow-motion time bomb. On 2026-04-20 the bomb went off: a newer plugin imported a newer-miniflare-only API and npm install happily resolved into the broken combination. The next time we pin a dep to work around an upstream bug, also pin its consumers — or adopt `pnpm.patchedDependencies` / `patch-package` so we can stay on current minor versions while carrying the fix locally.
