/**
 * Usage routes — dashboard endpoint for aggregated usage summary.
 *
 * GET /api/usage/summary — credits + per-integration usage for authenticated user
 */

import { Hono } from 'hono'
import { eq, and, gte, desc, sql } from 'drizzle-orm'
import type { Env } from '../worker'
import { authMiddleware } from '../middleware/auth'
import { integrationUsage, userProfiles } from '../db/schema'
import { getDb } from '../worker'
import { creditsAvailableForUser, subscriptionTierToCredits } from '../billing/service'

const usage = new Hono<Env>()

usage.get('/summary', authMiddleware, async (c) => {
  const db = getDb(c.env)
  const userId = c.get('userId')

  // Ensure user profile exists (same pattern as /api/users/me)
  const [existing] = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)
  if (!existing) {
    const now = new Date()
    await db.insert(userProfiles).values({
      id: userId,
      subscriptionTier: 'free',
      subscriptionCredits: subscriptionTierToCredits('free'),
      createdAt: now,
      updatedAt: now,
    })
  }

  // Get current credits
  const credits = await creditsAvailableForUser(db, userId)

  // Usage by integration (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const usageByIntegration = await db
    .select({
      name: integrationUsage.integrationName,
      totalCost: sql<number>`coalesce(sum(cast(${integrationUsage.totalCost} as real)), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(integrationUsage)
    .where(
      and(
        eq(integrationUsage.userId, userId),
        gte(integrationUsage.createdAt, thirtyDaysAgo),
      ),
    )
    .groupBy(integrationUsage.integrationName)
    .orderBy(sql`sum(cast(${integrationUsage.totalCost} as real)) desc`)

  // 50 most recent usage entries
  const recentUsage = await db
    .select({
      id: integrationUsage.id,
      integrationName: integrationUsage.integrationName,
      endpoint: integrationUsage.endpoint,
      totalCost: integrationUsage.totalCost,
      status: integrationUsage.status,
      createdAt: integrationUsage.createdAt,
    })
    .from(integrationUsage)
    .where(eq(integrationUsage.userId, userId))
    .orderBy(desc(integrationUsage.createdAt))
    .limit(50)

  return c.json({ credits, usageByIntegration, recentUsage })
})

export default usage
