# Known Issue: miniflare pinned to 4.20251217.0

## Status

**Active** — pin in place since 2026-04-10. Waiting for upstream fix in [cloudflare/workers-sdk#13013](https://github.com/cloudflare/workers-sdk/issues/13013).

## What's pinned

`miniflare` is forced to version `4.20251217.0` in two places via package-manager `overrides`:

- **Monorepo root** — `package.json` → `pnpm.overrides.miniflare`
- **Starter template** — `packages/create-deepspace/templates/starter/package.json` → `overrides.miniflare`

`wrangler@4.79.0` declares `miniflare@4.20260329.0` as a direct dep and `@cloudflare/vite-plugin@1.31.2` declares `miniflare@4.20260409.0`. The `overrides` block forces both to resolve to the pinned older version at install time, regardless of package manager (npm, pnpm, bun, yarn-berry all honor it).

## Why

`miniflare@4.20260317.1` (via [workers-sdk#11642](https://github.com/cloudflare/workers-sdk/pull/11642)) added `options.reset = true` in `DispatchFetchDispatcher.dispatch()`. Under the `@cloudflare/vite-plugin` dev middleware, this causes POST requests that return non-2xx status codes to crash with `Internal server error: fetch failed` — the response is lost and the client sees a Vite error overlay instead of the real 401/403/etc.

Full technical breakdown and reproduction in [`../gotchas/vite-plugin-non-2xx-crash.md`](../gotchas/vite-plugin-non-2xx-crash.md).

Verified end-to-end with a scratch project on 2026-04-10:

| miniflare version | POST /401 result |
|---|---|
| 4.20251217.0 (pinned) | real 401 ✅ |
| 4.20260329.0 (broken) | crash with `fetch failed` stack trace ❌ |

## How to unpin (when the upstream fix ships)

Before unpinning, check these two places to see if the fix has landed:

1. [cloudflare/workers-sdk#13013](https://github.com/cloudflare/workers-sdk/issues/13013) — should be closed as merged
2. Grep the latest `miniflare` release's `dist/src/index.js` for `options.reset = true`:
   ```bash
   cd /tmp && mkdir mf-check && cd mf-check && npm pack miniflare@latest
   tar -xzf miniflare-*.tgz
   grep -n "options\.reset" package/dist/src/index.js
   ```
   If the grep returns no hits inside `DispatchFetchDispatcher.dispatch`, the fix is released.

Once confirmed:

1. **Remove the pin from the monorepo root `package.json`:**
   ```diff
   - "pnpm": {
   -   "overrides": {
   -     "miniflare": "4.20251217.0"
   -   }
   - }
   ```
   If you also need to remove `pnpm.patchedDependencies` for a different pin, check that too.

2. **Remove the pin from `packages/create-deepspace/templates/starter/package.json`:**
   ```diff
   - "overrides": {
   -   "miniflare": "4.20251217.0"
   - }
   ```

3. **Run `pnpm install` at the monorepo root** to update the lockfile.

4. **Rebuild and test:**
   ```bash
   npx tsx tests/e2e/scripts/steps/build.ts
   npx tsx tests/e2e/scripts/steps/scaffold.ts
   # ...
   ```
   Then run the vite-plugin bug reproduction (see the gotcha doc's "Compatibility verification" section) to confirm the upstream fix actually works without our override.

5. **Delete `docs/gotchas/vite-plugin-non-2xx-crash.md`** — it's only relevant while the bug is live.

6. **Delete this file.**

## Forward-compatibility risk

Pinning to an old `miniflare` means if `wrangler` or `@cloudflare/vite-plugin` bumps to require an API that only exists in newer miniflare versions, our pin will break their runtime behavior. Today (2026-04-10) this is not a problem — `wrangler dev` and `@cloudflare/vite-plugin` both boot cleanly against `4.20251217.0` in smoke tests. If wrangler bumps past some miniflare compatibility barrier before the upstream fix lands, the fallback is:

1. Switch to `patch-package` — universal across package managers, requires a `postinstall` script
2. Switch to `pnpm.patchedDependencies` — pnpm-only but no postinstall required
3. Hand-maintain a forked miniflare — maintenance hell, avoid

Both patch approaches let us track newer miniflare versions while still removing the `options.reset = true` line.

## Owner

Whoever is on deps/dev-infra duty when [#13013](https://github.com/cloudflare/workers-sdk/issues/13013) closes.
