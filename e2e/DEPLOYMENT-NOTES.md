# E2E Deployment Notes

Issues encountered and resolved while deploying the DeepSpace SDK platform workers and setting up the E2E test pipeline.

## 1. Workers for Platforms: `wrangler deploy` vs REST API

**Problem:** `wrangler deploy --dispatch-namespace spaces-apps` deploys user scripts into the WfP namespace, but the script is not visible to the Cloudflare REST API's list/delete endpoints. The REST API `DELETE` returns `10007: This Worker does not exist on your account` even though the script is actively serving.

**Root cause:** Wrangler v3's `--dispatch-namespace` flag registers the script through a different internal path than the REST API's `PUT /workers/dispatch/namespaces/{ns}/scripts/{name}`. The two methods are not interoperable for delete operations.

**Fix:** Deploy and delete user scripts exclusively via the Cloudflare REST API (the same method Miyagi3's `miniapp-deployer` uses). The E2E setup/teardown uses `PUT` and `DELETE` on `/accounts/{id}/workers/dispatch/namespaces/{ns}/scripts/{name}` with multipart form upload.

**Note:** `wrangler delete` does not have a `--dispatch-namespace` flag at all — it can only delete standalone workers.

## 2. Better Auth D1 adapter: `{ type: 'd1', d1: db }` doesn't work

**Problem:** `createDeepSpaceAuth()` in `packages/auth/src/betterAuth.ts` passed the D1 database as `database: { type: 'd1', d1: config.database }`. Better Auth's Kysely adapter initialization failed with `BetterAuthError: Failed to initialize database adapter`.

**Root cause:** Better Auth auto-detects D1 by checking for `batch`, `exec`, and `prepare` methods directly on the `database` object (line 67 of `@better-auth/kysely-adapter`). The `{ type: 'd1', d1: ... }` wrapper object doesn't have those methods.

**Fix:** Pass the D1 binding directly: `database: config.database`. Better Auth's duck-typing detection finds the D1 methods and initializes the D1 SQLite dialect correctly.

## 3. Better Auth `baseURL` must include `/api/auth` path

**Problem:** Setting `AUTH_BASE_URL` to `https://deepspace-auth.eudaimonicincorporated.workers.dev` caused Better Auth to register routes at the root path (`/`) instead of under `/api/auth/`.

**Root cause:** Better Auth extracts `basePath` from `new URL(baseURL).pathname`. With a plain origin URL, pathname is `/`, so Better Auth's internal routes (e.g., `/sign-up/email`) are mounted at `/sign-up/email` — but the Hono catch-all passes requests with the full `/api/auth/sign-up/email` path, which doesn't match.

**Fix:** Set `AUTH_BASE_URL` to `https://deepspace-auth.eudaimonicincorporated.workers.dev/api/auth`. Now `basePath = /api/auth`, and `normalizePathname` correctly strips the prefix before matching against Better Auth's internal routes.

## 4. Hono route ordering: `/api/auth/token` vs `/api/auth/*` catch-all

**Problem:** The custom JWT token endpoint at `POST /api/auth/token` was defined AFTER the Better Auth catch-all at `/api/auth/*`. Hono matched the catch-all first, sending the request to Better Auth which returned 404 (not a Better Auth endpoint).

**Fix:** Move `app.post('/api/auth/token', ...)` BEFORE `app.on(['GET', 'POST'], '/api/auth/*', ...)`. Hono matches routes in definition order, so the specific route now takes priority.

## 5. Hono wildcard pattern: `**` vs `*`

**Problem:** The original code used `app.on(['GET', 'POST'], '/api/auth/**', ...)` which did not match any requests — all returned Hono's default 404.

**Root cause:** Hono's `app.on()` method does not support the `**` glob pattern the same way `app.all()` or `app.get()` do. The `**` was being treated as a literal segment match.

**Fix:** Changed to `app.on(['GET', 'POST'], '/api/auth/*', ...)` which correctly matches all paths under `/api/auth/`.

## 6. D1 migrations: local vs remote

**Problem:** `wrangler d1 execute deepspace-auth --command "CREATE TABLE ..."` created tables in the **local** D1 database, not the deployed remote D1. The deployed worker couldn't find the tables (`no such table: user`).

**Fix:** Always use `--remote` flag: `wrangler d1 execute deepspace-auth --remote --command "..."`.

## 7. Better Auth `twoFactor` plugin adds column to `user` table

**Problem:** Sign-up failed with `table user has no column named twoFactorEnabled`. The `twoFactor()` plugin was enabled in `createDeepSpaceAuth` but the manually created `user` table didn't include the `twoFactorEnabled` column.

**Fix:** Added `ALTER TABLE user ADD COLUMN twoFactorEnabled INTEGER` to the remote D1. In the future, consider using Better Auth's `getMigrations()` / `npx auth@latest migrate` to generate the correct schema automatically.

## 8. JWT issuer mismatch between auth-worker and verifiers

**Problem:** The auth-worker sets the JWT issuer to `AUTH_BASE_URL` (which is `https://deepspace-auth.../api/auth`), but the api-worker and platform-worker had `AUTH_JWT_ISSUER` set to `https://deepspace-auth...` (without `/api/auth`). JWT verification failed with "Invalid or expired token".

**Fix:** Updated `AUTH_JWT_ISSUER` on all verifying workers to match the issuer in the JWT: `https://deepspace-auth.eudaimonicincorporated.workers.dev/api/auth`. Updated Doppler `prd` config accordingly.

## 9. TypeScript worker for WfP REST API deploy

**Problem:** The Cloudflare REST API doesn't bundle TypeScript — it expects plain JavaScript modules.

**Fix:** Bundle the TypeScript worker with esbuild (`--format=esm --bundle`) in the Playwright global setup before uploading via the REST API. The bundled JS file is written to `.worker-bundle.js` (gitignored) and its content is sent as the `index.js` module in the multipart form.

---

## Current State

All three SDK platform workers are deployed and functional:

| Worker | URL | Status |
|--------|-----|--------|
| `deepspace-auth` | `deepspace-auth.eudaimonicincorporated.workers.dev` | Auth + JWT issuance working |
| `deepspace-api` | `deepspace-api.eudaimonicincorporated.workers.dev` | Billing + user profile working |
| `deepspace-platform-worker` | `deepspace-platform-worker.eudaimonicincorporated.workers.dev` | Health + app registry working (DO stubs) |

| `deepspace-deploy` | `deepspace-deploy.eudaimonicincorporated.workers.dev` | App deployment via REST API working |

The full auth flow is verified: sign-up -> session cookie -> JWT -> API call with JWT -> user profile returned.

## 10. Cloudflare Assets: MIME type must be set on upload Blob

**Problem:** Apps deployed via the deploy worker served all files with `content-type: application/octet-stream`, causing browsers to download HTML instead of rendering it.

**Root cause:** When uploading assets to the Cloudflare Workers Assets API (`POST /workers/assets/upload?base64=true`), the `Blob` in the multipart form must have the correct MIME type set. Cloudflare uses the Blob's content-type from the upload to determine how to serve the file. Without it, everything defaults to `application/octet-stream`.

**Verified experimentally:**
- `new Blob([b64], { type: 'text/html' })` → served as `content-type: text/html`
- `new Blob([b64])` (no type) → served as `content-type: application/octet-stream`

**This is NOT documented in the Cloudflare API docs.** The REST API examples show plain `curl -F` uploads without explicit MIME types. But the Miyagi3 `miniapp-deployer` sets MIME types on every Blob (line 543 of `deploy.ts`), which is why Miyagi3-deployed apps work correctly.

**Fix:** Added `getMimeType(filePath)` function to the deploy worker's `cloudflare-deploy.ts` and pass the MIME type when constructing the upload Blob:
```ts
// Before (broken):
form.append(hash, new Blob([asset.contentBase64]), hash)

// After (fixed):
const mimeType = getMimeType(asset.path)
form.append(hash, new Blob([asset.contentBase64], { type: mimeType }), hash)
```

## 11. Cloudflare Assets: permanent MIME type poisoning by content hash

**Problem:** After fixing the MIME type on upload (issue #10), some assets still served as `application/octet-stream` — even with a fresh app name, fresh deploy, and correct MIME types in the upload code.

**Root cause:** Cloudflare's asset storage system caches assets **globally by content hash** (the first 32 hex chars of SHA-256). When a file is uploaded for the first time, the MIME type from that upload is permanently associated with that hash. Subsequent uploads of the same hash — even with a different MIME type — are silently ignored. The asset upload session returns `buckets: []` (0 buckets) meaning "I already have all these files, nothing to upload." The MIME type from the original broken upload persists forever.

This means:
- Any file uploaded before the MIME fix (issue #10) is permanently poisoned
- Purging the CF edge cache (`/zones/{id}/purge_cache`) clears the CDN layer but does NOT fix the underlying asset store's MIME metadata
- The only way to "fix" a poisoned hash is to change the file content so it produces a different hash

**How we hit this:** During development, we deployed the starter template multiple times through the broken deploy worker (before the MIME fix). The Vite build produces deterministic output — same source code → same bundle → same hash. So every subsequent deploy of the unmodified template reused the poisoned hashes.

**How we verified:**
1. Deployed a synthetic test with small unique files through the fixed deploy worker → all MIME types correct
2. Deployed the real Vite build (same hashes as the broken deploys) → JS/CSS still `application/octet-stream`
3. Changed `--color-primary` in `styles.css` to produce a new CSS hash → CSS MIME type correct
4. Added a JSX element to `App.tsx` to produce a new JS hash → JS MIME type correct
5. Confirmed: the deploy worker fix works for any hash that has never been uploaded before

**Solution:** This is a one-time problem caused by our debugging process. For production:
- The deploy worker now sets correct MIME types on every upload (issue #10 fix)
- Any file uploaded through the fixed deploy worker gets correct MIME types on first upload
- Those MIME types are cached permanently by CF — which is now a good thing
- Real users who only ever deploy through the fixed deploy worker will never encounter this issue

For our development environment, we changed `--color-primary` from `#818cf8` to `#7c87f5` in the starter template to produce fresh hashes that don't collide with any poisoned ones. We also had the CF zone cache purged from the dashboard to clear stale edge cache entries.

**Lesson:** When working with CF's asset upload API, always set MIME types from the very first upload. There is no way to retroactively fix the MIME type for an existing content hash.

## 12. SDK config: production URLs must point to deployed workers

**Problem:** The `@deepspace/config` package had production URLs pointing to `auth.deep.space`, `api.deep.space`, etc. — domains that don't exist yet. Apps deployed to `*.app.space` tried to reach these domains for auth/API calls and got `ERR_NAME_NOT_RESOLVED`.

**Fix:** Updated `PROD_CONFIG` in `packages/config/src/index.ts` to point to the actual deployed worker URLs (`deepspace-auth.eudaimonicincorporated.workers.dev`, etc.). These will be updated to the custom domains once DNS is configured.
