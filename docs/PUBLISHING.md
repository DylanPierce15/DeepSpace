# Publishing DeepSpace as an npm Package

## Overview

DeepSpace is published as two npm packages:

- **`deepspace`** — The SDK. Contains the React client SDK, Cloudflare Worker SDK, and CLI (deploy/login/undeploy).
- **`create-deepspace`** — The scaffolder. Contains embedded templates and features. Used via `npm create deepspace my-app`.

## Why This Structure

We don't own the `@deepspace` npm org, so we can't publish scoped packages like `@deepspace/sdk`. Instead of fighting that with bundler hacks or picking an ugly scope, we consolidated everything into a single `deepspace` package with subpath exports:

```ts
import { useQuery, RecordProvider, AuthOverlay } from 'deepspace'       // React client
import { RecordRoom, verifyJwt } from 'deepspace/worker'                // Cloudflare Worker
```

The monorepo still has internal folders for code organization (`src/auth/`, `src/storage/`, `src/runtime/`, etc.), but they're all part of one package. One version, one install, one publish.

## What Changed

Previously, the SDK was split into 7 workspace packages:

```
@deepspace/types        → packages/deepspace/src/types/
@deepspace/config       → packages/deepspace/src/env/
@deepspace/auth         → packages/deepspace/src/server-auth/
@deepspace/sdk          → packages/deepspace/src/auth/, storage/, messaging/, etc.
@deepspace/sdk-worker   → packages/deepspace/src/runtime/
@deepspace/cli          → packages/deepspace/src/cli/
@deepspace/test-utils   → removed
```

The `create` CLI command moved to `create-deepspace`, and the starter template + features now live inside `packages/create-deepspace/templates/` and `packages/create-deepspace/features/`.

### Naming conflicts resolved

Two folders had name conflicts during consolidation:

- **`auth/`** — The server-side auth (JWT, HMAC, Better Auth config) moved to `src/server-auth/`. The client-side auth (React hooks, providers) kept `src/auth/`.
- **`config/`** — The environment detection module moved to `src/env/`. The old `sdk/config/` was just a re-export and was dropped.
- **`useUser`** — Both `auth/hooks.ts` and `storage/hooks/useUser.ts` exported `useUser`. The auth version (a Clerk compatibility shim) was renamed to `useAuthUser` at the source, so the barrel can use clean `export *` lines.

## Package Structure

### `deepspace`

```
packages/deepspace/
  src/
    index.ts          — Client SDK barrel (React hooks, providers, auth, storage, messaging, etc.)
    worker.ts          — Worker SDK barrel (RecordRoom, schemas, auth verification)
    types/             — Shared type definitions
    env/               — Environment detection and URLs
    server-auth/       — JWT verification, HMAC, Better Auth server config
    auth/              — Client auth (React hooks, providers, Better Auth client)
    storage/           — RecordProvider, useQuery, useMutations, etc.
    messaging/         — useMessages, useChannels, useConversation, etc.
    directory/         — useConversations, useCommunities, usePosts
    platform/          — PlatformProvider, useInbox, usePlatformWS
    theme/             — DeepSpaceThemeProvider, applyTheme
    runtime/           — RecordRoom, schemas, handlers, tools API
    cli/               — CLI commands (deploy, login, undeploy, create redirect)
  tsup.config.ts       — Builds 3 entry points: index, worker, cli
  tsconfig.json
  package.json
```

**Build:** `tsup` bundles three entry points into `dist/`. External dependencies (`react`, `better-auth`, `hono`, `yjs`, etc.) are not bundled — they stay as imports for the consumer's bundler or runtime to resolve.

**Exports:**
```json
{
  ".": "./dist/index.js",
  "./worker": "./dist/worker.js"
}
```

**Bin:** `deepspace` → `./dist/cli.js`

### `create-deepspace`

```
packages/create-deepspace/
  src/index.ts         — Scaffolder CLI
  templates/starter/   — Starter app template
  features/            — Feature reference implementations
  tsup.config.ts
  package.json
```

Templates and features are embedded in the published tarball. The scaffolder copies them locally — no npm registry fetch needed.

**`--local` flag:** For development, `create-deepspace my-app --local /path/to/monorepo` packs `deepspace` from the local build and installs from the tarball instead of npm.

## How to Publish

```bash
# Build
cd packages/deepspace && pnpm build
cd packages/create-deepspace && pnpm build

# Publish
cd packages/deepspace && npm publish
cd packages/create-deepspace && npm publish
```

## How Users Use It

```bash
# Scaffold a new app
npm create deepspace my-app
cd my-app

# Develop
npm run dev

# Deploy
npx deepspace login
npx deepspace deploy
```

In their code:
```ts
// React frontend
import { RecordProvider, useQuery, useMutations, useAuth, AuthOverlay } from 'deepspace'

// Cloudflare Worker
import { RecordRoom, verifyJwt, CHANNELS_SCHEMA } from 'deepspace/worker'
```

## Testing

### Local tests

```bash
./scripts/test-local.sh [app-name]
```

Scaffolds a fresh test app from the template (using `--local`), starts all workers locally, runs Playwright. The test app lands in `.test-apps/` (gitignored).

### Production tests

```bash
npx tsx tests/production/scripts/run-full-e2e.ts [--keep]
```

Scaffolds an app, deploys it to `*.app.space`, runs Playwright against the live URL, then undeploys. Pass `--keep` to leave the app deployed for debugging.

### Scaffold a test app manually

```bash
./scripts/scaffold-test-app.sh my-test
cd .test-apps/my-test
npx wrangler dev  # worker on :8780
npx vite          # frontend on :5173
```

## Platform Workers

The platform workers (`platform/auth-worker`, `platform/platform-worker`, etc.) are internal infrastructure, not published. They import from the `deepspace` workspace package:

```ts
// platform/platform-worker/src/worker.ts
import { verifyJwt, RecordRoom } from 'deepspace/worker'
```

## Key Design Decisions

1. **No `@deepspace` scope** — Can't get it on npm. Single `deepspace` package with subpath exports instead.
2. **Folders, not packages** — Internal code organization via directories, not workspace packages. No versioning overhead.
3. **`create-deepspace` is separate** — Templates can grow large without bloating the SDK. Users only download it once via `npm create`.
4. **`deepspace create` delegates** — Running `deepspace create` in the CLI runs `npm create deepspace@latest` under the hood, downloading the scaffolder on demand.
5. **Vite `dedupe`** — The template's `vite.config.ts` deduplicates `react`, `react-dom`, and `better-auth` to prevent duplicate module instances when `deepspace` is installed from a tarball.
