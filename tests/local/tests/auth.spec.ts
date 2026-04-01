/**
 * Local: Auth worker running on localhost:8794.
 */

import { test, expect, AUTH_URL } from './fixtures'

test.describe('Auth worker (local)', () => {
  test('health check', async ({ request }) => {
    const res = await request.get(`${AUTH_URL}/health`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  test('sign-in returns session and user', async ({ request }) => {
    const res = await request.post(`${AUTH_URL}/api/auth/sign-in/email`, {
      data: {
        email: 'local-test@deepspace.test',
        password: 'LocalTestPass123!',
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.user.email).toBe('local-test@deepspace.test')
    expect(body.user.id).toBeTruthy()
  })

  test('token endpoint returns JWT with correct claims', async ({ auth, request }) => {
    // auth.sessionToken is already the full cookie header from sign-up
    const res = await request.post(`${AUTH_URL}/api/auth/token`, {
      headers: {
        Cookie: auth.sessionToken,
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.token).toBeTruthy()

    const parts = body.token.split('.')
    expect(parts).toHaveLength(3)

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    expect(payload.sub).toBe(auth.userId)
    expect(payload.exp).toBeGreaterThan(Date.now() / 1000)
  })
})
