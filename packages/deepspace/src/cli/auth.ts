/**
 * CLI auth utilities — shared across all commands.
 *
 * Reads the session token from ~/.deepspace/session and ensures
 * a fresh JWT is available at ~/.deepspace/token.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

import { ENVS } from './env'

const AUTH_URL = process.env.DEEPSPACE_AUTH_URL ?? ENVS.prod.auth

const DIR = join(homedir(), '.deepspace')
export const SESSION_PATH = join(DIR, 'session')
const TOKEN_PATH = join(DIR, 'token')

/**
 * Ensure a valid JWT exists. Refreshes from the session token if expired.
 * Returns the JWT string or throws if not logged in / session expired.
 */
export async function ensureToken(): Promise<string> {
  if (!existsSync(SESSION_PATH)) {
    throw new Error('Not logged in. Run `deepspace login` first.')
  }

  const sessionToken = readFileSync(SESSION_PATH, 'utf-8').trim()

  // Try existing token first — if it's still valid, skip the refresh
  if (existsSync(TOKEN_PATH)) {
    const existing = readFileSync(TOKEN_PATH, 'utf-8').trim()
    if (isTokenValid(existing)) {
      return existing
    }
  }

  // Refresh from session
  const token = await exchangeSession(AUTH_URL, sessionToken)
  if (!token) {
    throw new Error('Session expired. Run `deepspace login` to re-authenticate.')
  }

  mkdirSync(DIR, { recursive: true })
  writeFileSync(TOKEN_PATH, token, { mode: 0o600 })

  return token
}

const SESSION_COOKIE = '__Secure-better-auth.session_token'

async function exchangeSession(authUrl: string, sessionToken: string): Promise<string | null> {
  const res = await fetch(`${authUrl}/api/auth/token`, {
    method: 'POST',
    headers: {
      Cookie: `${SESSION_COOKIE}=${encodeURIComponent(sessionToken)}`,
      Origin: authUrl,
    },
  })
  if (!res.ok) return null
  const data = (await res.json()) as { token?: string | null }
  return data.token ?? null
}

/** Check if a JWT has at least 30 seconds of validity remaining. */
function isTokenValid(jwt: string): boolean {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1]))
    return payload.exp * 1000 > Date.now() + 30_000
  } catch {
    return false
  }
}
