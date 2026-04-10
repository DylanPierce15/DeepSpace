/**
 * DeepSpace Auth Worker
 *
 * Hono + Better Auth on Cloudflare Workers with D1.
 * Handles user authentication, session management, and JWT issuance.
 * Includes CLI login flow (browser-based OAuth with polling).
 */

import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { SignJWT, importPKCS8 } from 'jose'
import { createDeepSpaceAuth, safeJson } from 'deepspace/worker'

// ============================================================================
// Types
// ============================================================================

interface Env {
  AUTH_DB: D1Database
  BETTER_AUTH_SECRET: string
  JWT_PRIVATE_KEY: string
  AUTH_JWT_PUBLIC_KEY: string
  AUTH_BASE_URL: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  GITHUB_CLIENT_ID?: string
  GITHUB_CLIENT_SECRET?: string
}

type AppContext = Context<{ Bindings: Env }>

// ============================================================================
// Constants
// ============================================================================

const CLI_SESSION_TTL_MS = 10 * 60 * 1000
const AUTH_CODE_TTL_MS = 5 * 60 * 1000
const ALLOWED_PROVIDERS = new Set(['github', 'google'])

// Trusted origin patterns for returnTo validation and CORS
const TRUSTED_ORIGIN_SUFFIXES = ['.app.space', '.deep.space']

function isTrustedOrigin(origin: string): boolean {
  try {
    const url = new URL(origin)
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return true
    return TRUSTED_ORIGIN_SUFFIXES.some((s) => url.hostname.endsWith(s))
  } catch {
    return false
  }
}

// ============================================================================
// Shared helpers
// ============================================================================

/** Build a full createDeepSpaceAuth config from env, optionally including OAuth providers. */
function authConfig(env: Env, includeOAuth = false) {
  const config: Parameters<typeof createDeepSpaceAuth>[0] = {
    database: env.AUTH_DB,
    baseURL: env.AUTH_BASE_URL,
    secret: env.BETTER_AUTH_SECRET,
  }
  if (includeOAuth) {
    if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
      config.google = { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
    }
    if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
      config.github = { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET }
    }
  }
  return config
}

let cachedPrivateKey: Awaited<ReturnType<typeof importPKCS8>> | null = null

async function getPrivateKey(env: Env) {
  if (!cachedPrivateKey) {
    const pem = env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n')
    cachedPrivateKey = await importPKCS8(pem, 'ES256')
  }
  return cachedPrivateKey
}

/** Issue a signed JWT for a user. Includes isTestAccount if applicable. */
async function issueJwt(env: Env, user: { id: string; name: string; email: string; image?: string | null }, isTestAccount: boolean) {
  const key = await getPrivateKey(env)
  return new SignJWT({
    name: user.name,
    email: user.email,
    image: user.image,
    ...(isTestAccount ? { isTestAccount: true } : {}),
  })
    .setProtectedHeader({ alg: 'ES256' })
    .setSubject(user.id)
    .setIssuer(env.AUTH_BASE_URL)
    .setAudience('https://api.deep.space')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key)
}

/** Check if a user ID is a test account. */
async function isTestAccountUser(db: D1Database, userId: string): Promise<boolean> {
  await ensureTestAccountsTable(db)
  const row = await db.prepare('SELECT id FROM test_accounts WHERE user_id = ?').bind(userId).first()
  return !!row
}

/** Get authenticated session or null. */
async function getSession(c: AppContext) {
  const auth = createDeepSpaceAuth(authConfig(c.env))
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  return { auth, session }
}

// ── Idempotent table creation (once per isolate) ───────────────────

let _cliTableReady = false
async function ensureCliTable(db: D1Database) {
  if (_cliTableReady) return
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS cli_sessions (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'pending',
        session_token TEXT,
        jwt TEXT,
        user_email TEXT,
        user_name TEXT,
        created_at INTEGER NOT NULL,
        completed_at INTEGER
      )`,
    )
    .run()
  _cliTableReady = true
}

let _authCodesTableReady = false
async function ensureAuthCodesTable(db: D1Database) {
  if (_authCodesTableReady) return
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS auth_codes (
        id TEXT PRIMARY KEY,
        code TEXT,
        return_to TEXT NOT NULL,
        session_token TEXT,
        created_at INTEGER NOT NULL
      )`,
    )
    .run()
  _authCodesTableReady = true
}

let _testAccountsTableReady = false
async function ensureTestAccountsTable(db: D1Database) {
  if (_testAccountsTableReady) return
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS test_accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        developer_id TEXT NOT NULL,
        email TEXT NOT NULL,
        label TEXT,
        created_at INTEGER NOT NULL,
        UNIQUE(developer_id, email)
      )`,
    )
    .run()
  _testAccountsTableReady = true
}

// ============================================================================
// App
// ============================================================================

const app = new Hono<{ Bindings: Env }>()

// CORS — strict origin validation
app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return null
      if (isTrustedOrigin(origin)) return origin
      return null
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposeHeaders: ['Set-Cookie'],
  }),
)

// ============================================================================
// JWT Token + JWKS
// ============================================================================

app.get('/api/auth/jwks', (c) => {
  return safeJson(c, { publicKey: c.env.AUTH_JWT_PUBLIC_KEY }, 200, {
    'Cache-Control': 'public, max-age=86400',
  })
})

app.post('/api/auth/token', async (c) => {
  const { session } = await getSession(c)
  if (!session?.user) return safeJson(c, { token: null, error: 'Unauthorized' }, 401)

  const isTest = await isTestAccountUser(c.env.AUTH_DB, session.user.id)
  const jwt = await issueJwt(c.env, session.user, isTest)

  return safeJson(c, { token: jwt })
})

// ============================================================================
// CLI Login Flow
// ============================================================================

app.post('/api/auth/cli/session', async (c) => {
  await ensureCliTable(c.env.AUTH_DB)

  const sessionId = crypto.randomUUID()
  const now = Date.now()

  await c.env.AUTH_DB
    .prepare('INSERT INTO cli_sessions (id, status, created_at) VALUES (?, ?, ?)')
    .bind(sessionId, 'pending', now)
    .run()

  await c.env.AUTH_DB
    .prepare('DELETE FROM cli_sessions WHERE created_at < ?')
    .bind(now - CLI_SESSION_TTL_MS)
    .run()

  const origin = new URL(c.env.AUTH_BASE_URL).origin
  return safeJson(c, { sessionId, loginUrl: `${origin}/login/cli/${sessionId}` })
})

app.get('/api/auth/cli/status/:sessionId', async (c) => {
  const { sessionId } = c.req.param()

  const row = await c.env.AUTH_DB
    .prepare('SELECT * FROM cli_sessions WHERE id = ?')
    .bind(sessionId)
    .first<{
      id: string
      status: string
      session_token: string | null
      jwt: string | null
      user_email: string | null
      user_name: string | null
      created_at: number
    }>()

  if (!row) return safeJson(c, { error: 'Session not found' }, 404)

  if (Date.now() - row.created_at > CLI_SESSION_TTL_MS) {
    await c.env.AUTH_DB.prepare('DELETE FROM cli_sessions WHERE id = ?').bind(sessionId).run()
    return safeJson(c, { error: 'Session expired' }, 410)
  }

  if (row.status === 'pending') return safeJson(c, { state: 'pending' })

  await c.env.AUTH_DB.prepare('DELETE FROM cli_sessions WHERE id = ?').bind(sessionId).run()

  return safeJson(c, {
    state: 'complete',
    sessionToken: row.session_token,
    jwt: row.jwt,
    email: row.user_email,
    name: row.user_name,
  })
})

app.get('/login/cli/:sessionId', async (c) => {
  const { sessionId } = c.req.param()

  const row = await c.env.AUTH_DB
    .prepare('SELECT status, created_at FROM cli_sessions WHERE id = ?')
    .bind(sessionId)
    .first<{ status: string; created_at: number }>()

  if (!row || Date.now() - row.created_at > CLI_SESSION_TTL_MS) {
    return c.html('<h1>Session expired or not found</h1><p>Run <code>deepspace login</code> again.</p>', 404)
  }

  if (row.status === 'complete') return c.html(loginCompletePage())

  const hasGithub = !!(c.env.GITHUB_CLIENT_ID && c.env.GITHUB_CLIENT_SECRET)
  const hasGoogle = !!(c.env.GOOGLE_CLIENT_ID && c.env.GOOGLE_CLIENT_SECRET)
  const origin = new URL(c.env.AUTH_BASE_URL).origin

  return c.html(loginPage(sessionId, origin, c.env.AUTH_BASE_URL, hasGithub, hasGoogle))
})

app.get('/login/cli/:sessionId/complete', async (c) => {
  const { sessionId } = c.req.param()

  const row = await c.env.AUTH_DB
    .prepare('SELECT status, created_at FROM cli_sessions WHERE id = ?')
    .bind(sessionId)
    .first<{ status: string; created_at: number }>()

  if (!row || Date.now() - row.created_at > CLI_SESSION_TTL_MS) {
    return c.html('<h1>Session expired</h1><p>Run <code>deepspace login</code> again.</p>', 410)
  }

  if (row.status === 'complete') return c.html(loginCompletePage())

  const auth = createDeepSpaceAuth(authConfig(c.env, true))
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) {
    return c.html('<h1>Authentication failed</h1><p>Could not verify session. Run <code>deepspace login</code> again.</p>', 401)
  }

  const cookieHeader = c.req.header('cookie') ?? ''
  const cookieMatch = cookieHeader.match(/__Secure-better-auth\.session_token=([^;]+)/)
  const cookieMatchDev = cookieHeader.match(/better-auth\.session_token=([^;]+)/)
  const sessionToken = cookieMatch?.[1] ?? cookieMatchDev?.[1] ?? ''

  const isTest = await isTestAccountUser(c.env.AUTH_DB, session.user.id)
  const jwt = await issueJwt(c.env, session.user, isTest)

  await c.env.AUTH_DB
    .prepare(
      `UPDATE cli_sessions
       SET status = 'complete', session_token = ?, jwt = ?, user_email = ?, user_name = ?, completed_at = ?
       WHERE id = ?`,
    )
    .bind(decodeURIComponent(sessionToken), jwt, session.user.email, session.user.name, Date.now(), sessionId)
    .run()

  return c.html(loginCompletePage())
})

// ============================================================================
// App Social Login — redirect-based OAuth for deployed apps
// ============================================================================

app.get('/login/social', async (c) => {
  const provider = c.req.query('provider')
  const returnTo = c.req.query('returnTo')

  if (!provider || !returnTo) {
    return c.html('<h1>Bad request</h1><p>Missing provider or returnTo.</p>', 400)
  }

  // Validate provider against allowlist (prevents XSS via template interpolation)
  if (!ALLOWED_PROVIDERS.has(provider)) {
    return c.html('<h1>Bad request</h1><p>Invalid provider.</p>', 400)
  }

  // Validate returnTo against trusted origins (prevents open redirect)
  if (!isTrustedOrigin(returnTo)) {
    return c.html('<h1>Bad request</h1><p>Untrusted return URL.</p>', 400)
  }

  await ensureAuthCodesTable(c.env.AUTH_DB)

  const codeId = crypto.randomUUID()
  await c.env.AUTH_DB
    .prepare('INSERT INTO auth_codes (id, return_to, created_at) VALUES (?, ?, ?)')
    .bind(codeId, returnTo, Date.now())
    .run()

  await c.env.AUTH_DB
    .prepare('DELETE FROM auth_codes WHERE created_at < ?')
    .bind(Date.now() - AUTH_CODE_TTL_MS)
    .run()

  const origin = new URL(c.env.AUTH_BASE_URL).origin
  const authBaseURL = c.env.AUTH_BASE_URL
  const providerLabel = provider === 'google' ? 'Google' : 'GitHub'

  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Signing in...</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a0a; color: #888;
      display: flex; align-items: center; justify-content: center; min-height: 100vh;
    }
  </style>
</head>
<body>
  <p>Redirecting to ${providerLabel}...</p>
  <script>
    (async () => {
      try {
        const res = await fetch('${authBaseURL}/sign-in/social', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: ${JSON.stringify(provider)},
            callbackURL: ${JSON.stringify(`${origin}/login/social/complete?code_id=${codeId}`)}
          }),
          credentials: 'include'
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          document.body.textContent = 'Sign-in failed. Please close this tab and try again.';
        }
      } catch (e) {
        document.body.textContent = 'Sign-in failed. Please close this tab and try again.';
      }
    })();
  </script>
</body>
</html>`)
})

app.get('/login/social/complete', async (c) => {
  const codeId = c.req.query('code_id')
  if (!codeId) return c.html('<h1>Bad request</h1>', 400)

  const row = await c.env.AUTH_DB
    .prepare('SELECT return_to, created_at FROM auth_codes WHERE id = ?')
    .bind(codeId)
    .first<{ return_to: string; created_at: number }>()

  if (!row || Date.now() - row.created_at > AUTH_CODE_TTL_MS) {
    return c.html('<h1>Session expired</h1><p>Please try signing in again.</p>', 410)
  }

  const cookieHeader = c.req.header('cookie') ?? ''
  const cookieMatch = cookieHeader.match(/__Secure-better-auth\.session_token=([^;]+)/)
  const cookieMatchDev = cookieHeader.match(/better-auth\.session_token=([^;]+)/)
  const sessionToken = cookieMatch?.[1] ?? cookieMatchDev?.[1] ?? ''

  if (!sessionToken) {
    return c.html('<h1>Authentication failed</h1><p>No session found. Please try again.</p>', 401)
  }

  const exchangeCode = crypto.randomUUID()

  await c.env.AUTH_DB
    .prepare('UPDATE auth_codes SET code = ?, session_token = ? WHERE id = ?')
    .bind(exchangeCode, decodeURIComponent(sessionToken), codeId)
    .run()

  const returnUrl = new URL('/api/auth/oauth-complete', row.return_to)
  returnUrl.searchParams.set('code', exchangeCode)

  return c.redirect(returnUrl.toString())
})

app.post('/api/auth/exchange-code', async (c) => {
  let body: { code?: string }
  try {
    body = await c.req.json()
  } catch {
    return safeJson(c, { error: 'Invalid request body' }, 400)
  }

  if (!body.code) return safeJson(c, { error: 'Missing code' }, 400)

  const row = await c.env.AUTH_DB
    .prepare('SELECT session_token, created_at FROM auth_codes WHERE code = ?')
    .bind(body.code)
    .first<{ session_token: string; created_at: number }>()

  if (!row || Date.now() - row.created_at > AUTH_CODE_TTL_MS) {
    return safeJson(c, { error: 'Invalid or expired code' }, 400)
  }

  await c.env.AUTH_DB
    .prepare('DELETE FROM auth_codes WHERE code = ?')
    .bind(body.code)
    .run()

  return safeJson(c, { sessionToken: row.session_token })
})

// ============================================================================
// HTML Templates
// ============================================================================

function loginPage(sessionId: string, origin: string, authBaseURL: string, hasGithub: boolean, hasGoogle: boolean): string {
  const buttons: string[] = []
  if (hasGithub) {
    buttons.push(`
      <button onclick="signIn('github')" class="btn github">
        <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
        Sign in with GitHub
      </button>`)
  }
  if (hasGoogle) {
    buttons.push(`
      <button onclick="signIn('google')" class="btn google">
        <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Sign in with Google
      </button>`)
  }

  // sessionId is a server-generated UUID, origin and authBaseURL are from env — safe to interpolate.
  // The signIn function parameter comes from button onclick with hardcoded provider strings.
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DeepSpace — Sign In</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a0a;
      color: #fafafa;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #141414;
      border: 1px solid #2a2a2a;
      border-radius: 16px;
      padding: 48px;
      max-width: 400px;
      width: 100%;
      text-align: center;
    }
    h1 { font-size: 24px; margin-bottom: 8px; }
    .subtitle { color: #888; margin-bottom: 32px; font-size: 14px; }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      width: 100%;
      padding: 12px 24px;
      border-radius: 8px;
      border: 1px solid #333;
      background: #1a1a1a;
      color: #fafafa;
      font-size: 15px;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      margin-bottom: 12px;
    }
    .btn:hover { background: #222; border-color: #555; }
    .error { color: #ef4444; margin-top: 16px; font-size: 13px; display: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>DeepSpace</h1>
    <p class="subtitle">Sign in to authenticate your CLI</p>
    ${buttons.join('\n')}
    <p class="error" id="error"></p>
  </div>
  <script>
    async function signIn(provider) {
      try {
        const res = await fetch(${JSON.stringify(authBaseURL)} + '/sign-in/social', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            callbackURL: ${JSON.stringify(`${origin}/login/cli/${sessionId}/complete`)}
          }),
          credentials: 'include'
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error('No redirect URL returned');
        }
      } catch (err) {
        const el = document.getElementById('error');
        el.textContent = 'Sign-in failed: ' + err.message;
        el.style.display = 'block';
      }
    }
  </script>
</body>
</html>`
}

function loginCompletePage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DeepSpace — Authenticated</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a0a;
      color: #fafafa;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #141414;
      border: 1px solid #2a2a2a;
      border-radius: 16px;
      padding: 48px;
      max-width: 400px;
      width: 100%;
      text-align: center;
    }
    .check {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: #166534;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 32px;
    }
    h1 { font-size: 24px; margin-bottom: 8px; }
    .subtitle { color: #888; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="check">&#10003;</div>
    <h1>Authenticated</h1>
    <p class="subtitle">You can close this tab and return to your terminal.</p>
  </div>
</body>
</html>`
}

// ============================================================================
// Test Account Management
// ============================================================================

app.post('/api/auth/test-accounts', async (c) => {
  const { auth, session } = await getSession(c)
  if (!session?.user) return safeJson(c, { error: 'Unauthorized' }, 401)

  let body: { email?: string; password?: string; name?: string; label?: string }
  try {
    body = await c.req.json()
  } catch {
    return safeJson(c, { error: 'Invalid request body' }, 400)
  }

  const { email, password, name, label } = body

  if (!email?.endsWith('@deepspace.test')) {
    return safeJson(c, { error: 'Test account emails must end with @deepspace.test' }, 400)
  }
  if (!password || password.length < 8) {
    return safeJson(c, { error: 'Password must be at least 8 characters' }, 400)
  }

  await ensureTestAccountsTable(c.env.AUTH_DB)

  // Check limit BEFORE creating the Better Auth user to avoid orphans
  const countRow = await c.env.AUTH_DB
    .prepare('SELECT COUNT(*) as cnt FROM test_accounts WHERE developer_id = ?')
    .bind(session.user.id)
    .first<{ cnt: number }>()

  if (countRow && countRow.cnt >= 10) {
    return safeJson(c, { error: 'Maximum 10 test accounts per developer' }, 429)
  }

  // Create user via Better Auth's internal API
  let signUpResult: any
  try {
    signUpResult = await auth.api.signUpEmail({
      body: { email, password, name: name ?? email.split('@')[0] },
    })
  } catch (err: any) {
    return safeJson(c, { error: err.message ?? 'Failed to create test account' }, 400)
  }

  if (!signUpResult?.user?.id) {
    return safeJson(c, { error: 'Failed to create user' }, 500)
  }

  // Atomic insert enforcing the limit again to handle races
  const id = crypto.randomUUID()
  const now = Date.now()

  const insertResult = await c.env.AUTH_DB
    .prepare(
      `INSERT INTO test_accounts (id, user_id, developer_id, email, label, created_at)
       SELECT ?, ?, ?, ?, ?, ?
       WHERE (SELECT COUNT(*) FROM test_accounts WHERE developer_id = ?) < 10`,
    )
    .bind(id, signUpResult.user.id, session.user.id, email, label ?? null, now, session.user.id)
    .run()

  if (!insertResult.meta.changes) {
    // Race lost — clean up the orphaned Better Auth user
    await c.env.AUTH_DB.batch([
      c.env.AUTH_DB.prepare('DELETE FROM session WHERE userId = ?').bind(signUpResult.user.id),
      c.env.AUTH_DB.prepare('DELETE FROM account WHERE userId = ?').bind(signUpResult.user.id),
      c.env.AUTH_DB.prepare('DELETE FROM user WHERE id = ?').bind(signUpResult.user.id),
    ]).catch(() => {})
    return safeJson(c, { error: 'Maximum 10 test accounts per developer' }, 429)
  }

  return safeJson(c, { id, email, userId: signUpResult.user.id, label: label ?? null, createdAt: now }, 201)
})

app.get('/api/auth/test-accounts', async (c) => {
  const { session } = await getSession(c)
  if (!session?.user) return safeJson(c, { error: 'Unauthorized' }, 401)

  await ensureTestAccountsTable(c.env.AUTH_DB)

  const { results } = await c.env.AUTH_DB
    .prepare('SELECT id, user_id, email, label, created_at FROM test_accounts WHERE developer_id = ? ORDER BY created_at')
    .bind(session.user.id)
    .all<{ id: string; user_id: string; email: string; label: string | null; created_at: number }>()

  return safeJson(c, {
    accounts: (results ?? []).map((r) => ({
      id: r.id,
      userId: r.user_id,
      email: r.email,
      label: r.label,
      createdAt: r.created_at,
    })),
  })
})

app.delete('/api/auth/test-accounts/:id', async (c) => {
  const { session } = await getSession(c)
  if (!session?.user) return safeJson(c, { error: 'Unauthorized' }, 401)

  const { id } = c.req.param()
  await ensureTestAccountsTable(c.env.AUTH_DB)

  const row = await c.env.AUTH_DB
    .prepare('SELECT user_id FROM test_accounts WHERE id = ? AND developer_id = ?')
    .bind(id, session.user.id)
    .first<{ user_id: string }>()

  if (!row) return safeJson(c, { error: 'Test account not found' }, 404)

  // Delete test_accounts row + Better Auth user, sessions, accounts
  await c.env.AUTH_DB.batch([
    c.env.AUTH_DB.prepare('DELETE FROM test_accounts WHERE id = ?').bind(id),
    c.env.AUTH_DB.prepare('DELETE FROM session WHERE userId = ?').bind(row.user_id),
    c.env.AUTH_DB.prepare('DELETE FROM account WHERE userId = ?').bind(row.user_id),
    c.env.AUTH_DB.prepare('DELETE FROM user WHERE id = ?').bind(row.user_id),
  ])

  return safeJson(c, { deleted: true })
})

// ============================================================================
// Better Auth Routes — catch-all for /api/auth/*
// ============================================================================

// Block public email/password sign-up. Sign-in remains enabled.
app.post('/api/auth/sign-up/email', (c) => {
  return safeJson(c, { error: 'Public signup disabled. Use OAuth or create a test account.' }, 403)
})

app.on(['GET', 'POST'], '/api/auth/*', async (c) => {
  const auth = createDeepSpaceAuth(authConfig(c.env, true))
  return auth.handler(c.req.raw)
})

// ============================================================================
// Health Check + DB Migration
// ============================================================================

app.get('/health', (c) => safeJson(c, { service: 'deepspace-auth' }))

app.post('/_migrate', async (c) => {
  try {
    const hostname = new URL(c.env.AUTH_BASE_URL).hostname
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return safeJson(c, { error: 'Migrations disabled in production' }, 403)
    }
  } catch {
    return safeJson(c, { error: 'Invalid AUTH_BASE_URL' }, 500)
  }

  const { getMigrations } = await import('better-auth/db/migration')
  const { runMigrations } = await getMigrations({
    database: c.env.AUTH_DB,
    baseURL: c.env.AUTH_BASE_URL,
    secret: c.env.BETTER_AUTH_SECRET,
    emailAndPassword: { enabled: true },
    plugins: [
      (await import('better-auth/plugins')).organization(),
      (await import('better-auth/plugins')).twoFactor(),
    ],
  })
  await runMigrations()
  return safeJson(c, { ok: true })
})

// ============================================================================
// Export
// ============================================================================

export default app
