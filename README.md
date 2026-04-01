# DeepSpace SDK

Full-stack framework for building collaborative, real-time applications on Cloudflare Workers.

## Architecture

```
packages/           Shared libraries (npm-publishable)
  auth/             Better Auth integration, JWT verification, HMAC signing
  config/           Environment detection and service URL configuration
  cli/              CLI tool (deepspace login, deploy, undeploy)
  create-app/       App scaffolder (create-deepspace-app)
  sdk/              React client SDK (auth, storage, Yjs, file uploads)
  sdk-worker/       Server SDK (RecordRoom DO, schema validation, RBAC)
  shared-types/     TypeScript types shared by client and server
  test-utils/       JWT signing and D1 migration helpers for tests

platform/           Cloudflare Workers (deployed infrastructure)
  auth-worker/      User authentication, session management, JWT issuance
  api-worker/       Billing, Stripe, user profiles, integration proxying
  platform-worker/  Durable Objects (RecordRoom), R2 app registry, WebSocket
  deploy-worker/    App deployment to Workers for Platforms
  dispatch-worker/  Routes *.app.space to per-app user workers

templates/          Project templates
  starter/          Starter template (Vite + React + Tailwind + Hono worker)

apps/               First-party applications
  dashboard/        Builder console (React)

e2e/                End-to-end tests (Playwright)
examples/           Example apps
```

## Developer Workflow

```bash
# Create an app
npx create-deepspace-app my-app
cd my-app

# Develop locally
npm run dev

# Login and deploy
npx deepspace login
npx deepspace deploy
# → Live at https://my-app.app.space
```

## Development

```bash
pnpm install
pnpm turbo build
pnpm turbo test          # 176 unit/integration tests
npx tsx e2e/scripts/run-full-e2e.ts  # 29 E2E tests
```

## Platform Workers

| Worker | Purpose | URL |
|--------|---------|-----|
| `deepspace-auth` | Better Auth + JWT issuance | `deepspace-auth.eudaimonicincorporated.workers.dev` |
| `deepspace-api` | Billing, profiles, integrations | `deepspace-api.eudaimonicincorporated.workers.dev` |
| `deepspace-platform-worker` | Durable Objects, WebSocket, app registry | `deepspace-platform-worker.eudaimonicincorporated.workers.dev` |
| `deepspace-deploy` | App deployment to WfP | `deepspace-deploy.eudaimonicincorporated.workers.dev` |
| `deepspace-dispatch` | Routes `*.app.space` to user apps | (shares `spaces-apps` namespace) |
