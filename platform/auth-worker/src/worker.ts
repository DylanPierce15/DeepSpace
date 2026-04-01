/**
 * DeepSpace Auth Worker
 *
 * Hono + Better Auth on Cloudflare Workers with D1.
 * Handles user authentication, session management, and JWT issuance.
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { SignJWT, importPKCS8 } from 'jose'
import { createDeepSpaceAuth } from '@deepspace/auth/better-auth'

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
      // Allow all *.app.space, *.deep.space, and localhost
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
// Better Auth Routes — handles /api/auth/**
// ============================================================================

app.on(['GET', 'POST'], '/api/auth/**', async (c) => {
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
// Custom JWT Token Endpoint
// ============================================================================

// Cache the imported private key
let cachedPrivateKey: Awaited<ReturnType<typeof importPKCS8>> | null = null

/**
 * POST /api/auth/token
 *
 * Issues a short-lived ES256 JWT for WebSocket and API authentication.
 * Requires a valid Better Auth session (cookie-based).
 */
app.post('/api/auth/token', async (c) => {
  // Verify session via Better Auth
  const auth = createDeepSpaceAuth({
    database: c.env.AUTH_DB,
    baseURL: c.env.AUTH_BASE_URL,
    secret: c.env.BETTER_AUTH_SECRET,
  })

  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Import private key (cached)
  if (!cachedPrivateKey) {
    cachedPrivateKey = await importPKCS8(c.env.JWT_PRIVATE_KEY, 'ES256')
  }

  // Sign short-lived JWT
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
// Health Check
// ============================================================================

app.get('/health', (c) => c.json({ status: 'ok', service: 'deepspace-auth' }))

// ============================================================================
// Export
// ============================================================================

export default app
