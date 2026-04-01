/**
 * Tests for the credit availability calculation.
 *
 * Validates faithfulness to Miyagi3's creditsAvailableForUser() in stripeService.ts.
 * Key invariant: credit burn order is bonus -> subscription -> purchased.
 *
 * These tests use D1 via @cloudflare/vitest-pool-workers.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'
import { drizzle } from 'drizzle-orm/d1'
import { userProfiles, integrationUsage } from '../db/schema'
import { creditsAvailableForUser } from '../billing/service'
import { migrateTestDb, cleanTables } from './test-helpers'

function getDb() {
  return drizzle(env.BILLING_DB)
}

// Helper: insert a user profile
async function insertProfile(overrides: Partial<typeof userProfiles.$inferInsert> = {}) {
  const db = getDb()
  const now = new Date()
  await db.insert(userProfiles).values({
    id: 'user-test',
    subscriptionTier: 'free',
    subscriptionCredits: 500,
    purchasedCredits: 0,
    bonusCreditsRemaining: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  })
}

// Helper: insert completed usage record
async function insertUsage(totalCostUsd: number) {
  const db = getDb()
  const now = new Date()
  await db.insert(integrationUsage).values({
    id: crypto.randomUUID(),
    userId: 'user-test',
    integrationName: 'test',
    endpoint: 'test',
    billingUnits: '1',
    unitCost: totalCostUsd.toString(),
    totalCost: totalCostUsd.toString(),
    currency: 'USD',
    status: 'completed',
    createdAt: now,
  })
}

describe('creditsAvailableForUser (D1 integration)', () => {
  beforeEach(async () => {
    await migrateTestDb()
    await cleanTables()
  })

  it('throws if user profile does not exist', async () => {
    const db = getDb()
    await expect(creditsAvailableForUser(db, 'nonexistent')).rejects.toThrow(
      /No profile found/,
    )
  })

  it('returns full subscription credits when no usage', async () => {
    await insertProfile({ subscriptionCredits: 500 })
    const db = getDb()
    const result = await creditsAvailableForUser(db, 'user-test')

    expect(result.credits).toBe(500)
    expect(result.subscriptionCredits).toBe(500)
    expect(result.bonusCredits).toBe(0)
    expect(result.purchasedCredits).toBe(0)
  })

  it('reduces subscription credits by usage (100 credits = $1 USD)', async () => {
    await insertProfile({ subscriptionCredits: 500 })
    // $1 = 100 credits used
    await insertUsage(1.0)

    const db = getDb()
    const result = await creditsAvailableForUser(db, 'user-test')

    expect(result.credits).toBe(400)
    expect(result.subscriptionCredits).toBe(400)
  })

  describe('credit burn order: bonus -> subscription -> purchased (Miyagi3 parity)', () => {
    it('burns bonus credits first', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 30)
      await insertProfile({
        subscriptionCredits: 500,
        bonusCreditsRemaining: 200,
        bonusCreditsExpiresAt: futureDate,
        purchasedCredits: 100,
      })
      // $1.50 = 150 credits used -- should come entirely from bonus
      await insertUsage(1.5)

      const db = getDb()
      const result = await creditsAvailableForUser(db, 'user-test')

      expect(result.bonusCredits).toBe(50)        // 200 - 150
      expect(result.subscriptionCredits).toBe(500) // untouched
      expect(result.purchasedCredits).toBe(100)    // untouched
      expect(result.credits).toBe(650)             // 50 + 500 + 100
    })

    it('overflows from bonus into subscription credits', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 30)
      await insertProfile({
        subscriptionCredits: 500,
        bonusCreditsRemaining: 100,
        bonusCreditsExpiresAt: futureDate,
        purchasedCredits: 50,
      })
      // $2.50 = 250 credits: 100 from bonus, 150 from subscription
      await insertUsage(2.5)

      const db = getDb()
      const result = await creditsAvailableForUser(db, 'user-test')

      expect(result.bonusCredits).toBe(0)          // fully consumed
      expect(result.subscriptionCredits).toBe(350) // 500 - 150
      expect(result.purchasedCredits).toBe(50)     // untouched
      expect(result.credits).toBe(400)             // 0 + 350 + 50
    })

    it('overflows from bonus + subscription into purchased credits', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 30)
      await insertProfile({
        subscriptionCredits: 500,
        bonusCreditsRemaining: 100,
        bonusCreditsExpiresAt: futureDate,
        purchasedCredits: 200,
      })
      // $7 = 700 credits: 100 bonus + 500 subscription + 100 purchased
      await insertUsage(7.0)

      const db = getDb()
      const result = await creditsAvailableForUser(db, 'user-test')

      expect(result.bonusCredits).toBe(0)
      expect(result.subscriptionCredits).toBe(0)
      expect(result.purchasedCredits).toBe(100) // 200 - 100
      expect(result.credits).toBe(100)
    })

    it('returns 0 when all credits exhausted', async () => {
      await insertProfile({
        subscriptionCredits: 500,
        purchasedCredits: 0,
        bonusCreditsRemaining: 0,
      })
      // $6 = 600 credits > 500 available
      await insertUsage(6.0)

      const db = getDb()
      const result = await creditsAvailableForUser(db, 'user-test')

      expect(result.credits).toBe(0)
      expect(result.subscriptionCredits).toBe(0)
      expect(result.purchasedCredits).toBe(0)
    })
  })

  describe('bonus credits expiration', () => {
    it('ignores expired bonus credits', async () => {
      const pastDate = new Date(Date.now() - 86400000) // yesterday
      await insertProfile({
        subscriptionCredits: 500,
        bonusCreditsRemaining: 200,
        bonusCreditsExpiresAt: pastDate,
      })
      // No usage -- but bonus is expired
      const db = getDb()
      const result = await creditsAvailableForUser(db, 'user-test')

      expect(result.bonusCredits).toBe(0)          // expired
      expect(result.subscriptionCredits).toBe(500) // full
      expect(result.credits).toBe(500)
    })
  })

  describe('pending/refunded usage is not counted', () => {
    it('only counts completed and failed status', async () => {
      await insertProfile({ subscriptionCredits: 500 })

      const db = getDb()
      const now = new Date()

      // Insert pending usage -- should NOT be counted
      await db.insert(integrationUsage).values({
        id: crypto.randomUUID(),
        userId: 'user-test',
        integrationName: 'test',
        endpoint: 'test',
        billingUnits: '1',
        unitCost: '1.0',
        totalCost: '1.0',
        currency: 'USD',
        status: 'pending',
        createdAt: now,
      })

      // Insert refunded usage -- should NOT be counted
      await db.insert(integrationUsage).values({
        id: crypto.randomUUID(),
        userId: 'user-test',
        integrationName: 'test',
        endpoint: 'test',
        billingUnits: '1',
        unitCost: '2.0',
        totalCost: '2.0',
        currency: 'USD',
        status: 'refunded',
        createdAt: now,
      })

      const result = await creditsAvailableForUser(db, 'user-test')
      expect(result.credits).toBe(500) // no deduction
    })
  })

  describe('starter and premium tiers', () => {
    it('starter tier gets 1600 credits', async () => {
      await insertProfile({
        subscriptionTier: 'starter',
        subscriptionCredits: 1600,
      })

      const db = getDb()
      const result = await creditsAvailableForUser(db, 'user-test')
      expect(result.credits).toBe(1600)
      expect(result.subscriptionCredits).toBe(1600)
    })

    it('premium tier gets 4250 credits', async () => {
      await insertProfile({
        subscriptionTier: 'premium',
        subscriptionCredits: 4250,
      })

      const db = getDb()
      const result = await creditsAvailableForUser(db, 'user-test')
      expect(result.credits).toBe(4250)
      expect(result.subscriptionCredits).toBe(4250)
    })
  })
})
