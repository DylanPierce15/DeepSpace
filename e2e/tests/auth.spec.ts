/**
 * E2E: Auth worker — sign-up, sign-in, JWT issuance.
 */

import { test, expect, AUTH_URL } from './fixtures'

test.describe('Auth worker', () => {
  test('GET /health returns ok', async ({ request }) => {
    const res = await request.get(`${AUTH_URL}/health`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.service).toBe('deepspace-auth')
  })

  test('GET /api/auth/ok returns Better Auth health', async ({ request }) => {
    const res = await request.get(`${AUTH_URL}/api/auth/ok`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  test('sign-in with test user returns session token', async ({ request }) => {
    const res = await request.post(`${AUTH_URL}/api/auth/sign-in/email`, {
      data: {
        email: 'e2e-test@deepspace.test',
        password: 'TestPass123!',
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.token).toBeTruthy()
    expect(body.user.email).toBe('e2e-test@deepspace.test')
    expect(body.user.name).toBe('E2E Test User')
    expect(body.user.id).toBeTruthy()
  })

  test('sign-in with wrong password returns error', async ({ request }) => {
    const res = await request.post(`${AUTH_URL}/api/auth/sign-in/email`, {
      data: {
        email: 'e2e-test@deepspace.test',
        password: 'WrongPassword!',
      },
    })
    expect(res.ok()).toBeFalsy()
  })

  test('POST /api/auth/token with session returns JWT', async ({ auth, request }) => {
    const cookieName = '__Secure-better-auth.session_token'
    const res = await request.post(`${AUTH_URL}/api/auth/token`, {
      headers: {
        Cookie: `${cookieName}=${auth.sessionToken}`,
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.token).toBeTruthy()

    // JWT should be a valid 3-part string
    const parts = body.token.split('.')
    expect(parts).toHaveLength(3)

    // Decode payload and check claims
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    expect(payload.sub).toBe(auth.userId)
    expect(payload.email).toBe('e2e-test@deepspace.test')
    expect(payload.name).toBe('E2E Test User')
    expect(payload.iss).toContain('deepspace-auth')
    expect(payload.exp).toBeGreaterThan(Date.now() / 1000)
  })

  test('POST /api/auth/token without session returns 401', async ({ request }) => {
    const res = await request.post(`${AUTH_URL}/api/auth/token`)
    expect(res.status()).toBe(401)
  })
})
