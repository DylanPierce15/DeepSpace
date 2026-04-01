/**
 * Playwright global setup:
 * 1. Ensure test user exists (sign up or sign in)
 * 2. Get JWT
 * 3. Deploy test app to spaces-apps dispatch namespace
 * 4. Save auth state for test files
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execSync } from 'node:child_process'
import { getApiToken, deployScript, deleteScript, scriptExists } from './cloudflare-api.js'
import { ensureTestUser } from './auth-helpers.js'

const SCRIPT_NAME = 'deepspace-sdk-test'
const APP_URL = 'https://deepspace-sdk-test.app.space'
const MAX_WAIT_MS = 30_000
const POLL_MS = 2_000
const STATE_PATH = resolve(import.meta.dirname, '../.auth-state.json')

export default async function globalSetup() {
  // ── Step 1: Auth ────────────────────────────────────────────────
  console.log('[e2e] Ensuring test user...')
  const auth = await ensureTestUser()
  console.log(`[e2e] Authenticated as ${auth.userId}`)

  // Save auth state so tests can use it
  writeFileSync(STATE_PATH, JSON.stringify(auth))

  // ── Step 2: Deploy test app ─────────────────────────────────────
  const token = getApiToken()

  if (await scriptExists(SCRIPT_NAME, token)) {
    console.log('[e2e] Cleaning up leftover deepspace-sdk-test...')
    await deleteScript(SCRIPT_NAME, token)
    await new Promise((r) => setTimeout(r, 3_000))
  }

  // Bundle TS -> JS with esbuild
  const workerTs = resolve(import.meta.dirname, '../test-app/src/worker.ts')
  const outfile = resolve(import.meta.dirname, '../test-app/.worker-bundle.js')
  execSync(`npx esbuild ${workerTs} --bundle --format=esm --outfile=${outfile} --target=esnext`, {
    stdio: 'inherit',
  })
  const workerSource = readFileSync(outfile, 'utf-8')

  console.log('[e2e] Deploying deepspace-sdk-test via Cloudflare REST API...')
  const result = await deployScript(SCRIPT_NAME, workerSource, token)
  if (!result.success) {
    console.error('[e2e] Deploy failed:', JSON.stringify(result.errors, null, 2))
    throw new Error('Failed to deploy deepspace-sdk-test')
  }

  console.log('[e2e] Waiting for deepspace-sdk-test.app.space...')
  const start = Date.now()
  while (Date.now() - start < MAX_WAIT_MS) {
    try {
      const res = await fetch(`${APP_URL}/api/health`)
      if (res.ok) {
        const body = (await res.json()) as { app?: string }
        if (body.app === SCRIPT_NAME) {
          console.log('[e2e] deepspace-sdk-test.app.space is live')
          return
        }
      }
    } catch { /* not ready */ }
    await new Promise((r) => setTimeout(r, POLL_MS))
  }

  throw new Error(`deepspace-sdk-test.app.space did not become reachable within ${MAX_WAIT_MS / 1000}s`)
}
