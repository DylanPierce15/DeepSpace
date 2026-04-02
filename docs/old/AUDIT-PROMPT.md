# Audit Prompt: Miyagi3 → DeepSpace SDK Port

You are auditing the Miyagi3 codebase to determine what needs to be ported to the DeepSpace SDK. The goal is a complete, working SDK that developers can use to build and deploy real-time collaborative apps on Cloudflare Workers.

## Context

The DeepSpace SDK at `~/GitHub/deepspace-sdk` is a rewrite of the Miyagi3 platform at `~/GitHub/Miyagi3`. The SDK already has:

### What's built and working (DO NOT rebuild these):
- **Auth**: Better Auth on D1, JWT issuance, ES256 verification (`packages/auth`, `platform/auth-worker`)
- **API worker**: Billing, Stripe, user profiles, credits, integration proxying (`platform/api-worker`)
- **Platform worker**: Health, app registry (R2), DO stubs for RecordRoom/GatewaySession (`platform/platform-worker`)
- **Deploy worker**: Deploys user apps to WfP via REST API with correct MIME types (`platform/deploy-worker`)
- **Dispatch worker**: Routes `*.app.space` → user workers in `spaces-apps` namespace (`platform/dispatch-worker`)
- **CLI**: `deepspace login`, `deepspace deploy`, `deepspace undeploy` — working end-to-end (`packages/cli`)
- **SDK client**: React hooks for auth (`useAuth`, `useUser`, `useSession`), `AuthOverlay` with inline sign-in form, `DeepSpaceAuthProvider`, `RecordProvider`, `useQuery`, `useMutations`, `useYjsField` (`packages/sdk`)
- **SDK worker**: RecordRoom DO, GatewaySession, schema validation, RBAC, tools API, scoped R2, McAPI proxy, cron, backup (`packages/sdk-worker`)
- **Starter template**: Vite + React + Tailwind + Hono worker with auth proxy, WebSocket proxy, server actions, SPA fallback (`templates/starter`)
- **E2E tests**: 29 Playwright tests covering auth flow, API, platform, and deployed app with sign-in (`e2e/`)
- **Unit tests**: 176 tests across 5 packages (`packages/auth`, `platform/*`)
- **CI/CD**: GitHub Actions workflow (disabled, manual trigger) deploying all 5 workers + running tests

### Auth differences from Miyagi3:
- Miyagi3 uses **Clerk** for auth. DeepSpace uses **Better Auth** on D1.
- Miyagi3's SDK exports from `@spaces/sdk/auth` (Clerk-based). DeepSpace exports from `@deepspace/sdk/auth` (Better Auth-based).
- The `useAuth()` and `useUser()` hooks have the same API surface but different internals.
- DeepSpace apps proxy `/api/auth/*` through the app's own worker → auth-worker (same-origin cookies). Miyagi3 uses Clerk's satellite domain setup.

### Platform differences:
- Miyagi3's platform worker is called `platform-worker`. DeepSpace's is `deepspace-platform-worker`.
- Miyagi3's dispatch namespace is `spaces-apps`. DeepSpace uses the same namespace.
- Miyagi3's R2 bucket is `miyagi-user-files`. DeepSpace uses `deepspace-user-files`.
- Miyagi3's schema registry R2 bucket is `schema-registry`. DeepSpace uses `deepspace-schema-registry`.

## Your Task

### Phase 1: Audit the Miyagi3 SDK (`~/GitHub/Miyagi3/packages/spaces-sdk`)

Read every file in `packages/spaces-sdk/src/` and compare against `~/GitHub/deepspace-sdk/packages/sdk/src/`. For each module, determine:

1. **Does the DeepSpace SDK already have this?** If yes, is it complete or partial?
2. **Is it needed?** Some Miyagi3 features are Clerk-specific or legacy.
3. **What needs to change?** Auth references (Clerk → Better Auth), import paths (`@spaces/sdk` → `@deepspace/sdk`), platform URLs.

Focus on these directories in `packages/spaces-sdk/src/`:
- `auth/` — what auth UI components exist beyond what DeepSpace has? (DeepSpace has: `AuthOverlay`, `DeepSpaceAuthProvider`, `useAuth`, `useUser`, `useSession`, `signIn/signUp/signOut`, `getAuthToken`)
- `storage/` — is the RecordProvider/RecordScope/useQuery/useMutations implementation complete in DeepSpace? Compare the Zustand store, WebSocket connection logic, subscription management, reconnection handling.
- `profile/` — profile modals, user profile display. Does DeepSpace need this?
- `platform/` — PlatformProvider, widget auth, screenshot listener. What's needed?
- `mobile/` — mobile header, native bridge. Needed?
- `config/` — environment config. DeepSpace has this.
- `worker/` — this is the server SDK. Compare against `~/GitHub/deepspace-sdk/packages/sdk-worker/src/`.

### Phase 2: Audit the Miyagi3 starter template (`~/GitHub/Miyagi3/packages/widget-starter-template`)

Compare against `~/GitHub/deepspace-sdk/templates/starter/`. Focus on:
- `template/src/AppShell.tsx` — DeepSpace's `App.tsx` has the auth overlay but not the full AppShell (SharedScopes, MobileHeader, DeepSpacePill, LowCreditsWarning, ProfileModalProvider). What's needed?
- `template/src/main.tsx` — entry point differences
- `template/src/constants.ts` — app configuration (SCOPE_ID, SHARED_CONNECTIONS, ROLES)
- Build config (`vite.config.ts`, `postcss.config.js`, `tsconfig.json`)

### Phase 3: Audit the Miyagi3 miniapp-deployer (`~/GitHub/Miyagi3/packages/miniapp-deployer`)

Compare against `~/GitHub/deepspace-sdk/platform/deploy-worker/`. Focus on:
- `site-worker.ts` — the synced worker template. Compare against DeepSpace's `templates/starter/worker.ts`.
- `build-env/` — build config files. Are these needed?
- `metadata.ts` — worker metadata builder. DeepSpace's deploy worker has this inline.

### Phase 4: Audit the Miyagi3 worker SDK (`~/GitHub/Miyagi3/packages/spaces-sdk/src/worker/`)

Compare against `~/GitHub/deepspace-sdk/packages/sdk-worker/src/`. The DeepSpace sdk-worker was ported from Miyagi3 but may be missing recent changes. Check:
- RecordRoom handlers (subscriptions, records, users, yjs)
- Schema validation and RBAC
- GatewaySession multiplexing
- Tools API
- Backup system

## Output Format

For each module/file, produce:

```
### [module name]

**Miyagi3 location**: path
**DeepSpace location**: path (or "MISSING")
**Status**: COMPLETE | PARTIAL | MISSING | NOT_NEEDED
**Action**: NONE | PORT | UPDATE | SKIP
**Notes**: What specifically needs to change, what to watch out for
```

At the end, produce a prioritized list of changes:
1. **Critical** — app won't work without these
2. **Important** — significantly impacts developer experience
3. **Nice to have** — polish, can be added later

Be specific about file paths, function names, and what needs to change. Don't be vague — if something needs porting, say exactly which functions, which Clerk references need to become Better Auth references, etc.
