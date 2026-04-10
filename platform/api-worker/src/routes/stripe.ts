/**
 * Stripe routes — ported from Miyagi3's stripe.ts for Hono + D1.
 */

import { Hono } from 'hono'
import Stripe from 'stripe'
import { eq, sql } from 'drizzle-orm'
import { safeJson } from 'deepspace/worker'
import type { Env } from '../worker'
import { authMiddleware } from '../middleware/auth'
import { userProfiles, stripeInvoices } from '../db/schema'
import {
  creditsAvailableForUser,
  subscriptionTierToCredits,
  dollarsToCredits,
} from '../billing/service'
import { getDb } from '../worker'

type SubscriptionTier = 'free' | 'starter' | 'premium' | 'admin'

/** Tier prices in cents — matches Miyagi3 */
const TIER_PRICE_CENTS: Record<SubscriptionTier, number> = {
  free: 0,
  starter: 1399,
  premium: 3399,
  admin: 0,
}

const TIER_ORDER: Record<SubscriptionTier, number> = {
  free: 0,
  starter: 1,
  premium: 2,
  admin: 3,
}

/** Returns price IDs from env bindings — must be called per-request. */
function getStripePriceIds(env: Env['Bindings']) {
  return {
    starter_monthly: env.STRIPE_STARTER_MONTHLY_PRICE_ID,
    premium_monthly: env.STRIPE_PREMIUM_MONTHLY_PRICE_ID,
    pay_per_credit: env.STRIPE_PAY_PER_CREDIT_PRICE_ID,
  }
}

/** Builds the price-ID-to-tier map dynamically from env. */
function buildPriceToTierMap(env: Env['Bindings']): Record<string, SubscriptionTier> {
  const ids = getStripePriceIds(env)
  const map: Record<string, SubscriptionTier> = {}
  if (ids.starter_monthly) map[ids.starter_monthly] = 'starter'
  if (ids.premium_monthly) map[ids.premium_monthly] = 'premium'
  return map
}

function creditsForTier(tier: string | null | undefined): number {
  if (!tier) return 0
  if (['free', 'starter', 'premium', 'admin'].includes(tier)) {
    return subscriptionTierToCredits(tier as SubscriptionTier)
  }
  return 0
}

function getStripe(env: Env['Bindings']): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured')
  }
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-08-27.basil' as any })
}

const stripe = new Hono<Env>()

// ============================================================================
// GET /config — public
// ============================================================================

stripe.get('/config', (c) => {
  const priceIds = getStripePriceIds(c.env)
  return safeJson(c, {
    enabled: !!c.env.STRIPE_SECRET_KEY,
    publishableKey: c.env.STRIPE_PUBLISHABLE_KEY ?? '',
    priceIds,
    tierPriceCents: TIER_PRICE_CENTS,
  })
})

// ============================================================================
// POST /create-checkout-session — JWT auth
// ============================================================================

stripe.post('/create-checkout-session', authMiddleware, async (c) => {
  const stripeClient = getStripe(c.env)
  const db = getDb(c.env)
  const userId = c.get('userId')
  const { priceId, returnUrl } = await c.req.json<{ priceId: string; returnUrl?: string }>()

  const priceIds = getStripePriceIds(c.env)
  const validPriceIds = [priceIds.starter_monthly, priceIds.premium_monthly]
  if (!priceId || !validPriceIds.includes(priceId)) {
    return safeJson(c, { error: 'Invalid price ID' }, 400)
  }

  const customer = await getOrCreateStripeCustomer(stripeClient, db, userId)
  const resolvedReturnUrl = returnUrl || 'https://deep.space/'

  const session = await stripeClient.checkout.sessions.create({
    customer: customer.id,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: resolvedReturnUrl,
    cancel_url: resolvedReturnUrl,
    metadata: { userId },
    subscription_data: { metadata: { userId } },
  })

  return safeJson(c, { sessionId: session.id, url: session.url ?? '' })
})

// ============================================================================
// POST /upgrade — Mid-month subscription upgrade (JWT auth)
// ============================================================================

stripe.post('/upgrade', authMiddleware, async (c) => {
  const stripeClient = getStripe(c.env)
  const db = getDb(c.env)
  const userId = c.get('userId')
  const { targetPriceId } = await c.req.json<{ targetPriceId: string }>()

  const priceToTier = buildPriceToTierMap(c.env)

  if (!targetPriceId || !priceToTier[targetPriceId]) {
    return safeJson(c, { error: 'Invalid target price ID' }, 400)
  }

  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)

  if (!profile?.stripeSubscriptionId || !profile?.stripeCustomerId) {
    return safeJson(c, { error: 'No active subscription to upgrade. Please subscribe first.' }, 400)
  }

  const subscription = await stripeClient.subscriptions.retrieve(
    profile.stripeSubscriptionId,
    { expand: ['default_payment_method'] },
  )
  if (subscription.status !== 'active') {
    return safeJson(c, { error: 'Subscription is not active' }, 400)
  }

  const currentPriceId = subscription.items.data[0]?.price?.id
  const currentTier = (currentPriceId ? priceToTier[currentPriceId] : null) ?? 'free'
  const targetTier = priceToTier[targetPriceId]

  const currentCents = TIER_PRICE_CENTS[currentTier]
  const targetCents = TIER_PRICE_CENTS[targetTier]
  if (targetCents <= currentCents) {
    return safeJson(c, { error: 'Can only upgrade to a higher tier. Use the customer portal for downgrades.' }, 400)
  }

  // Resolve payment method
  let paymentMethodId: string | null = null
  if (subscription.default_payment_method) {
    paymentMethodId = typeof subscription.default_payment_method === 'string'
      ? subscription.default_payment_method
      : subscription.default_payment_method.id
  }
  if (!paymentMethodId) {
    const customer = await stripeClient.customers.retrieve(profile.stripeCustomerId)
    if (!customer.deleted && customer.invoice_settings?.default_payment_method) {
      paymentMethodId = typeof customer.invoice_settings.default_payment_method === 'string'
        ? customer.invoice_settings.default_payment_method
        : customer.invoice_settings.default_payment_method.id
    }
  }
  if (!paymentMethodId) {
    return safeJson(c, { error: 'No payment method found. Please update your payment method and try again.' }, 400)
  }

  const priceDiffCents = targetCents - currentCents
  const newCredits = subscriptionTierToCredits(targetTier)

  // Create one-off invoice for the price difference
  const invoice = await stripeClient.invoices.create({
    customer: profile.stripeCustomerId,
    auto_advance: false,
    collection_method: 'charge_automatically',
    metadata: {
      type: 'upgrade',
      userId,
      fromTier: currentTier,
      toTier: targetTier,
    },
  })

  await stripeClient.invoiceItems.create({
    customer: profile.stripeCustomerId,
    invoice: invoice.id,
    amount: priceDiffCents,
    currency: 'usd',
    description: `Upgrade from ${currentTier} to ${targetTier}`,
  })

  // Finalize and pay immediately
  try {
    await stripeClient.invoices.finalizeInvoice(invoice.id)
    await stripeClient.invoices.pay(invoice.id, { payment_method: paymentMethodId })
  } catch (payError) {
    await stripeClient.invoices.voidInvoice(invoice.id)
    console.error(`Upgrade payment failed for user ${userId}:`, payError)
    return safeJson(c, { error: 'Payment failed. Please check your payment method and try again.' }, 400)
  }

  // Update Stripe subscription item to new price
  const subscriptionItemId = subscription.items.data[0]?.id
  if (subscriptionItemId) {
    await stripeClient.subscriptions.update(subscription.id, {
      items: [{ id: subscriptionItemId, price: targetPriceId }],
      proration_behavior: 'none',
      metadata: { userId },
    })
  }

  // Update local profile
  await db
    .update(userProfiles)
    .set({
      subscriptionTier: targetTier,
      subscriptionCredits: newCredits,
      updatedAt: new Date(),
    })
    .where(eq(userProfiles.id, userId))

  console.log(`Upgraded user ${userId}: ${currentTier} -> ${targetTier}, charged $${(priceDiffCents / 100).toFixed(2)}`)

  return safeJson(c, {
    success: true,
    message: `Upgraded to ${targetTier}. Charged $${(priceDiffCents / 100).toFixed(2)}.`,
    previousTier: currentTier,
    newTier: targetTier,
    charged: priceDiffCents,
    newCredits,
  })
})

// ============================================================================
// POST /create-credit-checkout — Pay-per-credit purchase (JWT auth)
// ============================================================================

stripe.post('/create-credit-checkout', authMiddleware, async (c) => {
  const stripeClient = getStripe(c.env)
  const db = getDb(c.env)
  const userId = c.get('userId')
  const { quantity, returnUrl } = await c.req.json<{ quantity?: number; returnUrl?: string }>()

  const priceIds = getStripePriceIds(c.env)
  if (!priceIds.pay_per_credit) {
    return safeJson(c, { error: 'Pay-per-credit is not configured' }, 503)
  }

  const resolvedQuantity = quantity && quantity > 0 ? quantity : 1
  const customer = await getOrCreateStripeCustomer(stripeClient, db, userId)
  const resolvedReturnUrl = returnUrl || 'https://deep.space/'

  const session = await stripeClient.checkout.sessions.create({
    customer: customer.id,
    payment_method_types: ['card'],
    line_items: [{ price: priceIds.pay_per_credit, quantity: resolvedQuantity }],
    mode: 'payment',
    success_url: resolvedReturnUrl,
    cancel_url: resolvedReturnUrl,
    metadata: { userId, payPerCredit: 'true' },
    invoice_creation: {
      enabled: true,
      invoice_data: {
        metadata: { userId, payPerCredit: 'true' },
      },
    },
  })

  return safeJson(c, { sessionId: session.id, url: session.url ?? '' })
})

// ============================================================================
// POST /create-portal-session — JWT auth
// ============================================================================

stripe.post('/create-portal-session', authMiddleware, async (c) => {
  const stripeClient = getStripe(c.env)
  const db = getDb(c.env)
  const userId = c.get('userId')
  const { returnUrl } = await c.req.json<{ returnUrl?: string }>()

  const customer = await getOrCreateStripeCustomer(stripeClient, db, userId)

  const session = await stripeClient.billingPortal.sessions.create({
    customer: customer.id,
    return_url: returnUrl || 'https://deep.space/',
  })

  return safeJson(c, { url: session.url })
})

// ============================================================================
// GET /credits-available — JWT auth
// ============================================================================

stripe.get('/credits-available', authMiddleware, async (c) => {
  const db = getDb(c.env)
  const userId = c.get('userId')

  try {
    const result = await creditsAvailableForUser(db, userId)
    return safeJson(c, { success: true, credits: result.credits })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get credits'
    return safeJson(c, { success: false, credits: null, error: message }, 500)
  }
})

// ============================================================================
// GET /subscription-status — JWT auth
// ============================================================================

stripe.get('/subscription-status', authMiddleware, async (c) => {
  const stripeClient = getStripe(c.env)
  const db = getDb(c.env)
  const userId = c.get('userId')
  const priceToTier = buildPriceToTierMap(c.env)

  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)

  if (!profile) {
    return safeJson(c, {
      currentTier: 'free',
      hasActiveSubscription: false,
      pendingTier: null,
      pendingEffectiveDate: null,
      currentPeriodEnd: null,
    })
  }

  if (!profile.stripeSubscriptionId) {
    return safeJson(c, {
      currentTier: profile.subscriptionTier ?? 'free',
      hasActiveSubscription: false,
      pendingTier: null,
      pendingEffectiveDate: null,
      currentPeriodEnd: null,
    })
  }

  let pendingTier: string | null = null
  let pendingEffectiveDate: string | null = null

  try {
    const subscription = await stripeClient.subscriptions.retrieve(
      profile.stripeSubscriptionId,
      { expand: ['schedule'] },
    )

    // Check subscription schedule for pending changes (e.g. downgrade at period end)
    if (subscription.schedule && typeof subscription.schedule !== 'string') {
      const phases = subscription.schedule.phases
      if (phases && phases.length > 1) {
        const nextPhase = phases[1]
        const nextPriceId = typeof nextPhase.items?.[0]?.price === 'string'
          ? nextPhase.items[0].price
          : (nextPhase.items?.[0]?.price as any)?.id
        if (nextPriceId && priceToTier[nextPriceId]) {
          const nextTier = priceToTier[nextPriceId]
          if (nextTier !== profile.subscriptionTier) {
            pendingTier = nextTier
            pendingEffectiveDate = nextPhase.start_date
              ? new Date(nextPhase.start_date * 1000).toISOString()
              : null
          }
        }
      }
    }

    // Check cancel_at_period_end (downgrade to free)
    if (subscription.cancel_at_period_end) {
      pendingTier = 'free'
      const periodEnd = subscription.items?.data?.[0]?.current_period_end
      pendingEffectiveDate = periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null
    }

    return safeJson(c, {
      currentTier: profile.subscriptionTier ?? 'free',
      hasActiveSubscription: subscription.status === 'active',
      pendingTier,
      pendingEffectiveDate,
      currentPeriodEnd: subscription.items.data[0]?.current_period_end
        ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
        : null,
    })
  } catch (err) {
    console.warn('Failed to fetch subscription from Stripe:', err)
    return safeJson(c, {
      currentTier: profile.subscriptionTier ?? 'free',
      hasActiveSubscription: profile.subscriptionStatus === 'active',
      pendingTier: null,
      pendingEffectiveDate: null,
      currentPeriodEnd: null,
    })
  }
})

// ============================================================================
// POST /webhook — raw body, no auth
// ============================================================================

stripe.post('/webhook', async (c) => {
  if (!c.env.STRIPE_SECRET_KEY || !c.env.STRIPE_WEBHOOK_SECRET) {
    return safeJson(c, { error: 'Stripe is not configured' }, 503)
  }

  const stripeClient = getStripe(c.env)
  const db = getDb(c.env)
  const sig = c.req.header('stripe-signature')
  const rawBody = await c.req.text()

  let event: Stripe.Event
  try {
    // Must use constructEventAsync — Cloudflare Workers use SubtleCrypto (async only)
    event = await stripeClient.webhooks.constructEventAsync(rawBody, sig!, c.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return c.text(`Webhook Error: ${err}`, 400)
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdate(stripeClient, db, subscription, c.env)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(db, subscription)
        break
      }

      case 'invoice.payment_succeeded':
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaid(stripeClient, db, invoice)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaymentFailed(stripeClient, db, invoice)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return safeJson(c, { received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return safeJson(c, { error: 'Webhook processing failed' }, 500)
  }
})

// ============================================================================
// Helpers
// ============================================================================

async function getOrCreateStripeCustomer(
  stripeClient: Stripe,
  db: ReturnType<typeof getDb>,
  userId: string,
): Promise<Stripe.Customer> {
  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)

  if (profile?.stripeCustomerId) {
    try {
      const customer = await stripeClient.customers.retrieve(profile.stripeCustomerId)
      if (!customer.deleted) return customer as Stripe.Customer
    } catch {
      // Customer missing in Stripe, create a new one
    }
  }

  const customer = await stripeClient.customers.create({
    email: profile?.email ?? undefined,
    name: profile?.name ?? undefined,
    metadata: { userId },
  })

  if (profile) {
    await db
      .update(userProfiles)
      .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
      .where(eq(userProfiles.id, userId))
  } else {
    await db.insert(userProfiles).values({
      id: userId,
      stripeCustomerId: customer.id,
      subscriptionTier: 'free',
      subscriptionCredits: 500,
    })
  }

  return customer
}

// ============================================================================
// Invoice helpers — resolving userId and subscriptionId from invoices
// ============================================================================

/** Extract subscription ID from an invoice via multiple strategies. */
function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  // Primary path: invoice.parent.subscription_details.subscription
  // The legacy top-level `invoice.subscription` field was removed in Stripe
  // API version 2024-09-30.acacia.
  const parentSub = invoice.parent?.subscription_details?.subscription
  if (parentSub) {
    return typeof parentSub === 'string' ? parentSub : parentSub.id
  }

  // Fallback: derive from line items
  for (const line of invoice.lines?.data ?? []) {
    const lineSub = line.parent?.subscription_item_details?.subscription
    if (lineSub) return lineSub
  }

  return null
}

/** Resolve the userId for an invoice using multiple strategies. */
async function resolveUserIdFromInvoice(
  stripeClient: Stripe,
  db: ReturnType<typeof getDb>,
  invoice: Stripe.Invoice,
): Promise<string | null> {
  // Strategy 1: Invoice metadata
  const metaUserId = (invoice.metadata as any)?.userId as string | undefined
  if (metaUserId) return metaUserId

  // Strategy 2: Subscription metadata
  const subscriptionId = getSubscriptionIdFromInvoice(invoice)
  if (subscriptionId) {
    try {
      const sub = await stripeClient.subscriptions.retrieve(subscriptionId)
      const subUserId = (sub.metadata as any)?.userId as string | undefined
      if (subUserId) return subUserId
    } catch {
      // subscription may have been deleted
    }
  }

  // Strategy 3: Look up customer in our database
  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id
  if (customerId) {
    const [profile] = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(eq(userProfiles.stripeCustomerId, customerId))
      .limit(1)
    if (profile) return profile.id
  }

  return null
}

// ============================================================================
// Webhook handlers
// ============================================================================

async function handleSubscriptionUpdate(
  stripeClient: Stripe,
  db: ReturnType<typeof getDb>,
  subscription: Stripe.Subscription,
  env: Env['Bindings'],
): Promise<void> {
  const userId = (subscription.metadata as any)?.userId as string | undefined
  if (!userId) {
    console.warn(`No userId in subscription ${subscription.id} metadata`)
    return
  }

  const priceToTier = buildPriceToTierMap(env)
  const priceId = subscription.items.data[0]?.price?.id
  const tier = priceId ? priceToTier[priceId] || 'free' : 'free'
  const firstItem = subscription.items.data[0] as any
  const periodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000)
    : null

  await db
    .insert(userProfiles)
    .values({
      id: userId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionTier: tier,
      subscriptionCredits: creditsForTier(tier),
      subscriptionCurrentPeriodEnd: periodEnd,
    })
    .onConflictDoUpdate({
      target: userProfiles.id,
      set: {
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        subscriptionTier: tier,
        subscriptionCredits: creditsForTier(tier),
        subscriptionCurrentPeriodEnd: periodEnd,
        updatedAt: new Date(),
      },
    })

  console.log(`Updated subscription for user ${userId}: tier=${tier}`)
}

async function handleSubscriptionDeleted(
  db: ReturnType<typeof getDb>,
  subscription: Stripe.Subscription,
): Promise<void> {
  const userId = (subscription.metadata as any)?.userId as string | undefined
  if (!userId) return

  await db
    .update(userProfiles)
    .set({
      subscriptionStatus: 'canceled',
      subscriptionTier: 'free',
      subscriptionCredits: subscriptionTierToCredits('free'),
      updatedAt: new Date(),
    })
    .where(eq(userProfiles.id, userId))

  console.log(`Subscription deleted for user ${userId}, reverted to free`)
}

async function handleInvoicePaid(
  stripeClient: Stripe,
  db: ReturnType<typeof getDb>,
  invoice: Stripe.Invoice,
): Promise<void> {
  const userId = await resolveUserIdFromInvoice(stripeClient, db, invoice)

  // Record the invoice
  await db
    .insert(stripeInvoices)
    .values({
      id: invoice.id,
      userId: userId ?? null,
      stripeCustomerId:
        typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null,
      amountDue: invoice.amount_due,
      amountPaid: invoice.amount_paid,
      status: 'paid',
      creditsPurchased: null,
    })
    .onConflictDoUpdate({
      target: stripeInvoices.id,
      set: {
        amountPaid: invoice.amount_paid,
        status: 'paid',
        updatedAt: new Date(),
      },
    })

  if (!userId) {
    console.warn(`Could not resolve userId for invoice ${invoice.id}`)
    return
  }

  // Determine if this is a pay-per-credit invoice
  const isPayPerCredit = (invoice.metadata as any)?.payPerCredit === 'true'
  const hasSubscription = !!getSubscriptionIdFromInvoice(invoice)

  if (isPayPerCredit || (!hasSubscription && invoice.amount_paid > 0)) {
    // Check if we already processed this invoice (idempotency)
    const [existing] = await db
      .select({ status: stripeInvoices.status, creditsPurchased: stripeInvoices.creditsPurchased })
      .from(stripeInvoices)
      .where(eq(stripeInvoices.id, invoice.id))
      .limit(1)

    if (existing?.creditsPurchased && existing.creditsPurchased > 0) {
      console.log(`Invoice ${invoice.id} already processed for credits, skipping`)
      return
    }

    const creditsToAdd = dollarsToCredits(invoice.amount_paid / 100)
    if (creditsToAdd <= 0) return

    await db
      .update(userProfiles)
      .set({
        purchasedCredits: sql`coalesce(${userProfiles.purchasedCredits}, 0) + ${creditsToAdd}`,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.id, userId))

    // Mark credits on the invoice record
    await db
      .update(stripeInvoices)
      .set({ creditsPurchased: creditsToAdd, updatedAt: new Date() })
      .where(eq(stripeInvoices.id, invoice.id))

    console.log(`Added ${creditsToAdd} purchased credits for user ${userId} (invoice ${invoice.id})`)
  }
}

async function handleInvoicePaymentFailed(
  stripeClient: Stripe,
  db: ReturnType<typeof getDb>,
  invoice: Stripe.Invoice,
): Promise<void> {
  const userId = await resolveUserIdFromInvoice(stripeClient, db, invoice)

  await db
    .insert(stripeInvoices)
    .values({
      id: invoice.id,
      userId: userId ?? null,
      stripeCustomerId:
        typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null,
      amountDue: invoice.amount_due,
      amountPaid: 0,
      status: 'payment_failed',
    })
    .onConflictDoUpdate({
      target: stripeInvoices.id,
      set: {
        status: 'payment_failed',
        updatedAt: new Date(),
      },
    })

  if (userId) {
    await db
      .update(userProfiles)
      .set({ subscriptionStatus: 'past_due', updatedAt: new Date() })
      .where(eq(userProfiles.id, userId))

    console.warn(`Payment failed for user ${userId}, invoice ${invoice.id}`)
  }
}

export default stripe
