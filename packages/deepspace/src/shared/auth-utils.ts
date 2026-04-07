/**
 * Shared auth utilities — used by both CLI (Node) and worker (Cloudflare Workers).
 */

import { SESSION_COOKIE } from './constants'

/**
 * Exchange a Better Auth session token for a fresh JWT.
 * Returns null if the session is invalid or expired.
 */
export async function exchangeSessionForJwt(
  authUrl: string,
  sessionToken: string,
): Promise<string | null> {
  const res = await fetch(`${authUrl}/api/auth/token`, {
    method: 'POST',
    headers: {
      Cookie: `${SESSION_COOKIE}=${encodeURIComponent(sessionToken)}`,
      Origin: authUrl,
    },
  })
  if (!res.ok) return null
  const { token } = (await res.json()) as { token: string }
  return token
}
