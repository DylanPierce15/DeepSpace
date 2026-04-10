/**
 * Shared Playwright fixtures for deployed-feature tests.
 *
 * Reads the deployed app URL and auth state from the e2e state files
 * (tests/e2e/.app-name and tests/e2e/.auth-state.json), so these tests
 * run against whatever app is currently deployed by the e2e runner.
 */

import { test as base, type APIRequestContext } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const E2E_DIR = resolve(import.meta.dirname, '../e2e')
const STATE_PATH = resolve(E2E_DIR, '.auth-state.json')
const APP_NAME_PATH = resolve(E2E_DIR, '.app-name')

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

type Fixtures = {
  auth: AuthState
  authedRequest: APIRequestContext
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
})

export { expect } from '@playwright/test'
