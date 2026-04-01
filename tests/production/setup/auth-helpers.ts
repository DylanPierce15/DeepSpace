/**
 * Auth helpers for E2E tests.
 * Signs up / signs in a test user against the deployed deepspace-auth worker
 * and retrieves a short-lived JWT for API calls.
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
 * Sign up a new user. Returns the full session cookie value, or null if user already exists.
 */
export async function signUp(
  email: string,
  password: string,
  name: string,
): Promise<{ sessionToken: string; userId: string } | null> {
  const res = await fetch(`${AUTH_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: AUTH_URL },
    body: JSON.stringify({ email, password, name }),
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

  // Extract the full session cookie (token.signature) from set-cookie header
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
 * Ensure a test user exists (sign up or sign in) and return full auth state.
 */
export async function ensureTestUser(): Promise<AuthState> {
  // Try sign-up first
  let result = await signUp(TEST_USER.email, TEST_USER.password, TEST_USER.name)

  // If sign-up fails (user exists), sign in
  if (!result) {
    console.log('[auth] Sign-up returned null, trying sign-in...')
    result = await signIn(TEST_USER.email, TEST_USER.password)
  }

  if (!result) {
    // Last resort: try raw fetch to diagnose
    const raw = await fetch(`${AUTH_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: AUTH_URL },
      body: JSON.stringify({ email: TEST_USER.email, password: TEST_USER.password }),
    })
    const text = await raw.text()
    throw new Error(`Failed to sign up or sign in. Status: ${raw.status}, Body: ${text}`)
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
