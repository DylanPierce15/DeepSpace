# Dispatch worker is ported but not deployed — prod still runs Miyagi's build

**Status:** Open. Written 2026-04-20.

## Summary

`platform/dispatch-worker/` exists in this repo again as of 2026-04-20, ported
from `~/GitHub/Miyagi3/apps/miniapp-sync/dispatch/`. It has not been deployed.
Production traffic for `*.app.space` is still served by the Miyagi-sourced
`spaces-dispatch` Worker last pushed to the shared CF account
(`47bdce30e4337b94e234ac9b31aee19f`) on 2026-03-19. Cloudflare Routes still
point at that worker name; our port uses the same name, so when we deploy it
will replace the Miyagi build in place with no route cutover needed.

## What the port preserves

The ported worker is a line-for-line copy of Miyagi's dispatcher with four
deliberate edits (all verified by an explicit diff pass):

1. `@miyagi/shared-utils` → local `./reservedSubdomains` (identical content).
2. `@miyagi/auth` → `deepspace/worker` (identical HMAC helpers — re-verified).
3. `handleWidgetScreenshot` + `/internal/widget-screenshot` deleted
   (Clerk-specific; DeepSpace doesn't use it).
4. `cronKeyToAppName()` added so the cron loop reads both `{appName}` (Miyagi
   format) and `cron:{appName}` (DeepSpace deploy-worker format). Backward
   compatible with everything Miyagi has written.

Bindings, KV IDs, R2 bucket, Analytics Engine dataset, browser binding,
`compatibility_date`, and cron schedule are all preserved exactly.

Type-check and `wrangler deploy --dry-run` both pass.

## Why we paused before deploying

- The existing worker is running other people's traffic. Want the cutover to
  be deliberate, ideally alongside a secret re-sync (see below).
- Once deployed, any remaining caller of `/internal/widget-screenshot` will
  start getting 404s. The only known caller is Miyagi's own canvas-sync at
  `~/GitHub/Miyagi3/apps/api/src/routes/canvas/widget-templates.ts:955-960`,
  which is acceptable — Miyagi is not a live DeepSpace concern — but worth
  knowing before the button gets pushed.

## Consequences of not deploying yet

### 1. Cron is broken for every DeepSpace app

The running Miyagi dispatcher iterates `CRON_TASKS.list()` and treats
`key.name` as the app name directly. DeepSpace's deploy-worker writes keys
prefixed `cron:{appName}` (`platform/deploy-worker/src/routes/deploy.ts:184`).
When the Miyagi dispatcher pulls a DeepSpace-written key, it calls
`env.USER_APPS.get("cron:foo")` — which has no such script, so every fire
404s silently.

Miyagi apps continue working because Miyagi's deployer wrote bare
`{appName}` keys.

This bug has been latent since DeepSpace deploy-worker started writing cron
configs. It's latent-not-blocking because we haven't tested cron on a
DeepSpace app yet. It clears automatically the moment the ported dispatcher
deploys — `cronKeyToAppName()` handles both formats.

### 2. Any improvement we want at the dispatch layer is stalled

Attaching a Tail Worker, setting per-plan `limits: { cpuMs, subRequests }`,
adding platform-level auth before user code runs — all of those require the
dispatcher source to be ours. They're queued behind this deploy. See
`wfp-observability-gaps.md` §A6, §C1.

### 3. Drift risk grows

Every day we run Miyagi's build without owning the source is a day
production could quietly diverge from what the repo claims. If someone
`wrangler deploy`s from Miyagi, our repo is stale without any signal.

## Deploy checklist (for whenever we do it)

1. `./scripts/setup-env.sh` — resyncs `INTERNAL_STORAGE_HMAC_SECRET` into
   `platform/dispatch-worker/.dev.vars` from Doppler.
2. Verify the dispatcher secret matches Doppler:
   ```
   cd platform/dispatch-worker
   pnpm wrangler secret put INTERNAL_STORAGE_HMAC_SECRET
   # paste value from Doppler
   ```
   Why: Cloudflare preserves secrets across redeploys, but the running
   worker's existing `INTERNAL_STORAGE_HMAC_SECRET` was set by Miyagi at
   some unknown point. `deploy-worker` bakes Doppler's current value into
   every new user app, so the two have to match or cron HMAC verification
   fails with `403 Invalid signature` on the user-worker side.
3. `pnpm --filter @deepspace/dispatch-worker deploy`.
4. Tail the new worker's logs for a couple of cron cycles (`* * * * *` means
   <60s) to confirm cron fires resolve against real user workers, not
   `cron:*` ghost names.
5. Test with a live DeepSpace app that registers a cron task and verify it
   runs.

## Related

- `wfp-observability-gaps.md` — broader WfP capability gap analysis; most
  of the entries in §A/§C are blocked on having our own dispatcher source.
- `docs/old/AUDIT-PROMPT.md` — still lists the dispatch worker as "built
  and working"; that line was always technically referring to the Miyagi
  deployment, not our source.
