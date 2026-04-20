# Workers for Platforms — observability, cost & traffic gap analysis

**Status:** Open. Written 2026-04-20.

## Context

The DeepSpace platform deploys user apps as scripts inside the Cloudflare
Workers for Platforms (WfP) dispatch namespace `spaces-apps`. The dashboard
(`apps/dashboard`) exposes per-app analytics and a billing page. The intent of
this doc is to compare what Cloudflare actually offers for WfP management
(traffic, cost, analytics, logs, limits) against what we've wired up, and call
out the deltas.

## What Cloudflare exposes for WfP platforms

### 1. GraphQL Analytics API — `workersInvocationsAdaptive`
Per-script metrics, filterable by `dispatchNamespaceName` + `scriptName`:
- `sum { requests, errors, subrequests, responseBodySize }`
- `quantiles { cpuTimeP50, cpuTimeP99, wallTimeP50, wallTimeP99, durationP50, durationP99 }`
- `dimensions { datetime, datetimeHour, status, scriptName, dispatchNamespaceName, usageModel }`
- Retention: 1-month windows, up to 3 months back.
- Invocation `status` values: `success`, `clientDisconnected`, `scriptThrewException`, `exceededResources`, `internalError`.

### 2. Workers Analytics Engine (custom high-cardinality events)
Binding + `writeDataPoint({ blobs, doubles, indexes })`. Query with the SQL API
or GraphQL. Intended for per-customer analytics, usage-based billing, and any
custom event the GraphQL API doesn't cover. Writes are non-blocking.

### 3. Workers Logs (built-in structured logs)
`observability.enabled = true` in wrangler. Up to 7-day retention, 5B
logs/account/day, queryable in the CF dashboard. Free tier is 20M logs/month.
Supports head-based sampling.

### 4. Tail Workers (`tail_consumers`)
A Worker that receives every producer Worker's invocation events (request,
response, `console.log`, exceptions, diagnostics). When attached to the
**dispatch worker**, events are collected for both the dispatcher *and every
user Worker in the namespace* — zero config per user Worker.

### 5. Logpush (raw trace events)
Ships `workers_trace_events` to R2/S3/Datadog/Splunk/etc. Can be enabled
per-namespace (via dispatcher) or per-script. Requires `logpush: true` in the
script metadata.

### 6. Custom limits (per-invocation, per-plan)
Passed in the third arg of `env.DISPATCHER.get(name, args, { limits: { cpuMs, subRequests } })`.
The only defense against denial-of-wallet from runaway user code. Enforced
by the runtime — exceeded limits throw `Exceeded CPU`.

### 7. Outbound Workers
Optional worker in the dispatch binding's `outbound` config. Intercepts every
`fetch()` a user Worker makes to the public internet. Used for egress
allow/block, per-customer API-key injection, and subrequest logging.

### 8. Tags
Up to 8 per script. Native WfP primitive for plan type, environment, customer
ID, etc. Supports bulk list-by-tag and delete-by-tag via the REST API.

### 9. Pricing model (what the bill actually depends on)
- **Requests** — 20M free, +$0.30/M (one request across dispatch→user→outbound chain).
- **CPU time** — 60M ms free, +$0.02/M ms. Max 30s/invocation.
- **Scripts** — 1,000 free, +$0.02/extra.
- **Workers Logs** — 20M logs/month free, +$0.60/M (billing started 2025-04-21).
- **Logpush** — separate per-GB egress pricing at the destination.
- **Subscription** — $25/mo flat for WfP Paid.

---

## What we currently have

### Runtime / deployment (`platform/deploy-worker`)
- Deploys scripts into the `spaces-apps` namespace via the multipart upload flow.
- Sets exactly **one** tag per script: `user-{ownerUserId}`.
- Injects bindings: `ASSETS`, `PLATFORM_WORKER` (service), `API_WORKER` (service), app identity vars, `APP_OWNER_JWT`, HMAC secret.
- No `observability` block in deployed-script metadata.
- No `logpush: true` flag.
- No `tail_consumers` on deployed scripts.
- No `analytics_engine_datasets` binding.

### Dispatch layer
- `CONTEXT.md`, `scripts/setup-env.sh`, and `.github/workflows/ci.yml` all reference `platform/dispatch-worker`, but **the directory does not exist on disk**. Traffic routing to `*.app.space` is presumably happening via a deployed dispatch worker whose source is not in the repo, or via WfP hostname routing that isn't documented here.
- Because the dispatch-worker source is missing, we cannot enforce `limits: { cpuMs, subRequests }` per plan, run platform auth before user code, or attach a Tail Worker at the dispatch layer.

### Dashboard analytics (`apps/dashboard` + `platform/deploy-worker/src/routes/apps.ts`)
- `GET /api/apps/:appName/analytics` runs one GraphQL query against `workersInvocationsAdaptive` filtered by `dispatchNamespaceName: "spaces-apps"` + `scriptName`.
- Selects: `sum { requests, errors, subrequests }`, `quantiles { cpuTimeP50, cpuTimeP99 }`, `dimensions { datetime, status }`.
- UI shows: totals (requests, errors, subrequests), CPU p50/p99, and a requests+errors area chart.
- Period selector: 1h / 6h / 24h / 7d / 30d.
- No per-account aggregation (no "all my apps combined" view).
- `status` is in the query dimensions but never surfaced to the UI.

### Billing page
- Entirely LLM/integration-credit based (`integrationUsage` D1 table, per-endpoint costs, 30% markup, 100 credits = $1).
- **No linkage to Cloudflare compute** — the bill the user sees reflects LLM/Stripe/etc. API spend, not WfP request/CPU/script spend. If a user's deployed app bursts to a billion CPU ms, our UI shows nothing.
- Stripe subscription tiers (free/starter/premium) gate credits but are not wired to any WfP-level enforcement (no custom limits per tier).

---

## Gaps

### A. Observability data we don't collect

| # | Gap | Impact |
|---|---|---|
| A1 | No `observability.enabled` on deployed user Workers | No queryable structured logs per app. Dashboard has no way to show "last 10 errors" or `console.log` output. |
| A2 | No Tail Worker on dispatcher or on deployed Workers | Can't react to invocations in real time (alerting, aggregated metrics, exception forwarding). |
| A3 | No Logpush job for `workers_trace_events` | Can't archive or forward logs to Datadog/Grafana/R2. Required for any retention past the Workers Logs 7-day window. |
| A4 | No Analytics Engine dataset | Can't record custom events (per-user, per-plan, per-feature). Nothing to power usage-based billing or per-customer quotas. |
| A5 | No outbound Worker | Zero visibility into or control over user Workers' subrequests. Users can fetch arbitrary external services; we can't log, block, or inject auth. |
| A6 | Dispatcher source missing from repo | Prevents adding any of A2/A5 at the namespace level. Routing logic is invisible to reviewers. |

### B. GraphQL query coverage (what we fetch but don't show — or don't fetch at all)

| # | Gap | Impact |
|---|---|---|
| B1 | `status` dimension is fetched but dropped | No invocation-status breakdown (success vs clientDisconnected vs scriptThrewException vs exceededResources vs internalError). The single "errors" number hides the real failure mode. |
| B2 | `wallTimeP50/P99` and `durationP50/P99` not queried | CPU time is only part of the picture. Wall-time quantiles matter for I/O-heavy apps; duration is what drives GB-s billing. |
| B3 | `responseBodySize` not queried | No bandwidth/egress visibility. |
| B4 | No 30-day account-level aggregation in the billing page | User can't see total WfP spend across all their apps without clicking each one. |
| B5 | No cross-app rollup to estimate CF bill | We have the raw numbers but don't compute the actual $ cost (CPU ms × $0.02/M + requests × $0.30/M + script count × $0.02). |
| B6 | No HTTP status code breakdown (2xx/4xx/5xx) | Different signal than invocation status — useful for API apps. Available via `httpRequestsAdaptiveGroups` (zone-scoped) but not queried. |
| B7 | Dashboard refetches on every page visit, no cache | GraphQL quota burn on high-traffic dashboard. CF imposes rate limits on the GraphQL API. |
| B8 | Sampling is not handled | For high-volume scripts CF returns sampled rows; we treat counts as exact. Need `_sample_interval`-weighted aggregation. |
| B9 | The `30d` period sits at the edge of the allowed 1-month query window | Edge cases near the boundary can return partial data or errors. |

### C. Cost control & denial-of-wallet

| # | Gap | Impact |
|---|---|---|
| C1 | No `limits: { cpuMs, subRequests }` passed in `DISPATCHER.get()` | A single runaway user Worker can burn 30s × $0.02/M-ms per request × 20M+ requests. No per-plan cap. |
| C2 | No per-tier limit policy (free/starter/premium → cpuMs) | Billing tiers exist but aren't translated into runtime caps. |
| C3 | No script-count alarm as we approach the 1,000-script WfP allotment | Silent $0.02/script overage once we cross. |
| C4 | No daily/monthly cost ceiling per user | Nothing to trigger a halt at, say, $10 CF spend on a free-tier account. |
| C5 | Billing page conflates credits (LLM) with "costs" | The actual CF bill we pay per user is invisible in the UI; users can't self-diagnose "why is my app expensive?". |

### D. Tags & organization

| # | Gap | Impact |
|---|---|---|
| D1 | Only one tag per deploy (`user-{id}`) | Can't filter or bulk-delete by plan, environment (staging vs prod), feature flag, app template, etc. |
| D2 | No tag for environment | Staging vs production deploys are indistinguishable at the platform level. |
| D3 | No tag for plan tier | Can't rebalance limits or evict free-tier deploys without joining against our own DB. |

### E. Dashboard UX

| # | Gap | Impact |
|---|---|---|
| E1 | No real-time / tail view | No equivalent of `wrangler tail` for end users. |
| E2 | No exception detail view | Errors count is shown but not the actual exception name/message/stack. |
| E3 | No cron trigger observability | `CRON_TASKS` KV drives scheduled runs; nothing reports whether they ran, succeeded, or how long they took. |
| E4 | No custom-limit UI | Enterprise/pro features (higher CPU, more subrequests) exist as a WfP primitive but not in our product. |
| E5 | No invocation-status pie/bar | Cloudflare's own Workers dashboard shows this; we drop it. |
| E6 | No "apps overview" analytics on `AppsPage` | Cards are static. Would be a single `workersInvocationsAdaptive` query grouped by `scriptName`. |

### F. Related resource accounting

| # | Gap | Impact |
|---|---|---|
| F1 | No R2 storage accounting per app | `APP_FILES` bucket is shared; we don't report or cap per-user bytes. |
| F2 | No DO storage accounting per app | `GlobalRecordRoom` SQLite DOs grow per scope; no visibility on rows/bytes per user. |
| F3 | No D1 read/write tracking per user | D1 has per-query accounting via GraphQL but we don't query it. |

---

## Recommendations, in rough priority order

1. **Restore the dispatch worker source into the repo.** Everything else in this list either lives in it or benefits from it being reviewable. The fact that `scripts/setup-env.sh` and CI reference `platform/dispatch-worker` but the directory is missing is itself a known-issue worth resolving separately.

2. **Enable Workers Logs on every deployed user Worker.** Add `"observability": { "enabled": true, "head_sampling_rate": 1 }` to the metadata in `cloudflare-deploy.ts`. Zero code, gives the dashboard a future path to log view.

3. **Attach a Tail Worker to the dispatch worker.** One Worker, one `tail()` handler, writes aggregated counts to Analytics Engine. Gets us per-script invocation counts, exception totals, and customer-usage data without per-script wiring.

4. **Provision an Analytics Engine dataset** and `writeDataPoint` from the Tail Worker (or directly from the dispatcher) keyed by `ownerUserId`, `appName`, `planTier`, `outcome`. This unlocks the billing-page account rollup (B4/B5) and per-user caps (C4).

5. **Pass custom limits in `DISPATCHER.get()`** based on the plan tier looked up from the API worker's D1 (`userProfiles.subscriptionTier`). Closes C1/C2 before we get a denial-of-wallet incident.

6. **Extend the GraphQL query** to include `wallTimeP50/P99`, `duration`, `responseBodySize`, and the `status` dimension (B1–B3). Surface an invocation-status breakdown card and an estimated CF cost number.

7. **Tag deploys with plan, environment, and app-template** (D1–D3). Free, purely at deploy time, pays off the first time we need to bulk-evict.

8. **Cache the analytics response** in the deploy worker (KV, 60s TTL per app+period) to stop burning GraphQL quota on refresh (B7).

9. **Add Logpush** to R2 once Workers Logs alone isn't enough (long-retention, alerting).

10. **Outbound Worker** when we're ready to do egress control / per-customer API-key injection — lower priority, but unlocks a large product surface.

## Not-gaps (things we intentionally don't do)

- **Per-customer namespace** — CF explicitly recommends against it ("all your customers' Workers should live in a single namespace"). `spaces-apps` is correct.
- **Gradual Deployments / versioned rollouts on user Workers** — unsupported by WfP (user Workers deploy all-at-once to 100%). Not a gap; a limit.
- **`request.cf` in user code** — disabled by WfP for isolation; trusted mode would break tenant separation. Correct default.
