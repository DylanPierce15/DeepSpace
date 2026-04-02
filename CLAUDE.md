# DeepSpace SDK — Project Conventions

## Published Packages
Two npm packages, no scope needed:
- `deepspace` — SDK (React client, Cloudflare Worker runtime, CLI)
- `create-deepspace` — Project scaffolder (`npm create deepspace my-app`)

Platform workers are private workspace packages (not published):
`@deepspace/platform-worker`, `@deepspace/auth-worker`, `@deepspace/api-worker`, `@deepspace/dispatch-worker`

## Package Structure
The `deepspace` package has two entry points:
- `deepspace` — React client SDK (hooks, providers, auth, storage, messaging, directory, theme, platform)
- `deepspace/worker` — Cloudflare Worker SDK (RecordRoom, schemas, JWT verification, HMAC auth)

Source is organized by folder inside `packages/deepspace/src/`:
- `types/` — Shared type definitions
- `env/` — Environment detection & URLs
- `server-auth/` — JWT verification, Better Auth server config, HMAC internal auth
- `auth/` — Client auth (React hooks, providers, Better Auth client)
- `storage/` — RecordProvider, useQuery, useMutations, Yjs, R2 files
- `messaging/` — useMessages, useChannels, useConversation
- `directory/` — useConversations, useCommunities, usePosts
- `platform/` — PlatformProvider, useInbox, usePlatformWS
- `theme/` — DeepSpaceThemeProvider, applyTheme
- `runtime/` — RecordRoom, schemas, handlers, tools API
- `cli/` — CLI commands (deploy, login, undeploy)

The `create-deepspace` package embeds templates and features:
- `packages/create-deepspace/templates/starter/` — Starter app template
- `packages/create-deepspace/features/` — Feature reference implementations

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
- **tsup** bundles `deepspace` (3 entry points: index, worker, cli) and `create-deepspace`.
- External deps (react, better-auth, hono, yjs, etc.) are not bundled.
- Dashboard uses Vite + React 19.

## Testing
- `./scripts/test-local.sh` — Scaffolds a fresh test app, starts local workers, runs Playwright (25 tests).
- `npx tsx tests/production/scripts/run-full-e2e.ts` — Scaffolds, deploys to `*.app.space`, runs Playwright (29 tests), undeploys.
- `./scripts/scaffold-test-app.sh <name>` — Creates a test app in `.test-apps/` using local tarballs.
- Test apps are scaffolded from the template each time (single source of truth).

## Secrets
- Managed via **Doppler** (project: `deepspace-sdk`, configs: `dev`, `prd`).
- Local dev: `scripts/setup-env.sh` syncs to `.dev.vars` per worker.
- Test app secrets are copied by `scaffold-test-app.sh`.

## Databases
- **D1** (Cloudflare SQLite): `deepspace-auth` (auth-worker), `deepspace-billing` (api-worker).
- Durable Object SQLite: per-scope record storage in SharedRecordRoom.
