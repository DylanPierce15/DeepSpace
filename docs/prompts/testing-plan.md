
❯ yes, let's plan out this feature                                                                         
                                                                                                           
what is the suggested folder structure, first                                                              
                                                                                                           
note that these tests are going to come with every app                                                     

⏺ tests/
  ├── playwright.config.ts       # Playwright config (baseURL, browser, etc.)
  ├── smoke.spec.ts              # App loads, no JS errors, key elements render
  ├── auth.spec.ts               # Sign in/out, session persistence
  ├── api/
  │   ├── harness.sh             # Bash test harness (assert_eq, sql, call_action)
  │   └── crud.sh                # CRUD via worker API (create, read, update, delete)
  ├── helpers/
  │   ├── auth.ts                # login(), logout(), ensureUser()
  │   └── errors.ts              # captureConsoleErrors(), expectNoErrors()
  └── .gitkeep

  What's scaffolded (comes with every app): smoke.spec.ts, auth.spec.ts, harness.sh, helpers/,
  playwright.config.ts

  What features add: When deepspace add tasks installs, it can also drop a tests/tasks.spec.ts with
  feature-specific tests.

  What's NOT in tests/: Unit tests stay next to the code they test (src/hooks/__tests__/, etc.) — vitest
  discovers them automatically.

  Questions before building:
  1. Should harness.sh depend on Python (like the Miyagi3 version) or should we rewrite the helpers in pure
   bash/node?
  2. Should the Playwright tests talk to the live dev server (deepspace dev running), or should deepspace
  test start its own server?

❯ we can rewrite in node for sure                                                                          
                                                                                                           
for question 2, which do you recommend?                                                                    

⏺ deepspace test should start its own server. Reasons:

  - Tests need a clean, predictable state — not whatever the dev server has running
  - The agent loop needs npx deepspace test to be self-contained (no "make sure dev is running first")
  - Playwright's built-in webServer config handles this natively — it starts the server before tests, kills
   it after

  // playwright.config.ts
  export default defineConfig({
    webServer: {
      command: 'npx vite',  // starts the app
      port: 5173,
      reuseExistingServer: true,  // but reuse if already running (dev mode)
    },
  })

  The reuseExistingServer: true means if deepspace dev is already running, tests use that. If not, they
  start their own. Best of both worlds.

❯ ok, now what else do we need to plan                                                                     

⏺ The deepspace test CLI command needs to:

  1. Ensure .dev.vars exists (same as deepspace dev — fetch JWT public key, write config)
  2. Install Playwright browsers on first run if missing
  3. Route to the right test runner based on args

  npx deepspace test              → run smoke + auth (quick validation)
  npx deepspace test smoke        → Playwright smoke only
  npx deepspace test auth         → Playwright auth only
  npx deepspace test e2e          → all Playwright specs
  npx deepspace test api          → bash/node API tests
  npx deepspace test unit         → vitest
  npx deepspace test all          → everything
  npx deepspace test <file>       → run specific test file

  Things to decide:

  1. Test user — Playwright auth tests need a test account. Do we use the logged-in user's credentials, or
  a dedicated test user on the platform? The Miyagi3 tests used a hardcoded e2e-test@deepspace.test
  account.
  2. Database state — Should tests reset DO state before running? The smoke test doesn't care, but CRUD
  tests need a clean slate. We could add a /internal/test-reset endpoint to the worker template that wipes
  local DO state.
  3. Template additions — Playwright and @playwright/test need to go in the template's devDependencies.
  That adds install weight. We could make it optional — deepspace test installs it on first run if missing.
  4. Feature tests — When deepspace add canvas runs, should it also drop tests/canvas.spec.ts? This means
  feature.json needs a tests field.
