# DeepSpace

DeepSpace is a full-stack framework that lets you and your agents go from nothing to a deployed, real-time, secure, and scalable app at a custom domain in minutes. It runs at the edge with ultra-low latency and bundles everything a modern app needs: auth, real-time data subscriptions, RBAC, messaging, file storage, collaborative editing (Yjs), cron jobs, agentic chat, and zero-config deployment. It is fully customizable and built for developers who want to ship fast without sacrificing control.

If you've been building with Claude Code and have a growing collection of apps stuck on your local machine, DeepSpace is for you.

Our online app building product, in beta, is at [deep.space](https://deep.space).

## Quick Start

```bash
# Create an app
npm create deepspace my-app
cd my-app

# Develop locally
npm run dev

# Login and deploy
npx deepspace login
npx deepspace deploy
# → Live at https://my-app.app.space
```

## Packages

| Package | Description |
|---------|-------------|
| `deepspace` | SDK — React client, Cloudflare Worker runtime, CLI |
| `create-deepspace` | Project scaffolder (`npm create deepspace my-app`) |

The `deepspace` package has two entry points:
- `deepspace` — React client SDK (hooks, providers, auth, storage, messaging, directory, theme)
- `deepspace/worker` — Cloudflare Worker SDK (RecordRoom, schemas, JWT verification, HMAC auth)

## Architecture

```
packages/
  deepspace/              SDK (published to npm)
    src/
      auth/               Client auth (React hooks, providers, Better Auth client)
      cli/                CLI commands (deploy, login, undeploy)
      directory/          useConversations, useCommunities, usePosts
      env/                Environment detection & URLs
      messaging/          useMessages, useChannels, useConversation
      platform/           PlatformProvider, useInbox, usePlatformWS
      runtime/            RecordRoom, schemas, handlers, tools API
      server-auth/        JWT verification, Better Auth server config, HMAC auth
      storage/            RecordProvider, useQuery, useMutations, Yjs, R2 files
      theme/              DeepSpaceThemeProvider, applyTheme
      types/              Shared type definitions
  create-deepspace/       Project scaffolder (published to npm)
    templates/starter/    Starter app template
    features/             Feature reference implementations

platform/                 Cloudflare Workers (deployed infrastructure)
  auth-worker/            User authentication, session management, JWT issuance
  api-worker/             Billing, Stripe, user profiles, integrations
  platform-worker/        Durable Objects (RecordRoom), R2, WebSocket
  deploy-worker/          App deployment to Workers for Platforms

apps/
  dashboard/              Builder console (React)

examples/
  todo-app/               Example app

tests/
  local/                  Local integration tests (Playwright)
  production/             Production E2E tests (Playwright)

scripts/
  dev.sh                  Start local dev environment
  setup-env.sh            Sync secrets from Doppler to .dev.vars
  scaffold-test-app.sh    Scaffold a test app from the template
  test-local.sh           Run local Playwright tests
```

## Development

```bash
pnpm install
pnpm turbo build
```

## Testing

```bash
# Local integration tests
./scripts/test-local.sh

# Production E2E tests
npx tsx tests/production/scripts/run-full-e2e.ts
```
