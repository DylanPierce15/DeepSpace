/**
 * DeepSpace Auth Worker
 *
 * Hono + Better Auth on Cloudflare Workers with D1.
 * Handles user authentication, session management, and JWT issuance.
 * Includes CLI login flow (browser-based OAuth with polling).
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { SignJWT, importPKCS8 } from 'jose'
import { createDeepSpaceAuth } from 'deepspace/worker'

// ============================================================================
// Types
// ============================================================================

interface Env {
  AUTH_DB: D1Database
  BETTER_AUTH_SECRET: string
  JWT_PRIVATE_KEY: string
  AUTH_BASE_URL: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  GITHUB_CLIENT_ID?: string
  GITHUB_CLIENT_SECRET?: string
}

// CLI session expires after 10 minutes
const CLI_SESSION_TTL_MS = 10 * 60 * 1000

// ============================================================================
// App
// ============================================================================

const app = new Hono<{ Bindings: Env }>()

// CORS for cross-origin auth requests from deployed apps
app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return '*'
      if (
        origin.endsWith('.app.space') ||
        origin.endsWith('.deep.space') ||
        origin.includes('localhost')
      ) {
        return origin
      }
      return '*'
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposeHeaders: ['Set-Cookie'],
  }),
)

// ============================================================================
// Custom JWT Token Endpoint — must be before the Better Auth catch-all
// ============================================================================

let cachedPrivateKey: Awaited<ReturnType<typeof importPKCS8>> | null = null

/**
 * POST /api/auth/token
 *
 * Issues a short-lived ES256 JWT for WebSocket and API authentication.
 * Requires a valid Better Auth session (cookie-based).
 */
app.post('/api/auth/token', async (c) => {
  const auth = createDeepSpaceAuth({
    database: c.env.AUTH_DB,
    baseURL: c.env.AUTH_BASE_URL,
    secret: c.env.BETTER_AUTH_SECRET,
  })

  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  if (!cachedPrivateKey) {
    const pem = c.env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n')
    cachedPrivateKey = await importPKCS8(pem, 'ES256')
  }

  const jwt = await new SignJWT({
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  })
    .setProtectedHeader({ alg: 'ES256' })
    .setSubject(session.user.id)
    .setIssuer(c.env.AUTH_BASE_URL)
    .setAudience('https://api.deep.space')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(cachedPrivateKey)

  return c.json({ token: jwt })
})

// ============================================================================
// CLI Login Flow — browser-based OAuth with polling
// ============================================================================

/** Ensure cli_sessions table exists (idempotent) */
async function ensureCliTable(db: D1Database) {
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
}

/**
 * POST /api/auth/cli/session
 * CLI calls this to create a pending login session.
 * Returns { sessionId, loginUrl } — CLI opens loginUrl in the browser.
 */
app.post('/api/auth/cli/session', async (c) => {
  await ensureCliTable(c.env.AUTH_DB)

  const sessionId = crypto.randomUUID()
  const now = Date.now()

  await c.env.AUTH_DB
    .prepare('INSERT INTO cli_sessions (id, status, created_at) VALUES (?, ?, ?)')
    .bind(sessionId, 'pending', now)
    .run()

  // Clean up expired sessions older than 10 minutes
  await c.env.AUTH_DB
    .prepare('DELETE FROM cli_sessions WHERE created_at < ?')
    .bind(now - CLI_SESSION_TTL_MS)
    .run()

  // AUTH_BASE_URL may include /api/auth — extract origin for page URLs
  const origin = new URL(c.env.AUTH_BASE_URL).origin
  const loginUrl = `${origin}/login/cli/${sessionId}`

  return c.json({ sessionId, loginUrl })
})

/**
 * GET /api/auth/cli/status/:sessionId
 * CLI polls this until status is 'complete'.
 */
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

  if (!row) {
    return c.json({ error: 'Session not found' }, 404)
  }

  // Check expiry
  if (Date.now() - row.created_at > CLI_SESSION_TTL_MS) {
    await c.env.AUTH_DB.prepare('DELETE FROM cli_sessions WHERE id = ?').bind(sessionId).run()
    return c.json({ error: 'Session expired' }, 410)
  }

  if (row.status === 'pending') {
    return c.json({ status: 'pending' })
  }

  // Complete — return credentials and delete the session
  await c.env.AUTH_DB.prepare('DELETE FROM cli_sessions WHERE id = ?').bind(sessionId).run()

  return c.json({
    status: 'complete',
    sessionToken: row.session_token,
    jwt: row.jwt,
    email: row.user_email,
    name: row.user_name,
  })
})

/**
 * GET /login/cli/:sessionId
 * Browser-facing login page. Shows "Sign in with GitHub / Google" buttons.
 */
app.get('/login/cli/:sessionId', async (c) => {
  const { sessionId } = c.req.param()

  const row = await c.env.AUTH_DB
    .prepare('SELECT status, created_at FROM cli_sessions WHERE id = ?')
    .bind(sessionId)
    .first<{ status: string; created_at: number }>()

  if (!row || Date.now() - row.created_at > CLI_SESSION_TTL_MS) {
    return c.html('<h1>Session expired or not found</h1><p>Run <code>deepspace login</code> again.</p>', 404)
  }

  if (row.status === 'complete') {
    return c.html(loginCompletePage())
  }

  const hasGithub = !!(c.env.GITHUB_CLIENT_ID && c.env.GITHUB_CLIENT_SECRET)
  const hasGoogle = !!(c.env.GOOGLE_CLIENT_ID && c.env.GOOGLE_CLIENT_SECRET)
  const origin = new URL(c.env.AUTH_BASE_URL).origin

  return c.html(loginPage(sessionId, origin, c.env.AUTH_BASE_URL, hasGithub, hasGoogle))
})

/**
 * GET /login/cli/:sessionId/complete
 * Better Auth redirects here after OAuth. Reads the session cookie,
 * issues a JWT, and marks the CLI session as complete.
 */
app.get('/login/cli/:sessionId/complete', async (c) => {
  const { sessionId } = c.req.param()

  // Verify CLI session exists and is pending
  const row = await c.env.AUTH_DB
    .prepare('SELECT status, created_at FROM cli_sessions WHERE id = ?')
    .bind(sessionId)
    .first<{ status: string; created_at: number }>()

  if (!row || Date.now() - row.created_at > CLI_SESSION_TTL_MS) {
    return c.html('<h1>Session expired</h1><p>Run <code>deepspace login</code> again.</p>', 410)
  }

  if (row.status === 'complete') {
    return c.html(loginCompletePage())
  }

  // Read Better Auth session from cookie
  const auth = createDeepSpaceAuth({
    database: c.env.AUTH_DB,
    baseURL: c.env.AUTH_BASE_URL,
    secret: c.env.BETTER_AUTH_SECRET,
    google:
      c.env.GOOGLE_CLIENT_ID && c.env.GOOGLE_CLIENT_SECRET
        ? { clientId: c.env.GOOGLE_CLIENT_ID, clientSecret: c.env.GOOGLE_CLIENT_SECRET }
        : undefined,
    github:
      c.env.GITHUB_CLIENT_ID && c.env.GITHUB_CLIENT_SECRET
        ? { clientId: c.env.GITHUB_CLIENT_ID, clientSecret: c.env.GITHUB_CLIENT_SECRET }
        : undefined,
  })

  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) {
    return c.html('<h1>Authentication failed</h1><p>Could not verify session. Run <code>deepspace login</code> again.</p>', 401)
  }

  // Extract session token from cookie
  const cookieHeader = c.req.header('cookie') ?? ''
  const cookieMatch = cookieHeader.match(/__Secure-better-auth\.session_token=([^;]+)/)
  // Also try non-secure cookie name (local dev)
  const cookieMatchDev = cookieHeader.match(/better-auth\.session_token=([^;]+)/)
  const sessionToken = cookieMatch?.[1] ?? cookieMatchDev?.[1] ?? ''

  // Issue JWT
  if (!cachedPrivateKey) {
    const pem = c.env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n')
    cachedPrivateKey = await importPKCS8(pem, 'ES256')
  }

  const jwt = await new SignJWT({
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  })
    .setProtectedHeader({ alg: 'ES256' })
    .setSubject(session.user.id)
    .setIssuer(c.env.AUTH_BASE_URL)
    .setAudience('https://api.deep.space')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(cachedPrivateKey)

  // Mark CLI session as complete
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

/** Ensure auth_codes table exists (idempotent) */
async function ensureAuthCodesTable(db: D1Database) {
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
}

/**
 * GET /login/social?provider=google&returnTo=https://my-app.app.space
 * App redirects here. Auto-initiates OAuth on the auth worker's domain
 * so state cookies work correctly.
 */
app.get('/login/social', async (c) => {
  const provider = c.req.query('provider')
  const returnTo = c.req.query('returnTo')

  if (!provider || !returnTo) {
    return c.html('<h1>Bad request</h1><p>Missing provider or returnTo.</p>', 400)
  }

  await ensureAuthCodesTable(c.env.AUTH_DB)

  const codeId = crypto.randomUUID()
  await c.env.AUTH_DB
    .prepare('INSERT INTO auth_codes (id, return_to, created_at) VALUES (?, ?, ?)')
    .bind(codeId, returnTo, Date.now())
    .run()

  // Clean up expired entries
  await c.env.AUTH_DB
    .prepare('DELETE FROM auth_codes WHERE created_at < ?')
    .bind(Date.now() - CLI_SESSION_TTL_MS)
    .run()

  const origin = new URL(c.env.AUTH_BASE_URL).origin
  const authBaseURL = c.env.AUTH_BASE_URL

  // Page that auto-initiates the OAuth redirect
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
  <p>Redirecting to ${provider === 'google' ? 'Google' : 'GitHub'}...</p>
  <script>
    (async () => {
      try {
        const res = await fetch('${authBaseURL}/sign-in/social', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: '${provider}',
            callbackURL: '${origin}/login/social/complete?code_id=${codeId}'
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

/**
 * GET /login/social/complete?code_id=XXX
 * After OAuth callback, Better Auth redirects here.
 * Generates a one-time code and redirects back to the app.
 */
app.get('/login/social/complete', async (c) => {
  const codeId = c.req.query('code_id')
  if (!codeId) return c.html('<h1>Bad request</h1>', 400)

  const row = await c.env.AUTH_DB
    .prepare('SELECT return_to, created_at FROM auth_codes WHERE id = ?')
    .bind(codeId)
    .first<{ return_to: string; created_at: number }>()

  if (!row || Date.now() - row.created_at > CLI_SESSION_TTL_MS) {
    return c.html('<h1>Session expired</h1><p>Please try signing in again.</p>', 410)
  }

  // Extract session token from cookie
  const cookieHeader = c.req.header('cookie') ?? ''
  const cookieMatch = cookieHeader.match(/__Secure-better-auth\.session_token=([^;]+)/)
  const cookieMatchDev = cookieHeader.match(/better-auth\.session_token=([^;]+)/)
  const sessionToken = cookieMatch?.[1] ?? cookieMatchDev?.[1] ?? ''

  if (!sessionToken) {
    return c.html('<h1>Authentication failed</h1><p>No session found. Please try again.</p>', 401)
  }

  // Generate one-time exchange code
  const exchangeCode = crypto.randomUUID()

  await c.env.AUTH_DB
    .prepare('UPDATE auth_codes SET code = ?, session_token = ? WHERE id = ?')
    .bind(exchangeCode, decodeURIComponent(sessionToken), codeId)
    .run()

  // Redirect back to the app with the exchange code
  const returnUrl = new URL(row.return_to)
  returnUrl.searchParams.set('__ds_code', exchangeCode)

  return c.redirect(returnUrl.toString())
})

/**
 * POST /api/auth/exchange-code
 * App worker exchanges a one-time code for a session token.
 */
app.post('/api/auth/exchange-code', async (c) => {
  const { code } = await c.req.json<{ code: string }>()

  const row = await c.env.AUTH_DB
    .prepare('SELECT session_token, created_at FROM auth_codes WHERE code = ?')
    .bind(code)
    .first<{ session_token: string; created_at: number }>()

  if (!row || Date.now() - row.created_at > CLI_SESSION_TTL_MS) {
    return c.json({ error: 'Invalid or expired code' }, 400)
  }

  // Delete the code (one-time use)
  await c.env.AUTH_DB
    .prepare('DELETE FROM auth_codes WHERE code = ?')
    .bind(code)
    .run()

  return c.json({ sessionToken: row.session_token })
})

// ============================================================================
// HTML Templates
// ============================================================================

/** Login page HTML */
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
        const res = await fetch('${authBaseURL}/sign-in/social', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            callbackURL: '${origin}/login/cli/${sessionId}/complete'
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

/** Login complete page HTML */
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
// Better Auth Routes — catch-all for /api/auth/*
// ============================================================================

app.on(['GET', 'POST'], '/api/auth/*', async (c) => {
  const auth = createDeepSpaceAuth({
    database: c.env.AUTH_DB,
    baseURL: c.env.AUTH_BASE_URL,
    secret: c.env.BETTER_AUTH_SECRET,
    google:
      c.env.GOOGLE_CLIENT_ID && c.env.GOOGLE_CLIENT_SECRET
        ? { clientId: c.env.GOOGLE_CLIENT_ID, clientSecret: c.env.GOOGLE_CLIENT_SECRET }
        : undefined,
    github:
      c.env.GITHUB_CLIENT_ID && c.env.GITHUB_CLIENT_SECRET
        ? { clientId: c.env.GITHUB_CLIENT_ID, clientSecret: c.env.GITHUB_CLIENT_SECRET }
        : undefined,
  })

  return auth.handler(c.req.raw)
})

// ============================================================================
// Health Check + DB Migration
// ============================================================================

app.get('/health', (c) => c.json({ status: 'ok', service: 'deepspace-auth' }))

/**
 * POST /_migrate — run Better Auth's built-in DB migrations.
 * Handles all tables including plugin columns (twoFactor, organization, etc.).
 * Only available in local dev (wrangler dev). Blocked in production.
 */
app.post('/_migrate', async (c) => {
  if (c.env.AUTH_BASE_URL && !c.env.AUTH_BASE_URL.includes('localhost')) {
    return c.json({ error: 'Migrations disabled in production' }, 403)
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
  return c.json({ ok: true })
})

// ============================================================================
// Export
// ============================================================================

export default app
