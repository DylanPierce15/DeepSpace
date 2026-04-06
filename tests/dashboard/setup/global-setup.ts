/**
 * Dashboard test global setup.
 *
 * 1. Waits for workers and dashboard to be reachable
 * 2. Migrates auth DB + creates test users
 * 3. Seeds R2 with test app registry entries
 * 4. Saves auth state for test fixtures
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const AUTH_URL = 'http://localhost:8794'
const API_URL = 'http://localhost:8795'
const DEPLOY_URL = 'http://localhost:8796'
const DASHBOARD_URL = 'http://localhost:5174'

const TEST_USER = {
  email: 'dashboard-test@deepspace.test',
  password: 'DashTestPass123!',
  name: 'Dashboard Test User',
}

const STATE_PATH = resolve(import.meta.dirname, '../.auth-state.json')

async function waitForService(url: string, name: string, timeoutMs = 20_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
      if (res.ok) {
        console.log(`[dashboard] ${name} ready`)
        return
      }
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`${name} not reachable at ${url} after ${timeoutMs}ms`)
}

function extractCookieHeader(res: Response): string {
  const setCookie = res.headers.get('set-cookie') ?? ''
  return setCookie
    .split(',')
    .map((part) => part.split(';')[0].trim())
    .filter((part) => part.includes('='))
    .join('; ')
}

async function ensureUser(): Promise<{ sessionToken: string; jwt: string; userId: string }> {
  // Try sign-up first
  let res = await fetch(`${AUTH_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: AUTH_URL },
    body: JSON.stringify(TEST_USER),
    redirect: 'manual',
  })

  if (!res.ok) {
    // User exists — sign in
    res = await fetch(`${AUTH_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: AUTH_URL },
      body: JSON.stringify({ email: TEST_USER.email, password: TEST_USER.password }),
      redirect: 'manual',
    })
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Auth failed: ${res.status} ${text}`)
  }

  const body = (await res.json()) as { user?: { id: string } }
  if (!body.user?.id) throw new Error('No user ID in auth response')

  const cookieHeader = extractCookieHeader(res)
  if (!cookieHeader) throw new Error('No session cookie returned')

  const tokenRes = await fetch(`${AUTH_URL}/api/auth/token`, {
    method: 'POST',
    headers: { Cookie: cookieHeader, Origin: AUTH_URL },
  })

  if (!tokenRes.ok) {
    const text = await tokenRes.text()
    throw new Error(`Failed to get JWT: ${tokenRes.status} ${text}`)
  }

  const tokenBody = (await tokenRes.json()) as { token?: string }
  if (!tokenBody.token) throw new Error('No token in response')

  return { sessionToken: cookieHeader, jwt: tokenBody.token, userId: body.user.id }
}

async function seedTestApps(jwt: string, userId: string) {
  const apps = [
    { appId: 'test-app-one', ownerUserId: userId, deployedAt: '2026-03-15T10:00:00.000Z' },
    { appId: 'test-app-two', ownerUserId: userId, deployedAt: '2026-04-01T14:30:00.000Z' },
  ]

  for (const app of apps) {
    const res = await fetch(`${DEPLOY_URL}/_test/seed-app`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(app),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error(`[dashboard] Failed to seed ${app.appId}: ${text}`)
    } else {
      console.log(`[dashboard] Seeded app: ${app.appId}`)
    }
  }
}

async function migrateAuthDb() {
  const res = await fetch(`${AUTH_URL}/_migrate`, { method: 'POST' })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Auth DB migration failed: ${res.status} ${text}`)
  }
  console.log('[dashboard] Auth DB migrated')
}

export default async function globalSetup() {
  console.log('[dashboard] Checking services...')
  await waitForService(`${AUTH_URL}/health`, 'auth-worker')
  await waitForService(`${API_URL}/api/health`, 'api-worker')
  await waitForService(`${DEPLOY_URL}/api/health`, 'deploy-worker')
  await waitForService(DASHBOARD_URL, 'dashboard')

  console.log('[dashboard] Running auth DB migration...')
  await migrateAuthDb()

  console.log('[dashboard] Ensuring test user...')
  const auth = await ensureUser()
  console.log(`[dashboard] Authenticated as ${auth.userId}`)

  console.log('[dashboard] Seeding test apps...')
  await seedTestApps(auth.jwt, auth.userId)

  writeFileSync(STATE_PATH, JSON.stringify(auth))
}
