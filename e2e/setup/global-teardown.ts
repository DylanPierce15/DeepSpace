/**
 * Playwright global teardown — remove deepspace-sdk-test from dispatch namespace.
 */

import { getApiToken, deleteScript } from './cloudflare-api.js'

const SCRIPT_NAME = 'deepspace-sdk-test'

export default async function globalTeardown() {
  console.log(`[e2e] Removing ${SCRIPT_NAME} from dispatch namespace...`)

  try {
    const token = getApiToken()
    const result = await deleteScript(SCRIPT_NAME, token)

    if (result.success) {
      console.log(`[e2e] ${SCRIPT_NAME} deleted`)
    } else {
      console.warn(`[e2e] Teardown response:`, JSON.stringify(result.errors))
    }
  } catch (err) {
    console.warn('[e2e] Teardown error:', err)
  }
}
