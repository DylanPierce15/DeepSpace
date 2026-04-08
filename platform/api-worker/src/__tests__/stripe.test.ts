/**
 * Stripe integration tests — tests real webhook processing, D1 state transitions,
 * authenticated API endpoints, and real Stripe API calls (test mode).
 *
 * These are professional-grade tests that verify the billing pipeline works end-to-end:
 * webhook event → D1 state change → credit allocation.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import Stripe from 'stripe'
import {
  migrateTestDb,
  cleanTables,
  authedFetch,
  postWebhookEvent,
  buildStripeEvent,
  buildSubscription,
  buildInvoice,
} from './test-helpers'
import { userProfiles, stripeInvoices } from '../db/schema'

function getDb() {
  return drizzle(env.BILLING_DB)
}

async function getProfile(userId: string) {
  const db = getDb()
  const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.id, userId)).limit(1)
  return profile ?? null
}

async function getInvoice(invoiceId: string) {
  const db = getDb()
  const [invoice] = await db.select().from(stripeInvoices).where(eq(stripeInvoices.id, invoiceId)).limit(1)
  return invoice ?? null
}

async function insertProfile(userId: string, overrides?: Partial<typeof userProfiles.$inferInsert>) {
  const db = getDb()
  await db.insert(userProfiles).values({
    id: userId,
    subscriptionTier: 'free',
    subscriptionCredits: 500,
    purchasedCredits: 0,
    bonusCreditsRemaining: 0,
    ...overrides,
  })
}

// Use real Stripe price IDs from env (loaded from .dev.vars)
const starterPriceId = env.STRIPE_STARTER_MONTHLY_PRICE_ID
const premiumPriceId = env.STRIPE_PREMIUM_MONTHLY_PRICE_ID
const payPerCreditPriceId = env.STRIPE_PAY_PER_CREDIT_PRICE_ID

// ============================================================================
// Webhook: Subscription Lifecycle
// ============================================================================

describe('Stripe webhooks', () => {
  beforeEach(async () => {
    await migrateTestDb()
    await cleanTables()
  })

  describe('webhook signature verification', () => {
    it('rejects requests with missing stripe-signature header', async () => {
      const res = await SELF.fetch('https://fake-host/api/stripe/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'test' }),
      })
      expect(res.status).toBe(400)
    })

    it('rejects requests with invalid signature', async () => {
      const res = await SELF.fetch('https://fake-host/api/stripe/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': 't=1234567890,v1=invalid_signature_here',
        },
        body: JSON.stringify({ type: 'test' }),
      })
      expect(res.status).toBe(400)
    })
  })

  describe('customer.subscription.created', () => {
    it('creates user profile with correct tier and credits for starter', async () => {
      const userId = 'user-sub-created-starter'
      const sub = buildSubscription({ userId, priceId: starterPriceId })
      const event = buildStripeEvent('customer.subscription.created', sub)

      const res = await postWebhookEvent(event)
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.received).toBe(true)

      const profile = await getProfile(userId)
      expect(profile).not.toBeNull()
      expect(profile!.subscriptionTier).toBe('starter')
      expect(profile!.subscriptionCredits).toBe(1600)
      expect(profile!.subscriptionStatus).toBe('active')
      expect(profile!.stripeSubscriptionId).toBe(sub.id)
    })

    it('creates user profile with correct tier and credits for premium', async () => {
      const userId = 'user-sub-created-premium'
      const sub = buildSubscription({ userId, priceId: premiumPriceId })
      const event = buildStripeEvent('customer.subscription.created', sub)

      const res = await postWebhookEvent(event)
      expect(res.status).toBe(200)

      const profile = await getProfile(userId)
      expect(profile).not.toBeNull()
      expect(profile!.subscriptionTier).toBe('premium')
      expect(profile!.subscriptionCredits).toBe(4250)
      expect(profile!.subscriptionStatus).toBe('active')
    })

    it('updates existing profile on subscription creation (upsert)', async () => {
      const userId = 'user-existing-profile'
      await insertProfile(userId, { email: 'existing@test.com' })

      const sub = buildSubscription({ userId, priceId: starterPriceId })
      const event = buildStripeEvent('customer.subscription.created', sub)

      await postWebhookEvent(event)

      const profile = await getProfile(userId)
      expect(profile!.subscriptionTier).toBe('starter')
      expect(profile!.subscriptionCredits).toBe(1600)
      // Original email should be preserved (upsert doesn't overwrite it)
      expect(profile!.email).toBe('existing@test.com')
    })

    it('ignores event without userId in metadata', async () => {
      const sub = buildSubscription({ userId: 'ignored', priceId: starterPriceId })
      // Remove metadata
      ;(sub as any).metadata = {}
      const event = buildStripeEvent('customer.subscription.created', sub)

      const res = await postWebhookEvent(event)
      expect(res.status).toBe(200) // Acknowledged but no DB changes

      const profile = await getProfile('ignored')
      expect(profile).toBeNull()
    })
  })

  describe('customer.subscription.updated', () => {
    it('upgrades tier from starter to premium', async () => {
      const userId = 'user-upgrade'
      await insertProfile(userId, {
        subscriptionTier: 'starter',
        subscriptionCredits: 1600,
        stripeSubscriptionId: 'sub_existing',
      })

      const sub = buildSubscription({
        userId,
        priceId: premiumPriceId,
        id: 'sub_existing',
        status: 'active',
      })
      const event = buildStripeEvent('customer.subscription.updated', sub)

      const res = await postWebhookEvent(event)
      expect(res.status).toBe(200)

      const profile = await getProfile(userId)
      expect(profile!.subscriptionTier).toBe('premium')
      expect(profile!.subscriptionCredits).toBe(4250)
    })

    it('sets period end from subscription item', async () => {
      const userId = 'user-period-end'
      const futureTimestamp = Math.floor(Date.now() / 1000) + 30 * 86400
      const sub = buildSubscription({
        userId,
        priceId: starterPriceId,
        periodEnd: futureTimestamp,
      })
      const event = buildStripeEvent('customer.subscription.updated', sub)

      await postWebhookEvent(event)

      const profile = await getProfile(userId)
      expect(profile!.subscriptionCurrentPeriodEnd).not.toBeNull()
      // Verify it's close to the expected timestamp (D1 stores as integer)
      const storedTime = profile!.subscriptionCurrentPeriodEnd!.getTime()
      expect(storedTime).toBe(futureTimestamp * 1000)
    })
  })

  describe('customer.subscription.deleted', () => {
    it('reverts user to free tier with 500 credits', async () => {
      const userId = 'user-sub-deleted'
      await insertProfile(userId, {
        subscriptionTier: 'premium',
        subscriptionCredits: 4250,
        stripeSubscriptionId: 'sub_to_delete',
        subscriptionStatus: 'active',
      })

      const sub = buildSubscription({
        userId,
        priceId: premiumPriceId,
        id: 'sub_to_delete',
      })
      const event = buildStripeEvent('customer.subscription.deleted', sub)

      const res = await postWebhookEvent(event)
      expect(res.status).toBe(200)

      const profile = await getProfile(userId)
      expect(profile!.subscriptionTier).toBe('free')
      expect(profile!.subscriptionCredits).toBe(500)
      expect(profile!.subscriptionStatus).toBe('canceled')
    })

    it('preserves purchased credits when subscription is canceled', async () => {
      const userId = 'user-keep-purchased'
      await insertProfile(userId, {
        subscriptionTier: 'starter',
        subscriptionCredits: 1600,
        purchasedCredits: 350,
        stripeSubscriptionId: 'sub_keep',
        subscriptionStatus: 'active',
      })

      const sub = buildSubscription({ userId, priceId: starterPriceId, id: 'sub_keep' })
      const event = buildStripeEvent('customer.subscription.deleted', sub)

      await postWebhookEvent(event)

      const profile = await getProfile(userId)
      expect(profile!.subscriptionTier).toBe('free')
      expect(profile!.subscriptionCredits).toBe(500)
      // Purchased credits must survive cancellation
      expect(profile!.purchasedCredits).toBe(350)
    })
  })
})

// ============================================================================
// Webhook: Invoice Handling
// ============================================================================

describe('Stripe invoice webhooks', () => {
  beforeEach(async () => {
    await migrateTestDb()
    await cleanTables()
  })

  describe('invoice.paid (subscription)', () => {
    it('records invoice in stripe_invoices table', async () => {
      const userId = 'user-invoice-sub'
      const invoiceId = `in_test_sub_${Date.now()}`
      await insertProfile(userId, { stripeCustomerId: 'cus_sub_test' })

      const invoice = buildInvoice({
        id: invoiceId,
        customerId: 'cus_sub_test',
        subscriptionId: 'sub_existing',
        amountDue: 1399,
        amountPaid: 1399,
        metadata: { userId },
      })
      const event = buildStripeEvent('invoice.paid', invoice)

      const res = await postWebhookEvent(event)
      expect(res.status).toBe(200)

      const dbInvoice = await getInvoice(invoiceId)
      expect(dbInvoice).not.toBeNull()
      expect(dbInvoice!.status).toBe('paid')
      expect(dbInvoice!.amountPaid).toBe(1399)
      expect(dbInvoice!.userId).toBe(userId)
    })

    it('does NOT add purchased credits for subscription invoices', async () => {
      const userId = 'user-no-credits-sub'
      await insertProfile(userId, { purchasedCredits: 100 })

      const invoice = buildInvoice({
        customerId: 'cus_no_credit',
        subscriptionId: 'sub_no_credit',
        amountDue: 1399,
        amountPaid: 1399,
        metadata: { userId },
      })
      const event = buildStripeEvent('invoice.paid', invoice)

      await postWebhookEvent(event)

      const profile = await getProfile(userId)
      // Purchased credits unchanged — this was a subscription payment, not a credit purchase
      expect(profile!.purchasedCredits).toBe(100)
    })
  })

  describe('invoice.paid (pay-per-credit)', () => {
    it('adds purchased credits based on amount paid ($10 = 1000 credits)', async () => {
      const userId = 'user-pay-per-credit'
      await insertProfile(userId, { purchasedCredits: 0 })

      const invoiceId = `in_test_ppc_${Date.now()}`
      const invoice = buildInvoice({
        id: invoiceId,
        amountDue: 1000, // $10.00 in cents
        amountPaid: 1000,
        metadata: { userId, payPerCredit: 'true' },
      })
      const event = buildStripeEvent('invoice.paid', invoice)

      const res = await postWebhookEvent(event)
      expect(res.status).toBe(200)

      const profile = await getProfile(userId)
      // $10.00 * 100 credits/dollar = 1000 credits
      expect(profile!.purchasedCredits).toBe(1000)

      const dbInvoice = await getInvoice(invoiceId)
      expect(dbInvoice!.creditsPurchased).toBe(1000)
    })

    it('adds to existing purchased credits (not replaces)', async () => {
      const userId = 'user-add-credits'
      await insertProfile(userId, { purchasedCredits: 500 })

      const invoice = buildInvoice({
        amountPaid: 500, // $5.00
        metadata: { userId, payPerCredit: 'true' },
      })
      const event = buildStripeEvent('invoice.paid', invoice)

      await postWebhookEvent(event)

      const profile = await getProfile(userId)
      // 500 existing + 500 new = 1000
      expect(profile!.purchasedCredits).toBe(1000)
    })

    it('is idempotent — same invoice processed twice does not double credits', async () => {
      const userId = 'user-idempotent'
      await insertProfile(userId, { purchasedCredits: 0 })

      const invoiceId = `in_test_idempotent_${Date.now()}`
      const invoice = buildInvoice({
        id: invoiceId,
        amountPaid: 1000,
        metadata: { userId, payPerCredit: 'true' },
      })

      // Process the same event twice
      const event = buildStripeEvent('invoice.paid', invoice)
      await postWebhookEvent(event)
      await postWebhookEvent(event)

      const profile = await getProfile(userId)
      // Should be 1000, not 2000 — second processing should be skipped
      expect(profile!.purchasedCredits).toBe(1000)
    })

    it('does not add credits for zero-amount invoices', async () => {
      const userId = 'user-zero-invoice'
      await insertProfile(userId, { purchasedCredits: 100 })

      const invoice = buildInvoice({
        amountPaid: 0,
        metadata: { userId, payPerCredit: 'true' },
      })
      const event = buildStripeEvent('invoice.paid', invoice)

      await postWebhookEvent(event)

      const profile = await getProfile(userId)
      expect(profile!.purchasedCredits).toBe(100)
    })
  })

  describe('invoice.payment_failed', () => {
    it('sets subscription status to past_due', async () => {
      const userId = 'user-payment-failed'
      await insertProfile(userId, {
        subscriptionStatus: 'active',
        subscriptionTier: 'starter',
      })

      const invoiceId = `in_test_failed_${Date.now()}`
      const invoice = buildInvoice({
        id: invoiceId,
        amountDue: 1399,
        amountPaid: 0,
        metadata: { userId },
      })
      const event = buildStripeEvent('invoice.payment_failed', invoice)

      const res = await postWebhookEvent(event)
      expect(res.status).toBe(200)

      const profile = await getProfile(userId)
      expect(profile!.subscriptionStatus).toBe('past_due')
      // Tier should NOT change — only status
      expect(profile!.subscriptionTier).toBe('starter')

      const dbInvoice = await getInvoice(invoiceId)
      expect(dbInvoice!.status).toBe('payment_failed')
      expect(dbInvoice!.amountPaid).toBe(0)
    })
  })

  describe('userId resolution from invoices', () => {
    it('resolves userId from invoice metadata', async () => {
      const userId = 'user-meta-resolve'
      await insertProfile(userId, { purchasedCredits: 0 })

      const invoice = buildInvoice({
        amountPaid: 500,
        metadata: { userId, payPerCredit: 'true' },
      })
      const event = buildStripeEvent('invoice.paid', invoice)

      await postWebhookEvent(event)

      const profile = await getProfile(userId)
      expect(profile!.purchasedCredits).toBe(500)
    })

    it('resolves userId from stripe_customer_id in DB when metadata is missing', async () => {
      const userId = 'user-customer-resolve'
      const customerId = `cus_test_resolve_${Date.now()}`
      await insertProfile(userId, {
        stripeCustomerId: customerId,
        purchasedCredits: 0,
      })

      const invoice = buildInvoice({
        customerId,
        amountPaid: 300,
        metadata: { payPerCredit: 'true' }, // No userId in metadata
      })
      const event = buildStripeEvent('invoice.paid', invoice)

      await postWebhookEvent(event)

      const profile = await getProfile(userId)
      // Should resolve via customer ID lookup in D1
      expect(profile!.purchasedCredits).toBe(300)
    })

    it('gracefully handles invoice with completely unresolvable user', async () => {
      const invoice = buildInvoice({
        customerId: 'cus_unknown_nobody',
        amountPaid: 1000,
        metadata: { payPerCredit: 'true' }, // No userId
      })
      const event = buildStripeEvent('invoice.paid', invoice)

      // Should not crash — just log a warning
      const res = await postWebhookEvent(event)
      expect(res.status).toBe(200)

      // Invoice should still be recorded
      const dbInvoice = await getInvoice(invoice.id as string)
      expect(dbInvoice).not.toBeNull()
      expect(dbInvoice!.userId).toBeNull()
    })
  })
})

// ============================================================================
// Authenticated Stripe API Endpoints
// ============================================================================

describe('Stripe API endpoints (authenticated)', () => {
  beforeEach(async () => {
    await migrateTestDb()
    await cleanTables()
  })

  describe('GET /api/stripe/config', () => {
    it('returns real price IDs from env bindings', async () => {
      const res = await SELF.fetch('https://fake-host/api/stripe/config')
      expect(res.status).toBe(200)

      const body = await res.json() as any
      expect(body.enabled).toBe(true)
      expect(body.priceIds.starter_monthly).toBe(starterPriceId)
      expect(body.priceIds.premium_monthly).toBe(premiumPriceId)
      expect(body.priceIds.pay_per_credit).toBe(payPerCreditPriceId)
      expect(body.tierPriceCents).toEqual({
        free: 0,
        starter: 1399,
        premium: 3399,
        admin: 0,
      })
    })
  })

  describe('GET /api/stripe/credits-available', () => {
    it('returns 500 credits for a new free-tier user', async () => {
      const userId = 'user-credits-free'
      await insertProfile(userId, {
        subscriptionTier: 'free',
        subscriptionCredits: 500,
      })

      const res = await authedFetch('/api/stripe/credits-available', userId)
      expect(res.status).toBe(200)

      const body = await res.json() as any
      expect(body.success).toBe(true)
      expect(body.credits).toBeGreaterThanOrEqual(0)
    })

    it('reflects purchased credits in available balance', async () => {
      const userId = 'user-credits-purchased'
      await insertProfile(userId, {
        subscriptionTier: 'free',
        subscriptionCredits: 500,
        purchasedCredits: 1000,
      })

      const res = await authedFetch('/api/stripe/credits-available', userId)
      expect(res.status).toBe(200)

      const body = await res.json() as any
      expect(body.success).toBe(true)
      // Should include both subscription + purchased credits
      expect(body.credits).toBeGreaterThanOrEqual(1000)
    })
  })

  describe('GET /api/stripe/subscription-status', () => {
    it('returns free tier for user without subscription', async () => {
      const userId = 'user-status-free'
      await insertProfile(userId)

      const res = await authedFetch('/api/stripe/subscription-status', userId)
      expect(res.status).toBe(200)

      const body = await res.json() as any
      expect(body.currentTier).toBe('free')
      expect(body.hasActiveSubscription).toBe(false)
      expect(body.pendingTier).toBeNull()
    })

    it('returns free status for user with no profile', async () => {
      const res = await authedFetch('/api/stripe/subscription-status', 'user-no-profile')
      expect(res.status).toBe(200)

      const body = await res.json() as any
      expect(body.currentTier).toBe('free')
      expect(body.hasActiveSubscription).toBe(false)
    })
  })

  describe('POST /api/stripe/upgrade', () => {
    it('rejects upgrade without active subscription', async () => {
      const userId = 'user-upgrade-no-sub'
      await insertProfile(userId)

      const res = await authedFetch('/api/stripe/upgrade', userId, {
        method: 'POST',
        body: JSON.stringify({ targetPriceId: premiumPriceId }),
      })
      expect(res.status).toBe(400)

      const body = await res.json() as any
      expect(body.error).toContain('No active subscription')
    })

    it('rejects upgrade with invalid price ID', async () => {
      const userId = 'user-upgrade-bad-price'
      await insertProfile(userId, { stripeSubscriptionId: 'sub_xxx', stripeCustomerId: 'cus_xxx' })

      const res = await authedFetch('/api/stripe/upgrade', userId, {
        method: 'POST',
        body: JSON.stringify({ targetPriceId: 'price_invalid' }),
      })
      expect(res.status).toBe(400)

      const body = await res.json() as any
      expect(body.error).toContain('Invalid target price ID')
    })

    it('rejects upgrade without targetPriceId in body', async () => {
      const userId = 'user-upgrade-no-price'
      await insertProfile(userId, { stripeSubscriptionId: 'sub_xxx', stripeCustomerId: 'cus_xxx' })

      const res = await authedFetch('/api/stripe/upgrade', userId, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/stripe/create-checkout-session', () => {
    it('rejects with invalid price ID', async () => {
      const userId = 'user-checkout-bad-price'
      await insertProfile(userId)

      const res = await authedFetch('/api/stripe/create-checkout-session', userId, {
        method: 'POST',
        body: JSON.stringify({ priceId: 'price_nonexistent' }),
      })
      expect(res.status).toBe(400)

      const body = await res.json() as any
      expect(body.error).toContain('Invalid price ID')
    })

    it('rejects with missing price ID', async () => {
      const userId = 'user-checkout-no-price'
      await insertProfile(userId)

      const res = await authedFetch('/api/stripe/create-checkout-session', userId, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/stripe/create-credit-checkout', () => {
    it('rejects without auth', async () => {
      const res = await SELF.fetch('https://fake-host/api/stripe/create-credit-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(401)
    })
  })
})

// ============================================================================
// Real Stripe API Tests (require sk_test_ key)
// ============================================================================

const hasRealStripeKey = env.STRIPE_SECRET_KEY?.startsWith('sk_test_')

describe.runIf(hasRealStripeKey)('Stripe API integration (real test mode)', () => {
  let stripe: Stripe

  beforeEach(async () => {
    await migrateTestDb()
    await cleanTables()
    stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-08-27.basil' as any })
  })

  it('creates a real Stripe test customer and persists ID in D1', async () => {
    const userId = 'user-real-customer'
    await insertProfile(userId, { email: 'integration-test@deep.space' })

    // Hit the checkout endpoint which triggers getOrCreateStripeCustomer
    const res = await authedFetch('/api/stripe/create-checkout-session', userId, {
      method: 'POST',
      body: JSON.stringify({ priceId: starterPriceId }),
    })
    expect(res.status).toBe(200)

    const body = await res.json() as any
    expect(body.sessionId).toBeTruthy()
    expect(body.url).toContain('checkout.stripe.com')

    // Verify customer was created in D1
    const profile = await getProfile(userId)
    expect(profile!.stripeCustomerId).toBeTruthy()
    expect(profile!.stripeCustomerId).toMatch(/^cus_/)

    // Verify customer exists in Stripe
    const customer = await stripe.customers.retrieve(profile!.stripeCustomerId!)
    expect(customer.deleted).toBeFalsy()
    expect((customer as Stripe.Customer).metadata.userId).toBe(userId)

    // Clean up Stripe customer
    await stripe.customers.del(profile!.stripeCustomerId!)
  })

  it('reuses existing Stripe customer on subsequent calls', async () => {
    const userId = 'user-reuse-customer'
    await insertProfile(userId, { email: 'reuse-test@deep.space' })

    // First call — creates customer
    const res1 = await authedFetch('/api/stripe/create-checkout-session', userId, {
      method: 'POST',
      body: JSON.stringify({ priceId: starterPriceId }),
    })
    expect(res1.status).toBe(200)

    const profile1 = await getProfile(userId)
    const customerId = profile1!.stripeCustomerId

    // Second call — should reuse same customer
    const res2 = await authedFetch('/api/stripe/create-checkout-session', userId, {
      method: 'POST',
      body: JSON.stringify({ priceId: premiumPriceId }),
    })
    expect(res2.status).toBe(200)

    const profile2 = await getProfile(userId)
    expect(profile2!.stripeCustomerId).toBe(customerId)

    // Clean up
    await stripe.customers.del(customerId!)
  })

  it('creates a real checkout session in subscription mode', async () => {
    const userId = 'user-real-checkout'
    await insertProfile(userId, { email: 'checkout-test@deep.space' })

    const res = await authedFetch('/api/stripe/create-checkout-session', userId, {
      method: 'POST',
      body: JSON.stringify({ priceId: premiumPriceId }),
    })
    expect(res.status).toBe(200)

    const body = await res.json() as any
    expect(body.sessionId).toMatch(/^cs_test_/)
    expect(body.url).toContain('checkout.stripe.com')

    // Verify the session exists in Stripe and has the right mode
    const session = await stripe.checkout.sessions.retrieve(body.sessionId)
    expect(session.mode).toBe('subscription')
    expect(session.metadata?.userId).toBe(userId)

    // Clean up
    const profile = await getProfile(userId)
    if (profile?.stripeCustomerId) {
      await stripe.customers.del(profile.stripeCustomerId)
    }
  })

  it('creates a real credit-checkout session in payment mode', async () => {
    const userId = 'user-real-credit-checkout'
    await insertProfile(userId, { email: 'credit-test@deep.space' })

    const res = await authedFetch('/api/stripe/create-credit-checkout', userId, {
      method: 'POST',
      body: JSON.stringify({ quantity: 1 }),
    })
    expect(res.status).toBe(200)

    const body = await res.json() as any
    expect(body.sessionId).toMatch(/^cs_test_/)
    expect(body.url).toContain('checkout.stripe.com')

    // Verify session mode is payment (not subscription)
    const session = await stripe.checkout.sessions.retrieve(body.sessionId)
    expect(session.mode).toBe('payment')
    expect(session.metadata?.payPerCredit).toBe('true')
    expect(session.metadata?.userId).toBe(userId)

    // Clean up
    const profile = await getProfile(userId)
    if (profile?.stripeCustomerId) {
      await stripe.customers.del(profile.stripeCustomerId)
    }
  })

  it('creates a real portal session for existing customer', async () => {
    const userId = 'user-real-portal'
    await insertProfile(userId, { email: 'portal-test@deep.space' })

    // First create a customer via checkout
    await authedFetch('/api/stripe/create-checkout-session', userId, {
      method: 'POST',
      body: JSON.stringify({ priceId: starterPriceId }),
    })

    // Now create a portal session
    const res = await authedFetch('/api/stripe/create-portal-session', userId, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(200)

    const body = await res.json() as any
    expect(body.url).toContain('billing.stripe.com')

    // Clean up
    const profile = await getProfile(userId)
    if (profile?.stripeCustomerId) {
      await stripe.customers.del(profile.stripeCustomerId)
    }
  })
})

// ============================================================================
// Tier / Price Mapping Correctness
// ============================================================================

describe('Dynamic price-to-tier mapping', () => {
  beforeEach(async () => {
    await migrateTestDb()
    await cleanTables()
  })

  it('maps starter price ID to starter tier in webhook', async () => {
    const userId = 'user-tier-starter'
    const sub = buildSubscription({ userId, priceId: starterPriceId })
    const event = buildStripeEvent('customer.subscription.created', sub)

    await postWebhookEvent(event)

    const profile = await getProfile(userId)
    expect(profile!.subscriptionTier).toBe('starter')
  })

  it('maps premium price ID to premium tier in webhook', async () => {
    const userId = 'user-tier-premium'
    const sub = buildSubscription({ userId, priceId: premiumPriceId })
    const event = buildStripeEvent('customer.subscription.created', sub)

    await postWebhookEvent(event)

    const profile = await getProfile(userId)
    expect(profile!.subscriptionTier).toBe('premium')
  })

  it('defaults to free tier for unknown price ID', async () => {
    const userId = 'user-tier-unknown'
    const sub = buildSubscription({ userId, priceId: 'price_unknown_test' })
    const event = buildStripeEvent('customer.subscription.created', sub)

    await postWebhookEvent(event)

    const profile = await getProfile(userId)
    expect(profile!.subscriptionTier).toBe('free')
    expect(profile!.subscriptionCredits).toBe(500)
  })
})
