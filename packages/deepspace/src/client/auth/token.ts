/**
 * JWT Token Provider
 *
 * Fetches short-lived ES256 JWTs from the auth-worker for WebSocket
 * and API authentication. Tokens are cached and auto-refreshed.
 *
 * This replaces Clerk's getToken() and the old widgetAuth postMessage system.
 */

// Token is fetched via same-origin /api/auth/token — the app's worker (or Vite proxy)
// routes this to the auth-worker. No cross-origin requests needed.

import { parseSafeResponse } from '../../shared/safe-response'

let cachedToken: string | null = null
let tokenExpiry = 0

function extractExpiry(token: string): number {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return 0
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return (payload.exp ?? 0) * 1000
  } catch {
    return 0
  }
}

/**
 * Get a short-lived JWT for WebSocket and API calls.
 *
 * The token is obtained from the auth-worker's /api/auth/token endpoint,
 * authenticated via the Better Auth session cookie. Tokens are cached
 * and refreshed 30s before expiry.
 */
export async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null

  // Return cached token if still valid (30s buffer)
  if (cachedToken && Date.now() < tokenExpiry - 30_000) {
    return cachedToken
  }

  try {
    const res = await fetch('/api/auth/token', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })

    // Workers use the safeJson convention: always HTTP 200, real status in
    // body.status. Required to avoid a @cloudflare/vite-plugin bug that
    // crashes dev on non-2xx POST responses.
    const { data, ok } = await parseSafeResponse<{ token?: string | null }>(res)

    if (!ok || !data.token) {
      cachedToken = null
      tokenExpiry = 0
      return null
    }

    cachedToken = data.token
    tokenExpiry = extractExpiry(data.token)
    return data.token
  } catch {
    return null
  }
}

/** Clear cached token (call on sign-out). */
export function clearAuthToken(): void {
  cachedToken = null
  tokenExpiry = 0
}
