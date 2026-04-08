/**
 * Global setup — ensure the E2E test user exists and save auth state.
 *
 * The test user (e2e-test@deepspace.test) should already exist from a prior
 * `deepspace test-accounts create` or from the run.ts login step.
 * This setup signs in and saves JWT + session for the test fixtures.
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const AUTH_URL = 'https://deepspace-auth.eudaimonicincorporated.workers.dev'
const SESSION_COOKIE_NAME = '__Secure-better-auth.session_token'
const STATE_PATH = resolve(import.meta.dirname, '../.auth-state.json')

const TEST_USER = {
  email: 'e2e-test@deepspace.test',
  password: 'TestPass123!',
}

export default async function globalSetup() {
  console.log('[e2e] Signing in test user...')

  const signInRes = await fetch(`${AUTH_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: AUTH_URL },
    body: JSON.stringify(TEST_USER),
    redirect: 'manual',
  })

  if (!signInRes.ok) {
    const text = await signInRes.text()
    throw new Error(
      `Sign-in failed (${signInRes.status}): ${text}\n` +
      'Ensure the test user exists: deepspace test-accounts create --email e2e-test@deepspace.test --password TestPass123!',
    )
  }

  const body = (await signInRes.json()) as { user?: { id: string } }
  if (!body.user?.id) throw new Error('No user ID in sign-in response')

  const setCookie = signInRes.headers.get('set-cookie') ?? ''
  const match = setCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))
  if (!match) throw new Error('No session cookie in sign-in response')

  const sessionToken = decodeURIComponent(match[1])

  // Get JWT
  const tokenRes = await fetch(`${AUTH_URL}/api/auth/token`, {
    method: 'POST',
    headers: {
      Cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`,
      Origin: AUTH_URL,
    },
  })

  if (!tokenRes.ok) throw new Error(`JWT issuance failed: ${tokenRes.status}`)
  const { token: jwt } = (await tokenRes.json()) as { token: string }

  const state = { sessionToken, jwt, userId: body.user.id }
  writeFileSync(STATE_PATH, JSON.stringify(state))
  console.log(`[e2e] Authenticated as ${body.user.id}`)
}
