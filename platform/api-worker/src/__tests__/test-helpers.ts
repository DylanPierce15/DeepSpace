/**
 * Shared test helpers for D1 migration, cleanup, JWT signing, and Stripe webhook simulation.
 */

import { env, SELF } from 'cloudflare:test'
import { SignJWT, importPKCS8 } from 'jose'

// ============================================================================
// D1 Migrations
// ============================================================================

const MIGRATIONS = [
  'CREATE TABLE IF NOT EXISTS user_profiles (id TEXT PRIMARY KEY, email TEXT, name TEXT, image TEXT, stripe_customer_id TEXT, stripe_subscription_id TEXT, subscription_status TEXT DEFAULT \'free\', subscription_tier TEXT DEFAULT \'free\', subscription_current_period_end INTEGER, subscription_credits REAL DEFAULT 0, purchased_credits REAL DEFAULT 0, bonus_credits_remaining REAL DEFAULT 0, bonus_credits_expires_at INTEGER, created_at INTEGER NOT NULL DEFAULT (unixepoch()), updated_at INTEGER NOT NULL DEFAULT (unixepoch()))',

  'CREATE TABLE IF NOT EXISTS integration_usage (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, caller_user_id TEXT, integration_name TEXT NOT NULL, endpoint TEXT NOT NULL, billing_units TEXT NOT NULL, unit_cost TEXT NOT NULL, total_cost TEXT NOT NULL, currency TEXT DEFAULT \'USD\', status TEXT NOT NULL DEFAULT \'pending\', external_request_id TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch()), completed_at INTEGER)',

  'CREATE TABLE IF NOT EXISTS stripe_invoices (id TEXT PRIMARY KEY, user_id TEXT, stripe_customer_id TEXT, amount_due INTEGER, amount_paid INTEGER, status TEXT DEFAULT \'void\', credits_purchased REAL, updated_at INTEGER DEFAULT (unixepoch()))',
]

export async function migrateTestDb() {
  const db = env.BILLING_DB
  for (const sql of MIGRATIONS) {
    await db.exec(sql)
  }
}

export async function cleanTables() {
  const db = env.BILLING_DB
  await db.exec('DELETE FROM integration_usage')
  await db.exec('DELETE FROM user_profiles')
  await db.exec('DELETE FROM stripe_invoices')
}

// ============================================================================
// JWT Test Signing
// ============================================================================

/**
 * Test ES256 private key — matches the public key in vitest.config.ts.
 * ONLY used for signing JWTs in tests. Never deployed anywhere.
 */
const TEST_JWT_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgViVa+AqStZtvZ49N
7VVjclAPZuJ3TmQQDeRAiamBxPKhRANCAAQd0I1OXN+C457oqJVqBiSxTllOtDb2
oxltdAl6xlA6wVHu113ipIG5XO/5mHE51iYPAZtwLID72B1Ol2qoXEQ7
-----END PRIVATE KEY-----`

const TEST_JWT_ISSUER = 'https://auth.test.deep.space'

let cachedPrivateKey: CryptoKey | null = null

async function getTestPrivateKey(): Promise<CryptoKey> {
  if (!cachedPrivateKey) {
    cachedPrivateKey = await importPKCS8(TEST_JWT_PRIVATE_KEY, 'ES256')
  }
  return cachedPrivateKey
}

/**
 * Sign a test JWT for a given user ID. The JWT will pass the auth middleware
 * when the vitest.config.ts test key pair is used.
 */
export async function signTestJwt(
  userId: string,
  overrides?: { email?: string; name?: string },
): Promise<string> {
  const key = await getTestPrivateKey()
  return new SignJWT({
    sub: userId,
    name: overrides?.name ?? 'Test User',
    email: overrides?.email ?? 'test@deep.space',
  })
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .setIssuer(TEST_JWT_ISSUER)
    .sign(key)
}

/**
 * Make an authenticated fetch via SELF with a signed test JWT.
 */
export async function authedFetch(
  path: string,
  userId: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await signTestJwt(userId)
  return SELF.fetch(`https://fake-host${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  })
}

// ============================================================================
// Stripe Webhook Helpers
// ============================================================================

/**
 * Construct a minimal Stripe event object for webhook testing.
 * The event has the right shape for Stripe's constructEvent to accept.
 */
export function buildStripeEvent<T extends Record<string, unknown>>(
  type: string,
  data: T,
  id?: string,
): Record<string, unknown> {
  return {
    id: id ?? `evt_test_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`,
    object: 'event',
    api_version: '2025-08-27.basil',
    created: Math.floor(Date.now() / 1000),
    type,
    data: { object: data },
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
  }
}

/**
 * Compute Stripe webhook signature using the async Web Crypto API.
 * Stripe's SDK generateTestHeaderString uses sync crypto which doesn't work
 * in the Cloudflare Workers runtime — we must compute HMAC-SHA256 manually.
 *
 * Stripe signature format: `t={timestamp},v1={hex_hmac}`
 * Signed message: `{timestamp}.{payload}`
 */
async function computeStripeSignature(payload: string, secret: string, timestamp: number): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`))
  const hex = Array.from(new Uint8Array(signed)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `t=${timestamp},v1=${hex}`
}

/**
 * POST a signed Stripe webhook event to the worker.
 * Uses the real STRIPE_WEBHOOK_SECRET from env to sign the payload,
 * so the webhook handler's signature verification will pass.
 */
export async function postWebhookEvent(event: Record<string, unknown>): Promise<Response> {
  const payload = JSON.stringify(event)
  const timestamp = Math.floor(Date.now() / 1000)
  const sig = await computeStripeSignature(payload, env.STRIPE_WEBHOOK_SECRET, timestamp)

  return SELF.fetch('https://fake-host/api/stripe/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': sig,
    },
    body: payload,
  })
}

// ============================================================================
// Stripe Test Object Builders
// ============================================================================

/** Build a minimal Stripe Subscription-shaped object for webhook tests. */
export function buildSubscription(overrides: {
  id?: string
  customerId?: string
  userId: string
  priceId: string
  status?: string
  periodEnd?: number
}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000)
  return {
    id: overrides.id ?? `sub_test_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`,
    object: 'subscription',
    customer: overrides.customerId ?? `cus_test_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`,
    status: overrides.status ?? 'active',
    metadata: { userId: overrides.userId },
    items: {
      object: 'list',
      data: [
        {
          id: `si_test_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`,
          price: { id: overrides.priceId },
          current_period_start: now,
          current_period_end: overrides.periodEnd ?? now + 30 * 86400,
        },
      ],
    },
    current_period_end: overrides.periodEnd ?? now + 30 * 86400,
  }
}

/** Build a minimal Stripe Invoice-shaped object for webhook tests. */
export function buildInvoice(overrides: {
  id?: string
  customerId?: string
  subscriptionId?: string | null
  amountDue?: number
  amountPaid?: number
  metadata?: Record<string, string>
}): Record<string, unknown> {
  return {
    id: overrides.id ?? `in_test_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`,
    object: 'invoice',
    customer: overrides.customerId ?? `cus_test_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`,
    subscription: overrides.subscriptionId ?? null,
    amount_due: overrides.amountDue ?? 0,
    amount_paid: overrides.amountPaid ?? 0,
    status: 'paid',
    metadata: overrides.metadata ?? {},
    lines: { object: 'list', data: [] },
  }
}
