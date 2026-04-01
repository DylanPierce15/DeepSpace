/**
 * Stripe routes — ported from Miyagi3's stripe.ts for Hono + D1.
 */

import { Hono } from 'hono'
import Stripe from 'stripe'
import { eq } from 'drizzle-orm'
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

const STRIPE_PRICE_IDS = {
  starter_monthly: 'price_starter_monthly',
  premium_monthly: 'price_premium_monthly',
} as const

const PRICE_TO_TIER_MAP: Record<string, SubscriptionTier> = {
  [STRIPE_PRICE_IDS.starter_monthly]: 'starter',
  [STRIPE_PRICE_IDS.premium_monthly]: 'premium',
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
  return c.json({
    enabled: !!c.env.STRIPE_SECRET_KEY,
    publishableKey: c.env.STRIPE_PUBLISHABLE_KEY ?? '',
    priceIds: STRIPE_PRICE_IDS,
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

  if (!priceId || !Object.values(STRIPE_PRICE_IDS).includes(priceId as any)) {
    return c.json({ error: 'Invalid price ID' }, 400)
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

  return c.json({ sessionId: session.id, url: session.url })
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

  return c.json({ url: session.url })
})

// ============================================================================
// GET /credits-available — JWT auth
// ============================================================================

stripe.get('/credits-available', authMiddleware, async (c) => {
  const db = getDb(c.env)
  const userId = c.get('userId')

  try {
    const result = await creditsAvailableForUser(db, userId)
    return c.json({ success: true, credits: result.credits })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get credits'
    return c.json({ success: false, credits: null, error: message })
  }
})

// ============================================================================
// POST /webhook — raw body, no auth
// ============================================================================

stripe.post('/webhook', async (c) => {
  if (!c.env.STRIPE_SECRET_KEY || !c.env.STRIPE_WEBHOOK_SECRET) {
    return c.json({ error: 'Stripe is not configured' }, 503)
  }

  const stripeClient = getStripe(c.env)
  const db = getDb(c.env)
  const sig = c.req.header('stripe-signature')
  const rawBody = await c.req.text()

  let event: Stripe.Event
  try {
    event = stripeClient.webhooks.constructEvent(rawBody, sig!, c.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return c.text(`Webhook Error: ${err}`, 400)
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdate(stripeClient, db, subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(db, subscription)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaid(db, invoice)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return c.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return c.json({ error: 'Webhook processing failed' }, 500)
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

async function handleSubscriptionUpdate(
  stripeClient: Stripe,
  db: ReturnType<typeof getDb>,
  subscription: Stripe.Subscription,
): Promise<void> {
  const userId = (subscription.metadata as any)?.userId as string | undefined
  if (!userId) {
    console.warn(`No userId in subscription ${subscription.id} metadata`)
    return
  }

  const priceId = subscription.items.data[0]?.price?.id
  const tier = priceId ? PRICE_TO_TIER_MAP[priceId] || 'free' : 'free'
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
  db: ReturnType<typeof getDb>,
  invoice: Stripe.Invoice,
): Promise<void> {
  const userId = (invoice.metadata as any)?.userId as string | undefined

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
      creditsPurchased: invoice.metadata?.credits
        ? parseFloat(invoice.metadata.credits)
        : null,
    })
    .onConflictDoUpdate({
      target: stripeInvoices.id,
      set: {
        amountPaid: invoice.amount_paid,
        status: 'paid',
        creditsPurchased: invoice.metadata?.credits
          ? parseFloat(invoice.metadata.credits)
          : undefined,
        updatedAt: new Date(),
      },
    })
}

export default stripe
