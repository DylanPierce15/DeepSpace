/**
 * Shared Playwright fixtures for deployed-feature tests.
 *
 * Reads the deployed app URL and auth state from the e2e state files
 * (tests/e2e/.app-name and tests/e2e/.auth-state.json), so these tests
 * run against whatever app is currently deployed by the e2e runner.
 */

import { test as base, type APIRequestContext, type Page } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const E2E_DIR = resolve(import.meta.dirname, '../e2e')
const STATE_PATH = resolve(E2E_DIR, '.auth-state.json')
const APP_NAME_PATH = resolve(E2E_DIR, '.app-name')

// better-auth session cookie name — must match what the auth worker sets.
const SESSION_COOKIE_NAME = '__Secure-better-auth.session_token'

// The deployed auth worker. Test-account CRUD and sign-in go here directly
// because those endpoints are hosted by the auth worker — the app worker
// only proxies a subset. Keep in sync with `tests/e2e/tests/fixtures.ts`.
const AUTH_URL = 'https://deepspace-auth.eudaimonicincorporated.workers.dev'

export interface AuthState {
  sessionToken: string
  jwt: string
  userId: string
}

function loadAuthState(): AuthState {
  if (!existsSync(STATE_PATH)) {
    throw new Error(
      `No auth state at ${STATE_PATH}. Run tests/e2e/scripts/steps/login.ts first.`,
    )
  }
  return JSON.parse(readFileSync(STATE_PATH, 'utf-8'))
}

/** Returns the deployed app base URL, or throws if no app is deployed. */
export function getAppBase(): string {
  if (!existsSync(APP_NAME_PATH)) {
    throw new Error(
      `No deployed app. Run tests/e2e/scripts/steps/deploy.ts first.`,
    )
  }
  const name = readFileSync(APP_NAME_PATH, 'utf-8').trim()
  if (!name) throw new Error('Empty .app-name file')
  return `https://${name}.app.space`
}

/**
 * Secondary test user provisioned on demand for multi-user specs. The
 * fixture creates a fresh `@deepspace.test` account, signs it in, and
 * opens a Playwright browser context with the new session cookie bound
 * to the app host. Teardown deletes the account and closes the context.
 */
export interface SecondaryUser {
  /** test-accounts record id — needed for the teardown DELETE */
  id: string
  userId: string
  email: string
  password: string
  sessionToken: string
  page: Page
}

type Fixtures = {
  auth: AuthState
  authedRequest: APIRequestContext
  /**
   * A browser `Page` that already carries the test user's session cookie
   * on the deployed app domain. Use this for UI specs that assume the
   * viewer is signed in (e.g. protected routes like `/docs`, `/chat`).
   * The cookie is scoped to the app host only — it's the same session
   * token the auth worker issued during `login.ts`.
   */
  signedInPage: Page
  /**
   * Provisions a second signed-in user for multi-user specs. See
   * `SecondaryUser`. Use alongside `signedInPage` to drive two separate
   * browser contexts from a single test — `signedInPage` is User A (the
   * primary test user) and `secondaryUser.page` is User B.
   *
   * Each call creates a fresh account (email `e2e-sec-<ts>@deepspace.test`)
   * and deletes it on teardown. The auth worker caps at 10 test accounts
   * per developer, so if tests run in parallel or teardown is skipped you
   * can hit the ceiling — always let the fixture clean up.
   */
  secondaryUser: SecondaryUser
}

export const test = base.extend<Fixtures>({
  auth: async ({}, use) => {
    await use(loadAuthState())
  },
  authedRequest: async ({ playwright, auth }, use) => {
    const ctx = await playwright.request.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${auth.jwt}` },
    })
    await use(ctx)
    await ctx.dispose()
  },
  signedInPage: async ({ browser, auth }, use) => {
    const appBase = getAppBase()
    const host = new URL(appBase).host
    const ctx = await browser.newContext()
    await ctx.addCookies([
      {
        name: SESSION_COOKIE_NAME,
        value: auth.sessionToken,
        domain: host,
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
    ])
    const page = await ctx.newPage()
    await use(page)
    await ctx.close()
  },
  secondaryUser: async ({ browser, auth, playwright }, use) => {
    const appBase = getAppBase()
    const host = new URL(appBase).host

    // Dedicated API context for auth-worker calls. Keeps the create and
    // delete requests independent of the browser contexts we hand to
    // specs; those shouldn't carry the primary user's session.
    const apiCtx = await playwright.request.newContext()
    const primaryCookie = `${SESSION_COOKIE_NAME}=${auth.sessionToken}`

    // 1. Create the account. Auth worker requires the developer's
    //    session cookie (primary user). Timestamp-unique email avoids
    //    collisions across concurrent runs.
    const email = `e2e-sec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@deepspace.test`
    const password = 'SecondaryPass123!'
    const createRes = await apiCtx.post(`${AUTH_URL}/api/auth/test-accounts`, {
      headers: { Cookie: primaryCookie },
      data: { email, password, name: 'E2E Secondary', label: 'e2e-feature-test' },
    })
    if (createRes.status() !== 201) {
      const body = await createRes.text()
      await apiCtx.dispose()
      throw new Error(
        `secondaryUser: create failed (${createRes.status()}): ${body}`,
      )
    }
    const created = (await createRes.json()) as {
      id: string
      userId: string
      email: string
    }

    // 2. Sign in as the new user to get their session cookie. The create
    //    response deliberately doesn't include one — separate login keeps
    //    the endpoints single-purpose.
    const signInRes = await apiCtx.post(`${AUTH_URL}/api/auth/sign-in/email`, {
      data: { email, password },
    })
    if (!signInRes.ok()) {
      // Best-effort cleanup before throwing.
      await apiCtx.delete(`${AUTH_URL}/api/auth/test-accounts/${created.id}`, {
        headers: { Cookie: primaryCookie },
      }).catch(() => {})
      await apiCtx.dispose()
      throw new Error(`secondaryUser: sign-in failed (${signInRes.status()})`)
    }
    const setCookie = signInRes.headers()['set-cookie'] ?? ''
    const match = setCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))
    if (!match) {
      await apiCtx.delete(`${AUTH_URL}/api/auth/test-accounts/${created.id}`, {
        headers: { Cookie: primaryCookie },
      }).catch(() => {})
      await apiCtx.dispose()
      throw new Error('secondaryUser: no session cookie in sign-in response')
    }
    const sessionToken = decodeURIComponent(match[1])

    // 3. Isolated browser context with the secondary user's cookie set on
    //    the app domain. Separate from `signedInPage`'s context so both
    //    users can be driven simultaneously in the same test.
    const ctx = await browser.newContext()
    await ctx.addCookies([
      {
        name: SESSION_COOKIE_NAME,
        value: sessionToken,
        domain: host,
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
    ])
    const page = await ctx.newPage()

    await use({
      id: created.id,
      userId: created.userId,
      email,
      password,
      sessionToken,
      page,
    })

    // Teardown — always close the context, then delete the account so we
    // don't exhaust the per-developer cap of 10 test accounts.
    await ctx.close()
    await apiCtx
      .delete(`${AUTH_URL}/api/auth/test-accounts/${created.id}`, {
        headers: { Cookie: primaryCookie },
      })
      .catch(() => {
        // Best-effort — if the auth worker or network hiccups, the next
        // run's prune logic or a manual `deepspace test-accounts delete`
        // can recover. Don't fail the test over teardown.
      })
    await apiCtx.dispose()
  },
})

export { expect } from '@playwright/test'
