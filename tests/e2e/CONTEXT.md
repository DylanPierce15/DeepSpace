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
Features are added from **inside the scaffolded app dir** using the app's own CLI — not from a runner script. This is a pluggable step: add any feature(s) you want, edit their code, modify schemas, etc., before deploying.

Get the app dir from the state file and `cd` in:
```bash
APP_DIR=$(node -e "console.log(JSON.parse(require('fs').readFileSync('tests/e2e/.e2e-state.json')).appDir)")
cd "$APP_DIR"
```

List available features:
```bash
npx deepspace add --list
```

Install a feature (e.g. ai-chat):
```bash
npx deepspace add ai-chat
```
This copies the feature's files, integrates schemas/CSS, and wires the route into `src/nav.ts`. After this step you can edit any generated file, add your own code, change schemas, etc.

Return to the repo root:
```bash
cd -
```

### Step 5: Deploy
```bash
npx tsx tests/e2e/scripts/steps/deploy.ts
```
Runs `deepspace deploy` from the app dir, pushing it to `https://<app-name>.app.space`. Writes `.app-name` (used by Playwright fixtures to derive the live URL). Marks `deployed: true` in state.

At this point the app is live. Open `https://<app-name>.app.space` in a browser to interact with it manually.

### Step 6: Run Playwright tests
```bash
# All suites
npx tsx tests/e2e/scripts/steps/test.ts

# Just auth + CLI suite
npx tsx tests/e2e/scripts/steps/test.ts auth

# Just deployed-app suite
npx tsx tests/e2e/scripts/steps/test.ts app
```

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
npx tsx tests/e2e/scripts/run.ts              # build + scaffold + login + auth tests, teardown
npx tsx tests/e2e/scripts/run.ts --deploy     # also deploy + run app tests
npx tsx tests/e2e/scripts/run.ts --deploy --keep   # same but preserve the app
npx tsx tests/e2e/scripts/run.ts --skip-build      # skip the build step
```
**The all-in-one runner does not add features.** It's generic — if you need a feature installed, run the steps manually and insert Step 4 (`npx deepspace add <feature>`) between login and deploy.

## Architecture
- `global-setup.ts` (run automatically by Playwright) signs in the test user against the deployed auth worker and saves `.auth-state.json` (JWT, session, userId) for the test fixtures.
- `.app-name` is written by `deploy.ts` and read by `getAppBase()` in `fixtures.ts` to derive `https://<app-name>.app.space`.
- Test user: `e2e-test@deepspace.test` / `TestPass123!`. Must exist on the production auth worker.

## Test suites
- `auth.spec.ts` — Auth worker health, sign-in, JWT, test account management.
- `cli.spec.ts` — CLI commands (login, whoami, test-accounts). Reads `E2E_CLI_BIN` + `E2E_APP_DIR` env vars provided by `test.ts`.
- `app.spec.ts` — Deployed app: HTML serving, SPA fallback, R2 files, auth overlay. Requires `--deploy` / a deployed app.

## Adding a new test spec
1. Create `tests/your-spec.spec.ts` (use `getAppBase()` from fixtures for the deployed URL, `authedRequest` fixture for authenticated HTTP calls).
2. Add the spec to `scripts/steps/test.ts` in the appropriate suite (`auth` or `app`).
3. If your spec needs a feature installed, document it in your spec's comments — the user will run Step 4 manually with the feature name.

## Known issues
- `url.parse()` deprecation warning from `pnpm install` is from pnpm internals, not our code.

See `docs/gotchas/` for documented pitfalls (feature routing, AI SDK baseURL, etc.).
