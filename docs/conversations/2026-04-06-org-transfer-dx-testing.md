# 2026-04-06: Org Transfer, Developer Experience, and Testing Infrastructure

## GitHub Org Transfer

- Transferred repo from `Eudaimonic-Inc` to `DeepDotSpace` org
- Transferred GitHub OAuth Application to new org
- Secrets (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `DOPPLER_SERVICE_TOKEN`) transferred automatically with the repo
- Updated local git remote to point to new org
- Verified GitHub OAuth still works via CLI login + full E2E test (29/29 passed)

## npm Packages

**Existing packages** (owned by `eudaimonicinc`):
- `deepspace`, `create-deepspace`, `create-deepspace-app`

**Claimed new package names** (public stubs):
- `deepspace-mobile`, `deepspace-desktop`, `deepspace-extension`

**Published private scoped packages**:
- `@eudaimonicinc/deepspace@0.1.1`, `@eudaimonicinc/create-deepspace@0.1.1`
- Created `scripts/publish-private.sh` for publishing

## DO Migration Fix

- Changed `AppPresenceRoom` from `new_classes` (legacy KV) to `new_sqlite_classes` (SQLite)
- All Cloudflare DOs should use `new_sqlite_classes` — KV-backed DOs are legacy
- Updated both template `wrangler.toml` and worker manifest
- Deployed updated deploy-worker

## CLI Commands Added

| Command | Description |
|---|---|
| `deepspace dev [--prod]` | Start local dev server (single process via Cloudflare Vite plugin) |
| `deepspace test [suite]` | Run tests (smoke, api, e2e, unit, all) |
| `deepspace whoami` | Show logged-in user (auto-refreshes JWT) |
| `deepspace add <feature>` | Add a feature (copies files, wires schema + nav) |

All commands use `env.ts` as single source of truth for worker URLs.

## Scaffolder Improvements (`create-deepspace`)

- **In-place scaffolding**: detects near-empty git repos and scaffolds into them
- **`.gitignore` generation**: auto-created since npm strips dotfiles
- **`git init`**: runs automatically for fresh directories
- **Bun detection**: uses `bun install` if available (3s vs minutes)
- **Install progress**: live spinner with package count
- **`create-deepspace .`**: fixed validation to allow `.` as app name
- **`basename()` over `split('/').pop()`**: cross-platform path handling

## File-Based Routing (Generouted)

Migrated from manual `pages.ts` route registry to generouted file-based routing.

**Convention:**
- `src/pages/*.tsx` → automatic routes
- `src/pages/_app.tsx` → global providers + nav shell (NOT `_layout.tsx` at root — generouted quirk)
- `src/pages/[...all].tsx` → catch-all 404
- `src/pages/canvas/index.tsx` + `src/pages/canvas/[docId].tsx` → nested routes
- `src/nav.ts` → navigation items (separate from routing)
- All page components must use `export default`

**Removed:** `App.tsx`, `AppShell.tsx`, `pages.ts`

## Feature File Convention

Features install files into three locations:
- **Pages** → `src/pages/<name>.tsx`
- **Components** → `src/components/<feature>/`
- **Schemas** → `src/schemas/<feature>-schema.ts`

`deepspace add` auto-wires:
- Schema into `schemas.ts` (regex with safe fallback)
- Nav item into `nav.ts` (marker comment)
- Route is automatic (generouted)

Canvas and docs features split into list + editor pages for proper nested routing.

## Cloudflare Vite Plugin

- Added `@cloudflare/vite-plugin` for single-process dev (worker runs inside Vite)
- Solves: race conditions, auth redirect port mismatch, dual-port complexity
- **Dev**: plugin active (single port, worker in-process)
- **Deploy**: reads build output via `.wrangler/deploy/config.json` → output `wrangler.json` (same contract as `wrangler deploy`)
- DO manifest now read from build output JSON instead of regex-parsing `worker.ts`

## Integration Proxy

- Added `API_WORKER` service binding in deploy worker (zero-latency in production)
- Added `API_WORKER_URL` env var for local dev (HTTP fallback)
- Added `/api/integrations/:name/:endpoint` proxy route in app worker template
- Auth worker: added `GET /api/auth/jwks` endpoint to serve public key

## TOML Parsing

- Replaced regex TOML parsing with `smol-toml` (2KB, zero deps)
- Used in `deploy.ts` and `undeploy.ts` for reading `wrangler.toml`

## QA Audit Fixes

- `[...].tsx` → `[...all].tsx` (generouted requires named catch-all)
- `create-deepspace .` validation fix
- Added `vitest` to template devDependencies
- Removed dead `AppShell.tsx`, unused `signInternalPayload` import
- Fixed greedy regex `.+` → `[^"]+` (then replaced with TOML parser)
- Consistent theme tokens in AuthGate loading state
- Refactored 5 duplicated WS auth handlers into `wsRoute()` helper

## Dev/Prod Worker Environments

Deployed separate dev workers (like Solana's devnet):

| Worker | Dev URL | Purpose |
|---|---|---|
| `deepspace-auth-dev` | `deepspace-auth-dev.eudaimonicincorporated.workers.dev` | Free account creation, dev JWT keys |
| `deepspace-api-dev` | `deepspace-api-dev.eudaimonicincorporated.workers.dev` | Mock billing, no rate limits |

- Separate D1 databases: `deepspace-auth-dev`, `deepspace-billing-dev`
- Separate ES256 JWT keypair (dev JWT can't work on production)
- `deepspace dev` defaults to dev workers, `--prod` for production
- `deepspace test` always uses dev workers
- Migration endpoint allows `_migrate` on dev (`-dev.` URL check)

**This eliminated the need for dev auth hacks** (localStorage `__dev_user_id`, `X-Dev-User-Id` header, `DEV_MODE` env var, `?devUserId=` param). All reverted — SDK stays clean.

## Testing Infrastructure

**Playwright tests ship with every scaffolded app:**
- `tests/smoke.spec.ts` — app loads, nav visible, sign-in button, 404 page
- `tests/api.spec.ts` — auth proxy works, WebSocket endpoint exists
- `tests/collab.spec.ts` — two users sign up on dev auth, recognized as different users
- `tests/helpers/auth.ts` — `signUp()`, `signOut()`, `createTestUsers()` using real auth
- `tests/helpers/errors.ts` — `captureConsoleErrors()`
- `tests/playwright.config.ts` — auto-starts Vite via `webServer`, `cwd: '..'` fix

**`deepspace test` command:**
- Writes `.dev.vars` pointing to dev workers
- Installs Playwright on first run if missing
- Suites: `smoke`, `api`, `e2e`, `unit`, `all`, or specific file

## Centralized Config (`env.ts`)

All worker URLs in one file:
```ts
export const ENVS = {
  dev: { auth, api, deploy },
  prod: { auth, api, deploy },
}
```

Used by: `dev.ts`, `test.ts`, `deploy.ts`, `undeploy.ts`, `auth.ts`, `login.ts`

## Repos Created

- `DeepDotSpace/test-app-1` — private, topic: `testing`
- `DeepDotSpace/taskspace` — private, topic: `deepspace-app` (task manager app, scaffolded with old code in `old-code/` for migration reference)
