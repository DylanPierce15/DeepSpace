/**
 * E2E: Auth worker — health, sign-in, sign-up blocked, JWT issuance, test accounts.
 *
 * These tests run against the live deployed auth worker.
 * No app deployment needed — all API-level.
 */

import { test, expect, AUTH_URL, SESSION_COOKIE_NAME } from './fixtures'

// ============================================================================
// Health
// ============================================================================

test.describe('Auth worker health', () => {
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
})

// ============================================================================
// Public signup blocked
// ============================================================================

test.describe('Public email/password signup disabled', () => {
  test('POST /api/auth/sign-up/email returns 403', async ({ request }) => {
    const res = await request.post(`${AUTH_URL}/api/auth/sign-up/email`, {
      data: {
        email: 'should-not-exist@example.com',
        password: 'ShouldFail123!',
        name: 'Should Not Exist',
      },
    })
    const body = await res.json()
    expect(body.status).toBe(403)
    expect(body.error).toContain('signup disabled')
  })

  test('blocked even with @deepspace.test email', async ({ request }) => {
    const res = await request.post(`${AUTH_URL}/api/auth/sign-up/email`, {
      data: {
        email: `blocked-${Date.now()}@deepspace.test`,
        password: 'ShouldFail123!',
        name: 'Blocked',
      },
    })
    const body = await res.json()
    expect(body.status).toBe(403)
  })
})

// ============================================================================
// Email/password sign-in (still works for test accounts)
// ============================================================================

test.describe('Email/password sign-in', () => {
  test('sign-in with test user succeeds', async ({ request }) => {
    const res = await request.post(`${AUTH_URL}/api/auth/sign-in/email`, {
      data: { email: 'e2e-test@deepspace.test', password: 'TestPass123!' },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.user.email).toBe('e2e-test@deepspace.test')
    expect(body.user.id).toBeTruthy()
  })

  test('wrong password fails', async ({ request }) => {
    const res = await request.post(`${AUTH_URL}/api/auth/sign-in/email`, {
      data: { email: 'e2e-test@deepspace.test', password: 'WrongPassword!' },
    })
    expect(res.ok()).toBeFalsy()
  })

  test('non-existent user fails', async ({ request }) => {
    const res = await request.post(`${AUTH_URL}/api/auth/sign-in/email`, {
      data: { email: 'nobody@deepspace.test', password: 'DoesntMatter123!' },
    })
    expect(res.ok()).toBeFalsy()
  })
})

// ============================================================================
// JWT issuance
// ============================================================================

test.describe('JWT token endpoint', () => {
  test('returns valid JWT with correct claims', async ({ auth, request }) => {
    const res = await request.post(`${AUTH_URL}/api/auth/token`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}` },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()

    const parts = body.token.split('.')
    expect(parts).toHaveLength(3)

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    expect(payload.sub).toBe(auth.userId)
    expect(payload.email).toBe('e2e-test@deepspace.test')
    expect(payload.iss).toContain('deepspace-auth')
    expect(payload.exp).toBeGreaterThan(Date.now() / 1000)
  })

  test('returns 401 without session', async ({ request }) => {
    const res = await request.post(`${AUTH_URL}/api/auth/token`)
    const body = await res.json()
    expect(body.status).toBe(401)
  })
})

// ============================================================================
// Test account CRUD
// ============================================================================

test.describe('Test account management', () => {
  const cleanup: string[] = []

  test.afterAll(async ({ request }) => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const state = JSON.parse(readFileSync(resolve(import.meta.dirname, '../.auth-state.json'), 'utf-8'))
    for (const id of cleanup) {
      await request.delete(`${AUTH_URL}/api/auth/test-accounts/${id}`, {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${state.sessionToken}` },
      })
    }
  })

  test('create test account', async ({ auth, request }) => {
    const email = `e2e-crud-${Date.now()}@deepspace.test`
    const res = await request.post(`${AUTH_URL}/api/auth/test-accounts`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}` },
      data: { email, password: 'CrudTest123!', name: 'CRUD Test', label: 'e2e' },
    })
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.id).toBeTruthy()
    expect(body.email).toBe(email)
    expect(body.userId).toBeTruthy()
    expect(body.label).toBe('e2e')
    cleanup.push(body.id)
  })

  test('created account can sign in', async ({ auth, request }) => {
    const email = `e2e-login-${Date.now()}@deepspace.test`
    const createRes = await request.post(`${AUTH_URL}/api/auth/test-accounts`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}` },
      data: { email, password: 'LoginTest123!', name: 'Login Test' },
    })
    expect(createRes.status()).toBe(201)
    cleanup.push((await createRes.json()).id)

    const signInRes = await request.post(`${AUTH_URL}/api/auth/sign-in/email`, {
      data: { email, password: 'LoginTest123!' },
    })
    expect(signInRes.ok()).toBeTruthy()
    expect((await signInRes.json()).user.email).toBe(email)
  })

  test('list test accounts', async ({ auth, request }) => {
    const res = await request.get(`${AUTH_URL}/api/auth/test-accounts`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}` },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(Array.isArray(body.accounts)).toBe(true)
    expect(body.accounts.length).toBeGreaterThan(0)

    for (const a of body.accounts) {
      expect(a.email).toContain('@deepspace.test')
      expect(a.userId).toBeTruthy()
    }
  })

  test('delete test account', async ({ auth, request }) => {
    const email = `e2e-del-${Date.now()}@deepspace.test`
    const createRes = await request.post(`${AUTH_URL}/api/auth/test-accounts`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}` },
      data: { email, password: 'DeleteTest123!', name: 'Delete Test' },
    })
    const { id } = await createRes.json()

    const delRes = await request.delete(`${AUTH_URL}/api/auth/test-accounts/${id}`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}` },
    })
    expect(delRes.ok()).toBeTruthy()
    expect((await delRes.json()).deleted).toBe(true)

    // Verify gone from list
    const listRes = await request.get(`${AUTH_URL}/api/auth/test-accounts`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}` },
    })
    const accounts = (await listRes.json()).accounts
    expect(accounts.find((a: any) => a.id === id)).toBeUndefined()
  })

  test('deleted account cannot sign in', async ({ auth, request }) => {
    const email = `e2e-delsignin-${Date.now()}@deepspace.test`
    const createRes = await request.post(`${AUTH_URL}/api/auth/test-accounts`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}` },
      data: { email, password: 'DelSignIn123!', name: 'Del SignIn Test' },
    })
    const { id } = await createRes.json()

    await request.delete(`${AUTH_URL}/api/auth/test-accounts/${id}`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}` },
    })

    const signInRes = await request.post(`${AUTH_URL}/api/auth/sign-in/email`, {
      data: { email, password: 'DelSignIn123!' },
    })
    expect(signInRes.ok()).toBeFalsy()
  })

  test('delete non-existent returns 404', async ({ auth, request }) => {
    const res = await request.delete(`${AUTH_URL}/api/auth/test-accounts/non-existent`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}` },
    })
    const body = await res.json()
    expect(body.status).toBe(404)
  })
})

// ============================================================================
// Test account validation
// ============================================================================

test.describe('Test account validation', () => {
  test('reject non-@deepspace.test email', async ({ auth, request }) => {
    const res = await request.post(`${AUTH_URL}/api/auth/test-accounts`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}` },
      data: { email: 'bad@example.com', password: 'TestBad123!', name: 'Bad' },
    })
    const body = await res.json()
    expect(body.status).toBe(400)
    expect(body.error).toContain('@deepspace.test')
  })

  test('reject short password', async ({ auth, request }) => {
    const res = await request.post(`${AUTH_URL}/api/auth/test-accounts`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}` },
      data: { email: `short-${Date.now()}@deepspace.test`, password: 'short', name: 'Short' },
    })
    const body = await res.json()
    expect(body.status).toBe(400)
    expect(body.error).toContain('8 characters')
  })

  test('unauthenticated requests return 401', async ({ request }) => {
    const create = await request.post(`${AUTH_URL}/api/auth/test-accounts`, {
      data: { email: 'x@deepspace.test', password: 'Unauth123!' },
    })
    expect((await create.json()).status).toBe(401)

    const list = await request.get(`${AUTH_URL}/api/auth/test-accounts`)
    expect((await list.json()).status).toBe(401)

    const del = await request.delete(`${AUTH_URL}/api/auth/test-accounts/x`)
    expect((await del.json()).status).toBe(401)
  })
})

// ============================================================================
// JWT isTestAccount claim for freshly-created test accounts
// ============================================================================

test.describe('Test account JWT claims', () => {
  let accountId: string
  let accountSession: string

  test.beforeAll(async ({ request }) => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const state = JSON.parse(readFileSync(resolve(import.meta.dirname, '../.auth-state.json'), 'utf-8'))

    const email = `e2e-jwt-${Date.now()}@deepspace.test`

    const createRes = await request.post(`${AUTH_URL}/api/auth/test-accounts`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${state.sessionToken}` },
      data: { email, password: 'JwtTest123!', name: 'JWT Test', label: 'jwt-test' },
    })
    const created = await createRes.json()
    accountId = created.id

    const signInRes = await request.post(`${AUTH_URL}/api/auth/sign-in/email`, {
      data: { email, password: 'JwtTest123!' },
    })
    const setCookie = signInRes.headers()['set-cookie'] ?? ''
    const match = setCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))
    accountSession = match ? decodeURIComponent(match[1]) : ''
  })

  test.afterAll(async ({ request }) => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const state = JSON.parse(readFileSync(resolve(import.meta.dirname, '../.auth-state.json'), 'utf-8'))
    if (accountId) {
      await request.delete(`${AUTH_URL}/api/auth/test-accounts/${accountId}`, {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${state.sessionToken}` },
      })
    }
  })

  test('JWT includes isTestAccount: true', async ({ request }) => {
    const res = await request.post(`${AUTH_URL}/api/auth/token`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${accountSession}` },
    })
    expect(res.ok()).toBeTruthy()
    const payload = JSON.parse(Buffer.from((await res.json()).token.split('.')[1], 'base64url').toString())
    expect(payload.isTestAccount).toBe(true)
  })
})
