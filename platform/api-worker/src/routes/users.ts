/**
 * User profile routes.
 *
 * Identity (name, email, image) comes from JWT claims — the auth-worker is
 * the source of truth. The billing profile in BILLING_DB only stores
 * subscription / credit data and is ensured on first access.
 */

import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import type { Env } from '../worker'
import { authMiddleware } from '../middleware/auth'
import { userProfiles } from '../db/schema'
import { getDb } from '../worker'
import { subscriptionTierToCredits } from '../billing/service'

const users = new Hono<Env>()

// GET /me — returns identity from JWT claims + billing data from D1
users.get('/me', authMiddleware, async (c) => {
  const db = getDb(c.env)
  const userId = c.get('userId')
  const claims = c.get('claims')

  // Ensure billing profile exists (upsert)
  let [billing] = await db
    .select({
      subscriptionStatus: userProfiles.subscriptionStatus,
      subscriptionTier: userProfiles.subscriptionTier,
      createdAt: userProfiles.createdAt,
    })
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)

  if (!billing) {
    const now = new Date()
    await db.insert(userProfiles).values({
      id: userId,
      subscriptionTier: 'free',
      subscriptionCredits: subscriptionTierToCredits('free'),
      createdAt: now,
      updatedAt: now,
    })

    billing = {
      subscriptionStatus: 'free',
      subscriptionTier: 'free',
      createdAt: now,
    }
  }

  return c.json({
    id: userId,
    // Identity from JWT — always fresh
    name: claims.name ?? null,
    email: claims.email ?? null,
    image: claims.image ?? null,
    // Billing from D1
    subscriptionStatus: billing.subscriptionStatus,
    subscriptionTier: billing.subscriptionTier,
    createdAt: billing.createdAt,
  })
})

export default users
