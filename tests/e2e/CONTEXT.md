# E2E Tests

## No local dev workers
All tests run against the **deployed production** API worker, auth worker, and platform worker. There is no local mode. The `tests/local/` directory has been removed.

## Running step-by-step (recommended for development)

Each step in `scripts/steps/` can run independently. They chain together via `tests/e2e/.e2e-state.json` (app dir, CLI bin path, deploy status). **Always run from the repo root.**

### Step 1: Build the SDK and scaffolder
```bash
npx tsx tests/e2e/scripts/steps/build.ts
```
Compiles `packages/deepspace` and `packages/create-deepspace`. Skip this if you haven't changed SDK code since the last build.

### Step 2: Scaffold a fresh app
```bash
npx tsx tests/e2e/scripts/steps/scaffold.ts
```
Creates a new app with a random name in `/tmp/deepspace-e2e-<timestamp>/ds-e2e-<id>/`. Writes `.e2e-state.json` with the app dir, CLI bin path, and work dir.

### Step 3: Log in as the test user
```bash
npx tsx tests/e2e/scripts/steps/login.ts
```
Signs in `e2e-test@deepspace.test` / `TestPass123!` via the scaffolded app's CLI and saves credentials to `~/.deepspace/`. The test user must already exist on the production auth worker.

### Step 4 (optional): Add features
Features can be added either through the dedicated step (recommended — tracks them in `.e2e-state.json` so Step 6 picks up their specs automatically) or manually from inside the app dir.

**Step mode** (preferred):
```bash
npx tsx tests/e2e/scripts/steps/add-feature.ts ai-chat
npx tsx tests/e2e/scripts/steps/add-feature.ts docs
npx tsx tests/e2e/scripts/steps/add-feature.ts messaging
```
Each call records the feature id in `state.features[]` so `steps/test.ts` runs the matching `tests/feature-tests/tests/<id>.spec.ts`.

**Manual mode** (for ad-hoc editing):
```bash
APP_DIR=$(node -e "console.log(JSON.parse(require('fs').readFileSync('tests/e2e/.e2e-state.json')).appDir)")
cd "$APP_DIR" && npx deepspace add ai-chat && cd -
```
Manual adds are not tracked in state, so feature specs won't auto-run — useful when you want to install a feature but skip its spec.

`deepspace add --list` shows all available features.

### Step 5: Deploy
```bash
npx tsx tests/e2e/scripts/steps/deploy.ts
```
Runs `deepspace deploy` from the app dir, pushing it to `https://<app-name>.app.space`. Writes `.app-name` (used by Playwright fixtures to derive the live URL). Marks `deployed: true` in state.

At this point the app is live. Open `https://<app-name>.app.space` in a browser to interact with it manually.

### Step 6: Run Playwright tests
```bash
# Core suites + feature specs for whatever's in state.features
npx tsx tests/e2e/scripts/steps/test.ts

# Just auth + CLI suite
npx tsx tests/e2e/scripts/steps/test.ts auth

# Just deployed-app suite (core only, no feature specs)
npx tsx tests/e2e/scripts/steps/test.ts app

# Just the per-feature specs (for whatever Step 4 installed)
npx tsx tests/e2e/scripts/steps/test.ts features
```

Feature specs live in `tests/feature-tests/tests/<feature-id>.spec.ts` and run against the deployed app. They're invoked automatically in `all` / `features` mode for each id in `state.features`. Ids with no matching spec file are skipped with a log line — useful for installing a feature without gating merges on a test for it yet.

### Step 7: Tear down (or keep)
```bash
# Tear down the deployed app and temp dir
npx tsx tests/e2e/scripts/steps/teardown.ts

# ...or skip teardown and leave the app live for manual inspection.
# The state file persists until you run teardown or scaffold a new app.
```

## All-in-one runner
For CI or a quick full run, `run.ts` chains the steps together:
```bash
npx tsx tests/e2e/scripts/run.ts                           # build + scaffold + login + auth tests, teardown
npx tsx tests/e2e/scripts/run.ts --deploy                  # also deploy + run app tests
npx tsx tests/e2e/scripts/run.ts --deploy --keep           # same but preserve the app
npx tsx tests/e2e/scripts/run.ts --skip-build              # skip the build step

# Merge-gate: install the listed features into the scaffolded app,
# deploy, and run core specs plus the matching per-feature specs.
npx tsx tests/e2e/scripts/run.ts --features ai-chat,docs,messaging
```

`--features` implies `--deploy`. Features install between `login` and `deploy` so the deploy bundles them. After deploy, `test.ts` discovers the installed-features list from state and runs `tests/feature-tests/tests/<id>.spec.ts` for each.

## Adding a feature spec

When you add a new feature to the SDK (`packages/create-deepspace/features/<id>/`), also add a merge-gate spec:

1. Create `tests/feature-tests/tests/<id>.spec.ts`. Import `test`, `expect`, and (if the spec needs an authenticated browser) `signedInPage` from `../fixtures`. Look at `docs.spec.ts` / `messaging.spec.ts` as references.
2. Assert the feature's core happy path against the deployed app (page renders, primary action works, data round-trips). One or two tests is enough for merge-gate; deeper coverage can go in the template's in-app tests.
3. Add the feature id to the CI command's `--features` list, e.g. `--features ai-chat,docs,messaging,<new>`.

No registry to update — the spec is picked up by filename match against `state.features`.

## Architecture
- `global-setup.ts` (run automatically by Playwright) signs in the test user against the deployed auth worker and saves `.auth-state.json` (JWT, session, userId) for the test fixtures.
- `.app-name` is written by `deploy.ts` and read by `getAppBase()` in `fixtures.ts` to derive `https://<app-name>.app.space`.
- Test user: `e2e-test@deepspace.test` / `TestPass123!`. Must exist on the production auth worker.

## Test suites
Core specs (`tests/e2e/tests/`):
- `auth.spec.ts` — Auth worker health, sign-in, JWT, test account management.
- `cli.spec.ts` — CLI commands (login, whoami, test-accounts). Reads `E2E_CLI_BIN` + `E2E_APP_DIR` env vars provided by `test.ts`.
- `app.spec.ts` — Deployed app: HTML serving, SPA fallback, R2 files, auth overlay. Requires `--deploy` / a deployed app.

Feature specs (`tests/feature-tests/tests/`) — require the deployed app to have the corresponding feature installed:
- `ai-chat.spec.ts` — `/assistant` page, `/api/ai/chat` auth + streaming + tool use.
- `docs.spec.ts` — `/docs` list, create, Yjs editor textarea, persistence through reload, plus a two-user real-time collab round-trip (User A types → User B sees without reload).
- `messaging.spec.ts` — `/chat` single-channel flow, join + send + receive.

The `secondaryUser` fixture (see `tests/feature-tests/fixtures.ts`) provisions a fresh `@deepspace.test` account on demand for multi-user specs. It creates via the auth worker, signs in to capture a session cookie, opens a second browser context, and deletes the account on teardown. Auth worker caps at 10 test accounts per developer — always let the fixture clean up rather than skipping teardown.

## Retries and traces

Both Playwright configs (`tests/e2e/playwright.config.ts` and `tests/feature-tests/playwright.config.ts`) set `retries: 1` locally (2 in CI) with `trace: 'retain-on-failure'`. That policy exists specifically to absorb a Playwright/Chromium subprocess flake confirmed via trace capture: `BrowserContext.newPage()` occasionally hangs for ~30s on the local machine when many tests run back-to-back, before any navigation starts. The request never hits the wire, so the app/CF isn't involved.

Real app bugs fail all retries deterministically — a trace zip ends up in `test-results/.../trace.zip` for post-mortem via `npx playwright show-trace <path>`. Tests that fail once then pass on retry don't produce traces, so flaky-but-eventually-passing runs don't spam artifacts.

## Adding a new core test spec
1. Create `tests/your-spec.spec.ts` (use `getAppBase()` from fixtures for the deployed URL, `authedRequest` fixture for authenticated HTTP calls).
2. Add the spec to `scripts/steps/test.ts` in the appropriate suite (`auth` or `app`).
3. If your spec needs a feature installed, write it as a **feature spec** instead (see "Adding a feature spec" above) — core specs should not assume any non-baseline feature is present.

## Known issues
- `url.parse()` deprecation warning from `pnpm install` is from pnpm internals, not our code.

See `docs/gotchas/` for documented pitfalls (feature routing, AI SDK baseURL, etc.).
