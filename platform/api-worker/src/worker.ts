/**
 * DeepSpace API Worker — Hono on Cloudflare Workers.
 * Billing, Stripe integration, user profiles, integration proxying.
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1'
import type { JwtClaims } from 'deepspace/worker'
import stripeRoutes from './routes/stripe'
import usersRoutes from './routes/users'
import integrationsRoutes from './routes/integrations'

// ============================================================================
// Env type — Cloudflare bindings + Hono variables
// ============================================================================

export type Env = {
  Bindings: {
    BILLING_DB: D1Database
    AUTH_JWT_PUBLIC_KEY: string
    AUTH_JWT_ISSUER: string
    STRIPE_SECRET_KEY: string
    STRIPE_WEBHOOK_SECRET: string
    STRIPE_PUBLISHABLE_KEY: string
    // Integration API keys
    OPENAI_API_KEY: string
    ANTHROPIC_API_KEY: string
    FREEPIK_API_KEY: string
    SERPAPI_API_KEY: string
    OPENWEATHER_API_KEY: string
    NASA_API_KEY: string
    EXA_API_KEY: string
    NEWS_API_KEY: string
    YOUTUBE_API_KEY: string
    GITHUB_TOKEN: string
    FINNHUB_API_KEY: string
    ALPHA_VANTAGE_API_KEY: string
    ELEVENLABS_API_KEY: string
    FIRECRAWL_API_KEY: string
    API_SPORTS_KEY: string
    CLOUDCONVERT_API_KEY: string
    GEMINI_API_KEY: string
    RESEND_API_KEY: string
    LATEX_COMPILER_URL: string
    TIKTOK_API_KEY: string
    SUBMAGIC_API_KEY: string
    LIVEKIT_API_KEY: string
    LIVEKIT_API_SECRET: string
    LIVEKIT_URL: string
    // OAuth integration credentials
    GOOGLE_CLIENT_ID: string
    GOOGLE_CLIENT_SECRET: string
    SLACK_CLIENT_ID: string
    SLACK_CLIENT_SECRET: string
  }
  Variables: {
    userId: string
    claims: JwtClaims
  }
}

// ============================================================================
// D1 database helper
// ============================================================================

export function getDb(env: Env['Bindings']): DrizzleD1Database {
  return drizzle(env.BILLING_DB)
}

// ============================================================================
// App
// ============================================================================

const app = new Hono<Env>()

// Global CORS
app.use(
  '*',
  cors({
    origin: ['https://deep.space', 'https://*.deep.space', 'https://*.app.space', 'http://localhost:*'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }),
)

// Health check
app.get('/api/health', (c) =>
  c.json({ status: 'ok', service: 'deepspace-api', timestamp: new Date().toISOString() }),
)

// Mount routes
app.route('/api/stripe', stripeRoutes)
app.route('/api/users', usersRoutes)
app.route('/api/integrations', integrationsRoutes)

// 404 fallback
app.notFound((c) => c.json({ error: 'Not found' }, 404))

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

// Export for Hono RPC
export type ApiWorkerApp = typeof app

export default app
