/**
 * Owner JWT — exchanges a session token for a fresh JWT.
 *
 * Used by the integration proxy to authenticate developer-billed
 * API calls against the prod API worker.
 *
 * Caches the JWT for 4 minutes (expires in 5) to avoid redundant
 * round-trips to the auth worker on every integration call.
 *
 * Usage in worker.ts:
 *   import { getOwnerJwt } from 'deepspace/worker'
 *   const jwt = await getOwnerJwt(env)
 */

import { exchangeSessionForJwt } from '../../shared/auth-utils'

let cachedJwt: string | null = null
let cachedExp = 0

export async function getOwnerJwt(env: {
  OWNER_SESSION_TOKEN?: string
  OWNER_AUTH_URL?: string
}): Promise<string | null> {
  if (cachedJwt && Date.now() < cachedExp) return cachedJwt
  if (!env.OWNER_SESSION_TOKEN || !env.OWNER_AUTH_URL) return null

  try {
    const token = await exchangeSessionForJwt(env.OWNER_AUTH_URL, env.OWNER_SESSION_TOKEN)
    if (!token) return null
    cachedJwt = token
    cachedExp = Date.now() + 4 * 60 * 1000
    return token
  } catch (err) {
    console.warn('[getOwnerJwt] Failed to refresh owner JWT:', err instanceof Error ? err.message : err)
    return null
  }
}
