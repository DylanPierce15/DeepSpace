/**
 * Playwright global setup — just auth, no deploy.
 *
 * The app is deployed by `deepspace deploy` (called by the E2E runner script).
 * This setup only ensures we have a valid JWT for authenticated tests.
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ensureTestUser } from './auth-helpers.js'

const STATE_PATH = resolve(import.meta.dirname, '../.auth-state.json')

export default async function globalSetup() {
  console.log('[e2e] Ensuring test user...')
  const auth = await ensureTestUser()
  console.log(`[e2e] Authenticated as ${auth.userId}`)
  writeFileSync(STATE_PATH, JSON.stringify(auth))
}
