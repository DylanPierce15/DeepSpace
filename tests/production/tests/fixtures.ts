/**
 * Shared Playwright fixtures for E2E tests.
 * Provides authenticated API request contexts and auth state.
 */

import { test as base, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { AuthState } from '../setup/auth-helpers.js'

const STATE_PATH = resolve(import.meta.dirname, '../.auth-state.json')

function loadAuthState(): AuthState {
  return JSON.parse(readFileSync(STATE_PATH, 'utf-8'))
}

// Worker base URLs
export const AUTH_URL = 'https://deepspace-auth.eudaimonicincorporated.workers.dev'
export const API_URL = 'https://deepspace-api.eudaimonicincorporated.workers.dev'
export const PLATFORM_URL = 'https://deepspace-platform-worker.eudaimonicincorporated.workers.dev'

type Fixtures = {
  auth: AuthState
  authedRequest: APIRequestContext
}

/**
 * Extended test with auth fixtures.
 * - `auth`: the auth state (JWT, userId, sessionToken)
 * - `authedRequest`: a Playwright APIRequestContext with the JWT pre-set
 */
export const test = base.extend<Fixtures>({
  auth: async ({}, use) => {
    use(loadAuthState())
  },

  authedRequest: async ({ playwright, auth }, use) => {
    const ctx = await playwright.request.newContext({
      extraHTTPHeaders: {
        Authorization: `Bearer ${auth.jwt}`,
      },
    })
    await use(ctx)
    await ctx.dispose()
  },
})

export { expect } from '@playwright/test'
