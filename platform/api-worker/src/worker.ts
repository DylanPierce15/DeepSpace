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
import usageRoutes from './routes/usage'

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

// Error handler — show actual error instead of "Internal server error"
app.onError((err, c) => {
  console.error('[api-worker] Unhandled error:', err.message, err.stack)
  return c.json({ error: err.message }, 500)
})

// Health check
app.get('/api/health', (c) =>
  c.json({ status: 'ok', service: 'deepspace-api', timestamp: new Date().toISOString() }),
)

// Mount routes
app.route('/api/stripe', stripeRoutes)
app.route('/api/users', usersRoutes)
app.route('/api/integrations', integrationsRoutes)
app.route('/api/usage', usageRoutes)

// D1 migration (dev only)
app.post('/_migrate', async (c) => {
  const db = c.env.BILLING_DB
  const migrations = [
    "CREATE TABLE IF NOT EXISTS user_profiles (id TEXT PRIMARY KEY, email TEXT, name TEXT, image TEXT, stripe_customer_id TEXT, stripe_subscription_id TEXT, subscription_status TEXT DEFAULT 'free', subscription_tier TEXT DEFAULT 'free', subscription_current_period_end INTEGER, subscription_credits REAL DEFAULT 0, purchased_credits REAL DEFAULT 0, bonus_credits_remaining REAL DEFAULT 0, bonus_credits_expires_at INTEGER, created_at INTEGER NOT NULL DEFAULT (unixepoch()), updated_at INTEGER NOT NULL DEFAULT (unixepoch()))",
    "CREATE TABLE IF NOT EXISTS integration_usage (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, integration_name TEXT NOT NULL, endpoint TEXT NOT NULL, billing_units TEXT NOT NULL, unit_cost TEXT NOT NULL, total_cost TEXT NOT NULL, currency TEXT DEFAULT 'USD', status TEXT NOT NULL DEFAULT 'pending', external_request_id TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch()), completed_at INTEGER)",
    "CREATE TABLE IF NOT EXISTS stripe_invoices (id TEXT PRIMARY KEY, user_id TEXT, stripe_customer_id TEXT, amount_due INTEGER, amount_paid INTEGER, status TEXT DEFAULT 'void', credits_purchased REAL, updated_at INTEGER DEFAULT (unixepoch()))",
  ]
  for (const sql of migrations) {
    await db.exec(sql)
  }
  return c.json({ ok: true })
})

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
