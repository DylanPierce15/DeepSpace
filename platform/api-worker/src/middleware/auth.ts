import { createMiddleware } from 'hono/factory'
import { eq } from 'drizzle-orm'
import { verifyJwt } from 'deepspace/worker'
import type { Env } from '../worker'
import { getDb } from '../worker'
import { userProfiles } from '../db/schema'
import { subscriptionTierToCredits } from '../billing/service'

/**
 * Hono middleware that verifies JWT using deepspace/worker's verifyJwt().
 * On success, sets c.set('userId', sub) and ensures a billing profile exists.
 */
export const authMiddleware = createMiddleware<Env>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return c.json({ error: 'Missing authorization token' }, 401)
  }

  const { result, error } = await verifyJwt(
    {
      publicKey: c.env.AUTH_JWT_PUBLIC_KEY,
      issuer: c.env.AUTH_JWT_ISSUER,
    },
    token,
  )

  if (!result) {
    console.error('JWT verification failed:', error)
    return c.json({ error: 'Invalid or expired token' }, 401)
  }

  c.set('userId', result.userId)
  c.set('claims', result.claims)

  // Ensure billing profile exists (idempotent)
  await ensureBillingProfile(c.env, result.userId, result.claims)

  await next()
})

/**
 * Create a billing profile for first-time users.
 * Test accounts get tier 'test' with 0 credits.
 * Regular users get tier 'free' with 500 credits.
 */
async function ensureBillingProfile(
  env: Env['Bindings'],
  userId: string,
  claims: Record<string, unknown>,
) {
  const db = getDb(env)
  const [existing] = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)

  if (existing) return

  const isTest = !!claims.isTestAccount
  const tier = isTest ? 'test' : 'free'
  const now = new Date()

  await db.insert(userProfiles).values({
    id: userId,
    subscriptionTier: tier,
    subscriptionCredits: subscriptionTierToCredits(tier),
    createdAt: now,
    updatedAt: now,
  })
}
