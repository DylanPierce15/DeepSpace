/**
 * Auth helpers for E2E tests.
 * Signs in a test user against the deployed deepspace-auth worker
 * and retrieves a short-lived JWT for API calls.
 *
 * Note: public email/password sign-up is disabled. Test accounts must
 * be pre-created via `deepspace test-accounts create` or the API.
 */

const AUTH_URL = 'https://deepspace-auth.eudaimonicincorporated.workers.dev'

export const TEST_USER = {
  email: 'e2e-test@deepspace.test',
  password: 'TestPass123!',
  name: 'E2E Test User',
}

export interface AuthState {
  sessionToken: string
  jwt: string
  userId: string
}

const SESSION_COOKIE_NAME = '__Secure-better-auth.session_token'

function extractSessionCookie(res: Response): string | null {
  const setCookie = res.headers.get('set-cookie') ?? ''
  const match = setCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * Sign in an existing user. Returns the full session cookie value (token.signature).
 */
export async function signIn(
  email: string,
  password: string,
): Promise<{ sessionToken: string; userId: string } | null> {
  const res = await fetch(`${AUTH_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: AUTH_URL },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  })

  if (!res.ok) return null

  const body = (await res.json()) as { token?: string; user?: { id: string } }
  if (!body.user?.id) return null

  const sessionToken = extractSessionCookie(res)
  if (!sessionToken) return null

  return { sessionToken, userId: body.user.id }
}

/**
 * Get a short-lived JWT from the auth worker using a session token.
 */
export async function getJwt(sessionToken: string): Promise<string | null> {
  const res = await fetch(`${AUTH_URL}/api/auth/token`, {
    method: 'POST',
    headers: {
      Cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`,
      Origin: AUTH_URL,
    },
  })

  if (!res.ok) return null

  const body = (await res.json()) as { token?: string }
  return body.token ?? null
}

/**
 * Create a test account via the test-accounts API.
 * Requires an authenticated session (the caller becomes the "developer" owner).
 */
export async function createTestAccount(
  sessionToken: string,
  account: { email: string; password: string; name?: string; label?: string },
): Promise<{ id: string; email: string; userId: string } | null> {
  const res = await fetch(`${AUTH_URL}/api/auth/test-accounts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`,
      Origin: AUTH_URL,
    },
    body: JSON.stringify(account),
  })

  if (!res.ok) return null
  return (await res.json()) as { id: string; email: string; userId: string }
}

/**
 * List test accounts owned by the authenticated developer.
 */
export async function listTestAccounts(
  sessionToken: string,
): Promise<Array<{ id: string; email: string; userId: string; label: string | null; createdAt: number }>> {
  const res = await fetch(`${AUTH_URL}/api/auth/test-accounts`, {
    headers: {
      Cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`,
      Origin: AUTH_URL,
    },
  })

  if (!res.ok) return []
  const body = (await res.json()) as { accounts: Array<any> }
  return body.accounts ?? []
}

/**
 * Delete a test account.
 */
export async function deleteTestAccount(
  sessionToken: string,
  id: string,
): Promise<boolean> {
  const res = await fetch(`${AUTH_URL}/api/auth/test-accounts/${id}`, {
    method: 'DELETE',
    headers: {
      Cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`,
      Origin: AUTH_URL,
    },
  })

  return res.ok
}

/**
 * Ensure the E2E test user exists and return auth state.
 * Tries sign-in first. If that fails (user doesn't exist yet),
 * creates the user as a test account, then signs in.
 */
export async function ensureTestUser(
  ownerSessionToken?: string,
): Promise<AuthState> {
  // Try signing in first (user may already exist)
  let result = await signIn(TEST_USER.email, TEST_USER.password)

  if (!result && ownerSessionToken) {
    // User doesn't exist — create via test-accounts API
    console.log('[auth] Test user not found, creating via test-accounts API...')
    const created = await createTestAccount(ownerSessionToken, {
      email: TEST_USER.email,
      password: TEST_USER.password,
      name: TEST_USER.name,
      label: 'E2E test user',
    })
    if (!created) {
      throw new Error('Failed to create test user via test-accounts API')
    }
    result = await signIn(TEST_USER.email, TEST_USER.password)
  }

  if (!result) {
    throw new Error(
      'Failed to sign in test user. Create it first with:\n' +
      '  deepspace test-accounts create --email e2e-test@deepspace.test --password TestPass123! --name "E2E Test User"',
    )
  }

  const jwt = await getJwt(result.sessionToken)
  if (!jwt) {
    throw new Error('Failed to get JWT for test user')
  }

  return {
    sessionToken: result.sessionToken,
    jwt,
    userId: result.userId,
  }
}
