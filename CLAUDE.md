# DeepSpace SDK — Project Conventions

## Package Naming
All packages use the `@deep-space/*` scope:
- `@deep-space/types` — Shared type definitions
- `@deep-space/config` — Environment detection & URLs
- `@deep-space/auth` — JWT verification, Better Auth, HMAC internal auth
- `@deep-space/sdk` — React client SDK (hooks, providers, storage)
- `@deep-space/sdk-worker` — Cloudflare Worker runtime (RecordRoom, GatewaySession)
- `@deep-space/cli` — CLI tool (tsup-bundled)
- `create-deepspace-app` — Project scaffolder

Platform workers: `@deep-space/platform-worker`, `@deep-space/auth-worker`, `@deep-space/api-worker`, `@deep-space/dispatch-worker`

## Auth
- **Better Auth** (not Clerk). The auth-worker handles sessions + JWT issuance.
- JWTs are ES256 (ECDSA P-256), short-lived (5m), issued by the auth-worker.
- Internal service-to-service auth uses HMAC (SHA-256) signatures.

## Workers
- All workers use **Hono** as the HTTP framework.
- Cloudflare Workers with `nodejs_compat` compatibility flag.
- Platform worker hosts Durable Objects: `SharedRecordRoom` (SQLite-backed) and `GatewaySession` (WebSocket multiplexing).
- Dispatch worker routes `*.app.space` subdomains via Workers for Platforms.

## No Widget/Iframe Concepts
DeepSpace apps are full standalone Workers, not embeddable widgets or iframes.

## Schemas
Schemas are **baked into each app's worker at deploy time** — imported from `src/schemas.ts` and compiled into the worker bundle. No R2 schema registry, no runtime registration via WebSocket.

## Scope Model
Data is keyed by `scopeId`:
- `app:{appId}` — app-wide shared data (channels, settings, items)
- `conv:{convId}` — per-conversation (messages, reactions)
- `dir:{appId}` — cross-app discoverable directory (conversations, communities)
- `workspace:default` — cross-app shared business data

**No `user:{userId}` scope.** User-scoped data lives in app DOs.

## Build System
- **pnpm** (v9.15) workspace with **Turbo** for task orchestration.
- TypeScript 5.7+, target ES2022, module ESNext, bundler resolution.
- Packages that export raw `.ts` files: `@deep-space/types`, `@deep-space/config`, `@deep-space/auth`, `@deep-space/sdk`, `@deep-space/sdk-worker`.
- CLI packages use `tsup` for bundling.
- Dashboard and starter template use Vite + React 19.

## Secrets
- Managed via **Doppler** (project: `deepspace-sdk`, configs: `dev`, `prd`).
- Local dev: `scripts/setup-env.sh` syncs to `.dev.vars` per worker.

## Databases
- **D1** (Cloudflare SQLite): `deepspace-auth` (auth-worker), `deepspace-billing` (api-worker).
- Durable Object SQLite: per-scope record storage in SharedRecordRoom.
