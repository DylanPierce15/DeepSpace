/**
 * DeepSpace Auth Worker
 *
 * Hono + Better Auth on Cloudflare Workers with D1.
 * Handles user authentication, session management, and JWT issuance.
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { SignJWT, importPKCS8 } from 'jose'
import { createDeepSpaceAuth } from '@deep-space/auth/better-auth'

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
