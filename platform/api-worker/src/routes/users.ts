/**
 * User profile routes.
 *
 * Identity (name, email, image) comes from JWT claims — the auth-worker is
 * the source of truth. The billing profile in BILLING_DB is ensured by
 * the auth middleware on first access.
 */

import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { safeJson } from 'deepspace/worker'
import type { Env } from '../worker'
import { authMiddleware } from '../middleware/auth'
import { userProfiles } from '../db/schema'
import { getDb } from '../worker'

const users = new Hono<Env>()

// GET /me — returns identity from JWT claims + billing data from D1
users.get('/me', authMiddleware, async (c) => {
  const db = getDb(c.env)
  const userId = c.get('userId')
  const claims = c.get('claims')

  // Profile is guaranteed to exist — auth middleware ensures it
  const [billing] = await db
    .select({
      subscriptionStatus: userProfiles.subscriptionStatus,
      subscriptionTier: userProfiles.subscriptionTier,
      createdAt: userProfiles.createdAt,
    })
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)

  return safeJson(c, {
    id: userId,
    name: claims.name ?? null,
    email: claims.email ?? null,
    image: claims.image ?? null,
    subscriptionStatus: billing?.subscriptionStatus ?? 'free',
    subscriptionTier: billing?.subscriptionTier ?? 'free',
    createdAt: billing?.createdAt ?? null,
  })
})

export default users
