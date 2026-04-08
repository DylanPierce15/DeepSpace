/**
 * Shared Playwright fixtures for E2E tests.
 */

import { test as base, type APIRequestContext } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const STATE_PATH = resolve(import.meta.dirname, '../.auth-state.json')
const APP_NAME_PATH = resolve(import.meta.dirname, '../.app-name')

export interface AuthState {
  sessionToken: string
  jwt: string
  userId: string
}

function loadAuthState(): AuthState {
  return JSON.parse(readFileSync(STATE_PATH, 'utf-8'))
}

// Worker URLs
export const AUTH_URL = 'https://deepspace-auth.eudaimonicincorporated.workers.dev'
export const API_URL = 'https://deepspace-api.eudaimonicincorporated.workers.dev'
export const SESSION_COOKIE_NAME = '__Secure-better-auth.session_token'

/** Returns the deployed app base URL, or null if not deployed. */
export function getAppBase(): string | null {
  if (!existsSync(APP_NAME_PATH)) return null
  const name = readFileSync(APP_NAME_PATH, 'utf-8').trim()
  return name ? `https://${name}.app.space` : null
}

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
      extraHTTPHeaders: { Authorization: `Bearer ${auth.jwt}` },
    })
    await use(ctx)
    await ctx.dispose()
  },
})

export { expect } from '@playwright/test'
