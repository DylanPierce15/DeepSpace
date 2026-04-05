/**
 * Local test global setup.
 *
 * 1. Waits for local workers to be reachable
 * 2. Ensures a test user exists on the local auth-worker
 * 3. Saves auth state for test fixtures
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const AUTH_URL = 'http://localhost:8794'
const PLATFORM_URL = 'http://localhost:8792'
const APP_URL = 'http://localhost:5173'

const TEST_USER = {
  email: 'local-test@deepspace.test',
  password: 'LocalTestPass123!',
  name: 'Local Test User',
}

const TEST_USER_2 = {
  email: 'local-test-2@deepspace.test',
  password: 'LocalTestPass456!',
  name: 'Second Test User',
}

const STATE_PATH = resolve(import.meta.dirname, '../.auth-state.json')

async function waitForService(url: string, name: string, timeoutMs = 15_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
      if (res.ok) {
        console.log(`[local] ${name} ready`)
        return
      }
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`${name} not reachable at ${url} after ${timeoutMs}ms`)
}

/** Extract the raw cookie string from a set-cookie header for forwarding */
function extractCookieHeader(res: Response): string {
  const setCookie = res.headers.get('set-cookie') ?? ''
  // Extract "name=value" pairs, strip attributes like Path, HttpOnly, etc.
  return setCookie
    .split(',')
    .map((part) => part.split(';')[0].trim())
    .filter((part) => part.includes('='))
    .join('; ')
}

async function ensureUser(
  creds: { email: string; password: string; name: string }
): Promise<{ sessionToken: string; jwt: string; userId: string }> {
  // Try sign-up
  let res = await fetch(`${AUTH_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: AUTH_URL },
    body: JSON.stringify(creds),
    redirect: 'manual',
  })

  if (!res.ok) {
    const signUpError = await res.clone().text()
    console.log(`[local] Sign-up returned ${res.status} for ${creds.email}: ${signUpError}`)
    // User exists — sign in
    res = await fetch(`${AUTH_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: AUTH_URL },
      body: JSON.stringify({ email: creds.email, password: creds.password }),
      redirect: 'manual',
    })
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Auth failed for ${creds.email}: ${res.status} ${text}`)
  }

  const body = (await res.json()) as { user?: { id: string } }
  if (!body.user?.id) throw new Error(`No user ID in auth response for ${creds.email}`)

  // Forward the raw session cookies to the token endpoint
  const cookieHeader = extractCookieHeader(res)
  if (!cookieHeader) throw new Error(`No session cookie for ${creds.email}`)

  const tokenRes = await fetch(`${AUTH_URL}/api/auth/token`, {
    method: 'POST',
    headers: { Cookie: cookieHeader, Origin: AUTH_URL },
  })

  if (!tokenRes.ok) {
    const text = await tokenRes.text()
    throw new Error(`Failed to get JWT for ${creds.email}: ${tokenRes.status} ${text}`)
  }

  const tokenBody = (await tokenRes.json()) as { token?: string }
  if (!tokenBody.token) throw new Error(`No token for ${creds.email}`)

  return { sessionToken: cookieHeader, jwt: tokenBody.token, userId: body.user.id }
}

async function migrateAuthDb() {
  const res = await fetch(`${AUTH_URL}/_migrate`, { method: 'POST' })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Auth DB migration failed: ${res.status} ${text}`)
  }
  console.log('[local] Auth DB migrated')
}

export default async function globalSetup() {
  console.log('[local] Checking services...')
  await waitForService(`${AUTH_URL}/health`, 'auth-worker')
  await waitForService(`${PLATFORM_URL}/api/health`, 'platform-worker')
  await waitForService(APP_URL, 'starter app')

  console.log('[local] Running auth DB migration...')
  await migrateAuthDb()

  console.log('[local] Ensuring test users...')
  const auth = await ensureUser(TEST_USER)
  console.log(`[local] User 1 authenticated as ${auth.userId}`)

  const auth2 = await ensureUser(TEST_USER_2)
  console.log(`[local] User 2 authenticated as ${auth2.userId}`)

  writeFileSync(STATE_PATH, JSON.stringify({ user1: auth, user2: auth2 }))
}
