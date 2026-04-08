/**
 * E2E: Auth worker — sign-in, JWT issuance, public signup blocked, test accounts.
 */

import { test, expect, AUTH_URL } from './fixtures'

const SESSION_COOKIE_NAME = '__Secure-better-auth.session_token'

// ============================================================================
// Health checks
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
    expect(res.status()).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('signup disabled')
  })

  test('sign-up blocked even with @deepspace.test email', async ({ request }) => {
    const res = await request.post(`${AUTH_URL}/api/auth/sign-up/email`, {
      data: {
        email: `blocked-${Date.now()}@deepspace.test`,
        password: 'ShouldFail123!',
        name: 'Blocked User',
      },
    })
    expect(res.status()).toBe(403)
  })
})

// ============================================================================
// Email/password sign-in (still works)
// ============================================================================

test.describe('Email/password sign-in', () => {
  test('sign-in with test user returns session', async ({ request }) => {
    const res = await request.post(`${AUTH_URL}/api/auth/sign-in/email`, {
      data: {
        email: 'e2e-test@deepspace.test',
        password: 'TestPass123!',
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
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

  test('sign-in with non-existent user returns error', async ({ request }) => {
    const res = await request.post(`${AUTH_URL}/api/auth/sign-in/email`, {
      data: {
        email: 'nobody@deepspace.test',
        password: 'DoesntMatter123!',
      },
    })
    expect(res.ok()).toBeFalsy()
  })
})

// ============================================================================
// JWT issuance
// ============================================================================

test.describe('JWT token endpoint', () => {
  test('POST /api/auth/token with session returns valid JWT', async ({ auth, request }) => {
    const res = await request.post(`${AUTH_URL}/api/auth/token`, {
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}`,
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

  test('JWT for E2E test user includes isTestAccount claim', async ({ auth, request }) => {
    const res = await request.post(`${AUTH_URL}/api/auth/token`, {
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}`,
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    const payload = JSON.parse(Buffer.from(body.token.split('.')[1], 'base64url').toString())
    expect(payload.isTestAccount).toBe(true)
  })
})

// ============================================================================
// Test account CRUD
// ============================================================================

test.describe('Test account management', () => {
  // Track accounts created during this test run for cleanup
  const createdIds: string[] = []

  test.afterAll(async ({ request }) => {
    // Load auth state for cleanup
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const statePath = resolve(import.meta.dirname, '../.auth-state.json')
    const auth = JSON.parse(readFileSync(statePath, 'utf-8'))

    for (const id of createdIds) {
      await request.delete(`${AUTH_URL}/api/auth/test-accounts/${id}`, {
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}`,
        },
      })
    }
  })

  test('create test account with valid @deepspace.test email', async ({ auth, request }) => {
    const email = `e2e-create-${Date.now()}@deepspace.test`
    const res = await request.post(`${AUTH_URL}/api/auth/test-accounts`, {
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}`,
      },
      data: {
        email,
        password: 'TestCreate123!',
        name: 'E2E Created Account',
        label: 'e2e-test',
      },
    })
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.id).toBeTruthy()
    expect(body.email).toBe(email)
    expect(body.userId).toBeTruthy()
    expect(body.label).toBe('e2e-test')
    expect(body.createdAt).toBeGreaterThan(0)
    createdIds.push(body.id)
  })

  test('created test account can sign in with email/password', async ({ auth, request }) => {
    const email = `e2e-signin-${Date.now()}@deepspace.test`
    const createRes = await request.post(`${AUTH_URL}/api/auth/test-accounts`, {
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}`,
      },
      data: {
        email,
        password: 'TestSignIn123!',
        name: 'Sign-In Test',
      },
    })
    expect(createRes.status()).toBe(201)
    const created = await createRes.json()
    createdIds.push(created.id)

    // Now sign in with the test account
    const signInRes = await request.post(`${AUTH_URL}/api/auth/sign-in/email`, {
      data: { email, password: 'TestSignIn123!' },
    })
    expect(signInRes.ok()).toBeTruthy()
    const signInBody = await signInRes.json()
    expect(signInBody.user.email).toBe(email)
  })

  test('list test accounts returns created accounts', async ({ auth, request }) => {
    const res = await request.get(`${AUTH_URL}/api/auth/test-accounts`, {
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}`,
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.accounts).toBeDefined()
    expect(Array.isArray(body.accounts)).toBe(true)
    // Should have at least the E2E test user
    expect(body.accounts.length).toBeGreaterThan(0)

    for (const account of body.accounts) {
      expect(account.id).toBeTruthy()
      expect(account.email).toContain('@deepspace.test')
      expect(account.userId).toBeTruthy()
      expect(account.createdAt).toBeGreaterThan(0)
    }
  })

  test('delete test account succeeds', async ({ auth, request }) => {
    // Create one to delete
    const email = `e2e-delete-${Date.now()}@deepspace.test`
    const createRes = await request.post(`${AUTH_URL}/api/auth/test-accounts`, {
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}`,
      },
      data: {
        email,
        password: 'TestDelete123!',
        name: 'Delete Test',
      },
    })
    expect(createRes.status()).toBe(201)
    const created = await createRes.json()

    // Delete it
    const deleteRes = await request.delete(
      `${AUTH_URL}/api/auth/test-accounts/${created.id}`,
      {
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}`,
        },
      },
    )
    expect(deleteRes.ok()).toBeTruthy()
    const deleteBody = await deleteRes.json()
    expect(deleteBody.deleted).toBe(true)

    // Verify it's gone from the list
    const listRes = await request.get(`${AUTH_URL}/api/auth/test-accounts`, {
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}`,
      },
    })
    const listBody = await listRes.json()
    const found = listBody.accounts.find((a: any) => a.id === created.id)
    expect(found).toBeUndefined()
  })

  test('delete non-existent test account returns 404', async ({ auth, request }) => {
    const res = await request.delete(
      `${AUTH_URL}/api/auth/test-accounts/non-existent-id`,
      {
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}`,
        },
      },
    )
    expect(res.status()).toBe(404)
  })
})

// ============================================================================
// Test account validation
// ============================================================================

test.describe('Test account validation', () => {
  const createdIds: string[] = []

  test.afterAll(async ({ request }) => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const statePath = resolve(import.meta.dirname, '../.auth-state.json')
    const auth = JSON.parse(readFileSync(statePath, 'utf-8'))

    for (const id of createdIds) {
      await request.delete(`${AUTH_URL}/api/auth/test-accounts/${id}`, {
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}`,
        },
      })
    }
  })

  test('reject non-@deepspace.test email', async ({ auth, request }) => {
    const res = await request.post(`${AUTH_URL}/api/auth/test-accounts`, {
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}`,
      },
      data: {
        email: 'bad@example.com',
        password: 'TestBad123!',
        name: 'Bad Email',
      },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('@deepspace.test')
  })

  test('reject password shorter than 8 characters', async ({ auth, request }) => {
    const res = await request.post(`${AUTH_URL}/api/auth/test-accounts`, {
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}`,
      },
      data: {
        email: `e2e-short-${Date.now()}@deepspace.test`,
        password: 'short',
        name: 'Short Password',
      },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('8 characters')
  })

  test('reject duplicate email for same developer', async ({ auth, request }) => {
    const email = `e2e-dup-${Date.now()}@deepspace.test`

    // Create first
    const res1 = await request.post(`${AUTH_URL}/api/auth/test-accounts`, {
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}`,
      },
      data: { email, password: 'TestDup123!', name: 'Dup 1' },
    })
    expect(res1.status()).toBe(201)
    const created = await res1.json()
    createdIds.push(created.id)

    // Try to create with same email
    const res2 = await request.post(`${AUTH_URL}/api/auth/test-accounts`, {
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}`,
      },
      data: { email, password: 'TestDup456!', name: 'Dup 2' },
    })
    expect(res2.ok()).toBeFalsy()
  })

  test('unauthenticated requests return 401', async ({ request }) => {
    const createRes = await request.post(`${AUTH_URL}/api/auth/test-accounts`, {
      data: {
        email: 'unauth@deepspace.test',
        password: 'TestUnauth123!',
      },
    })
    expect(createRes.status()).toBe(401)

    const listRes = await request.get(`${AUTH_URL}/api/auth/test-accounts`)
    expect(listRes.status()).toBe(401)

    const deleteRes = await request.delete(`${AUTH_URL}/api/auth/test-accounts/fake-id`)
    expect(deleteRes.status()).toBe(401)
  })
})

// ============================================================================
// JWT isTestAccount claim for test accounts
// ============================================================================

test.describe('Test account JWT claims', () => {
  let testAccountId: string
  let testAccountEmail: string
  let testAccountSessionToken: string

  test.beforeAll(async ({ request }) => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const statePath = resolve(import.meta.dirname, '../.auth-state.json')
    const auth = JSON.parse(readFileSync(statePath, 'utf-8'))

    // Create a fresh test account
    testAccountEmail = `e2e-jwt-${Date.now()}@deepspace.test`
    const createRes = await request.post(`${AUTH_URL}/api/auth/test-accounts`, {
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}`,
      },
      data: {
        email: testAccountEmail,
        password: 'TestJwt123!',
        name: 'JWT Claim Test',
        label: 'jwt-test',
      },
    })
    const created = await createRes.json()
    testAccountId = created.id

    // Sign in as the test account
    const signInRes = await request.post(`${AUTH_URL}/api/auth/sign-in/email`, {
      data: { email: testAccountEmail, password: 'TestJwt123!' },
    })
    const setCookie = signInRes.headers()['set-cookie'] ?? ''
    const match = setCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))
    testAccountSessionToken = match ? decodeURIComponent(match[1]) : ''
  })

  test.afterAll(async ({ request }) => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const statePath = resolve(import.meta.dirname, '../.auth-state.json')
    const auth = JSON.parse(readFileSync(statePath, 'utf-8'))

    if (testAccountId) {
      await request.delete(`${AUTH_URL}/api/auth/test-accounts/${testAccountId}`, {
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=${auth.sessionToken}`,
        },
      })
    }
  })

  test('JWT for test account includes isTestAccount: true', async ({ request }) => {
    const res = await request.post(`${AUTH_URL}/api/auth/token`, {
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${testAccountSessionToken}`,
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    const payload = JSON.parse(Buffer.from(body.token.split('.')[1], 'base64url').toString())
    expect(payload.isTestAccount).toBe(true)
    expect(payload.email).toBe(testAccountEmail)
  })
})
