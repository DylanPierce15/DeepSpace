/**
 * Dashboard test fixtures.
 * Points at locally-running workers and dashboard.
 */

import { test as base, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

interface AuthState {
  sessionToken: string
  jwt: string
  userId: string
}

const STATE_PATH = resolve(import.meta.dirname, '../.auth-state.json')

function loadAuthState(): AuthState {
  return JSON.parse(readFileSync(STATE_PATH, 'utf-8'))
}

export const AUTH_URL = 'http://localhost:8794'
export const API_URL = 'http://localhost:8795'
export const DEPLOY_URL = 'http://localhost:8796'
export const DASHBOARD_URL = 'http://localhost:5174'

type Fixtures = {
  auth: AuthState
  authedRequest: APIRequestContext
}

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
