# Running Playwright Tests Fast

## Quick iteration (recommended)

Start servers once with `--keep-servers`, then run Playwright directly:

```bash
# 1. Start servers (once)
./scripts/test-local.sh test-canvas --no-scaffold --no-reset --keep-servers -- --grep "NOMATCH"

# 2. Run tests directly (fast — no server restart)
cd tests/local
npx playwright test tests/canvas.spec.ts --reporter=list
npx playwright test tests/canvas.spec.ts --grep "can add a rectangle" --reporter=list

# 3. Edit test or feature code, re-run immediately
npx playwright test tests/canvas.spec.ts --reporter=list

# 4. Kill servers when done
# (PIDs are printed by --keep-servers)
```

This skips the ~15s server startup/teardown on each run.

## Full run (CI or fresh state)

```bash
# Scaffold + start + test + teardown
./scripts/test-local.sh test-canvas --with-canvas

# Or reuse existing app
./scripts/test-local.sh test-canvas --no-scaffold --no-reset
```

## Flags

- `--no-scaffold` — reuse existing `.test-apps/<name>`
- `--no-reset` — don't wipe databases
- `--keep-servers` — leave servers running after tests
- `-- <args>` — pass remaining args to Playwright

## Writing tests

### Fixtures and helpers

- `fixtures.ts` — extends Playwright with `auth`, `auth2`, `authedRequest` fixtures. URLs: auth (8794), platform (8792), app (5173).
- `helpers.ts` — `signIn(page, user)` signs in via auth overlay. `goToTestPageSignedIn(page, appUrl)` navigates + signs in.

### Test users

- User 1: `local-test@deepspace.test` / `LocalTestPass123!`
- User 2: `local-test-2@deepspace.test` / `LocalTestPass456!`

### Patterns

**Navigate + sign in:**
```ts
await page.goto(URL, { waitUntil: 'networkidle' })
await signIn(page, user)
await expect(page.locator('[data-testid="my-element"]')).toBeVisible({ timeout: 20_000 })
```

**Two-user tests:**
```ts
const ctx1 = await browser.newContext()
const page1 = await ctx1.newPage()
// ... user 1 does something ...

const ctx2 = await browser.newContext()
const page2 = await ctx2.newPage()
// ... user 2 sees it ...

await ctx1.close()
await ctx2.close()
```

**Use `data-testid` for all selectors.** Message elements: `data-testid="message-{id}"`, toolbar: `data-testid="hover-toolbar-{id}"`, shapes: `data-testid="shape-{id}"`.

**Timeouts:** 20s for initial page load after sign-in, 10s for element appearance, 5s for quick UI changes.
