/**
 * Local test fixtures.
 * Points at locally-running workers and app.
 */

import { test as base, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

interface AuthState {
  sessionToken: string
  jwt: string
  userId: string
}

interface AllAuthState {
  user1: AuthState
  user2: AuthState
}

const STATE_PATH = resolve(import.meta.dirname, '../.auth-state.json')

function loadAuthState(): AllAuthState {
  const raw = JSON.parse(readFileSync(STATE_PATH, 'utf-8'))
  // Support both old (flat) and new (user1/user2) formats
  if (raw.user1) return raw
  return { user1: raw, user2: raw }
}

export const AUTH_URL = 'http://localhost:8794'
export const PLATFORM_URL = 'http://localhost:8792'
export const APP_URL = 'http://localhost:5173'

type Fixtures = {
  auth: AuthState
  auth2: AuthState
  authedRequest: APIRequestContext
}

export const test = base.extend<Fixtures>({
  auth: async ({}, use) => {
    use(loadAuthState().user1)
  },

  auth2: async ({}, use) => {
    use(loadAuthState().user2)
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
