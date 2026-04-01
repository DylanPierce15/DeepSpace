/**
 * Playwright global setup — deploy deepspace-sdk-test to spaces-apps dispatch
 * namespace using the Cloudflare REST API (same method as Miyagi3's deployer).
 *
 * Bundles the TypeScript worker with esbuild before uploading.
 */

import { resolve } from 'node:path'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { getApiToken, deployScript, deleteScript, scriptExists } from './cloudflare-api.js'

const SCRIPT_NAME = 'deepspace-sdk-test'
const APP_URL = 'https://deepspace-sdk-test.app.space'
const MAX_WAIT_MS = 30_000
const POLL_MS = 2_000

export default async function globalSetup() {
  const token = getApiToken()

  // Clean up any leftover from a previous failed run
  if (await scriptExists(SCRIPT_NAME, token)) {
    console.log('[e2e] Cleaning up leftover deepspace-sdk-test...')
    await deleteScript(SCRIPT_NAME, token)
    await new Promise((r) => setTimeout(r, 3_000))
  }

  // Bundle TS → JS with esbuild (same as wrangler does internally)
  const workerTs = resolve(import.meta.dirname, '../test-app/worker.ts')
  const outfile = resolve(import.meta.dirname, '../test-app/.worker-bundle.js')

  execSync(
    `npx esbuild ${workerTs} --bundle --format=esm --outfile=${outfile} --target=esnext`,
    { stdio: 'inherit' },
  )

  const workerSource = readFileSync(outfile, 'utf-8')

  console.log('[e2e] Deploying deepspace-sdk-test via Cloudflare REST API...')
  const result = await deployScript(SCRIPT_NAME, workerSource, token)

  if (!result.success) {
    console.error('[e2e] Deploy failed:', JSON.stringify(result.errors, null, 2))
    throw new Error('Failed to deploy deepspace-sdk-test')
  }

  console.log('[e2e] Deployed. Waiting for deepspace-sdk-test.app.space...')

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
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, POLL_MS))
  }

  throw new Error(`deepspace-sdk-test.app.space did not become reachable within ${MAX_WAIT_MS / 1000}s`)
}
