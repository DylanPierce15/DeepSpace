/**
 * Integration billing service — ported from Miyagi3's IntegrationBillingService.
 * Runs on D1 via Drizzle ORM.
 */

import { eq, and, gte, lte, inArray, sql } from 'drizzle-orm'
import { DrizzleD1Database } from 'drizzle-orm/d1'
import { integrationUsage, userProfiles } from '../db/schema'
import { getIntegrationConfig, type IntegrationConfig } from './configs'

export interface BillingCalculation {
  billingUnits: number
  unitCost: number
  totalCost: number
  breakdown: Record<string, unknown>
}

/** 30% markup on API costs */
export const COST_MARKUP_MULTIPLIER = 1.3

/** 100 credits = $1 USD */
const DOLLARS_TO_CREDITS = 100

export function dollarsToCredits(dollarAmount: number): number {
  return dollarAmount * DOLLARS_TO_CREDITS
}

function eurosToDollars(euroAmount: number): number {
  const EUR_USD_EXCH_RATE = 1.17
  return euroAmount * EUR_USD_EXCH_RATE
}

// ============================================================================
// Cost calculation
// ============================================================================

export function calculateCost(
  integrationName: string,
  endpoint: string,
  requestParams: Record<string, unknown>,
  responseData?: Record<string, unknown>,
): BillingCalculation {
  const config = getIntegrationConfig(integrationName, endpoint)
  if (!config || !config.isActive) {
    throw new Error(`No active configuration found for ${integrationName}/${endpoint}`)
  }

  const billingUnits = calculateBillingUnits(config, requestParams, responseData)
  const unitCost = calculateUnitCost(config, requestParams)
  const totalCost = billingUnits * unitCost

  return {
    billingUnits,
    unitCost,
    totalCost,
    breakdown: {
      baseCostPerUnit: config.baseCostPerUnit,
      modifiers: getAppliedModifiers(config, requestParams),
      billingModel: config.billingModel,
      currency: config.currency,
    },
  }
}

function calculateBillingUnits(
  config: IntegrationConfig,
  requestParams: Record<string, unknown>,
  responseData?: Record<string, unknown>,
): number {
  switch (config.billingModel) {
    case 'per_request':
      return 1

    case 'per_token':
      return (responseData?.tokenCount as number) || 1

    case 'per_second': {
      const duration = parseInt(String(requestParams.duration)) || 1
      const minUnits = config.costModifiers?.unitCalculation?.minUnits || 1
      const roundUp = config.costModifiers?.unitCalculation?.roundUp ?? true
      return Math.max(roundUp ? Math.ceil(duration) : duration, minUnits)
    }

    case 'per_pixel': {
      const width = (requestParams.width as number) || 1024
      const height = (requestParams.height as number) || 1024
      return Math.ceil((width * height) / 1_000_000)
    }

    default:
      return 1
  }
}

function calculateUnitCost(
  config: IntegrationConfig,
  requestParams: Record<string, unknown>,
): number {
  const baseCost = config.baseCostPerUnit
  const modifiers = config.costModifiers?.baseMultipliers || {}
  let multiplier = 1

  for (const [paramName, paramModifiers] of Object.entries(modifiers)) {
    const paramValue = String(requestParams[paramName] ?? '')
    if (paramValue && paramModifiers[paramValue]) {
      multiplier *= paramModifiers[paramValue]
    }
  }

  return baseCost * multiplier
}

function getAppliedModifiers(
  config: IntegrationConfig,
  requestParams: Record<string, unknown>,
): Record<string, unknown> {
  const modifiers = config.costModifiers?.baseMultipliers || {}
  const applied: Record<string, unknown> = {}

  for (const [paramName, paramModifiers] of Object.entries(modifiers)) {
    const paramValue = String(requestParams[paramName] ?? '')
    if (paramValue && paramModifiers[paramValue]) {
      applied[paramName] = { value: paramValue, multiplier: paramModifiers[paramValue] }
    }
  }

  return applied
}

// ============================================================================
// Usage recording (D1)
// ============================================================================

export async function recordUsage(
  db: DrizzleD1Database,
  userId: string,
  integrationName: string,
  endpoint: string,
  calculation: BillingCalculation,
  callerUserId?: string,
  markAsComplete = false,
): Promise<string> {
  const currency = String(calculation.breakdown.currency || 'USD').toUpperCase()
  let totalCostInDollars = calculation.totalCost

  if (currency === 'EUR') {
    totalCostInDollars = eurosToDollars(totalCostInDollars)
  }

  const markedUpCost = totalCostInDollars * COST_MARKUP_MULTIPLIER
  const id = crypto.randomUUID()
  const now = new Date()

  await db.insert(integrationUsage).values({
    id,
    userId,
    callerUserId: callerUserId && callerUserId !== userId ? callerUserId : null,
    integrationName,
    endpoint,
    billingUnits: calculation.billingUnits.toString(),
    unitCost: (calculation.unitCost * COST_MARKUP_MULTIPLIER).toString(),
    totalCost: markedUpCost.toString(),
    currency: 'USD',
    status: markAsComplete ? 'completed' : 'pending',
    createdAt: now,
    completedAt: markAsComplete ? now : null,
  })

  return id
}

export async function updateUsageStatus(
  db: DrizzleD1Database,
  usageId: string,
  status: 'completed' | 'failed' | 'refunded',
): Promise<void> {
  await db
    .update(integrationUsage)
    .set({ status, completedAt: new Date() })
    .where(eq(integrationUsage.id, usageId))
}

// ============================================================================
// Credits available
// ============================================================================

export interface UserCreditsAvailable {
  userId: string
  credits: number
  subscriptionCredits: number
  bonusCredits: number
  purchasedCredits: number
}

type SubscriptionTier = 'free' | 'starter' | 'premium' | 'admin' | 'test'

export function subscriptionTierToCredits(tier: SubscriptionTier): number {
  switch (tier) {
    case 'test': return 0
    case 'free': return 500
    case 'starter': return 1600
    case 'premium': return 4250
    case 'admin': return 100000
    default: return 0
  }
}

function getBillingPeriodBounds(profile: {
  subscriptionCurrentPeriodEnd: Date | null
}): { start: Date; end: Date } {
  const periodEnd = profile.subscriptionCurrentPeriodEnd
    ? new Date(profile.subscriptionCurrentPeriodEnd)
    : null

  if (periodEnd) {
    const start = new Date(
      periodEnd.getFullYear(),
      periodEnd.getMonth() - 1,
      periodEnd.getDate(),
    )
    return { start, end: periodEnd }
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start: startOfMonth, end: endOfMonth }
}

async function getTotalCreditsUsedForPeriod(
  db: DrizzleD1Database,
  userId: string,
  start: Date,
  end: Date,
): Promise<number> {
  const rows = await db
    .select({
      totalCostUsd: sql<number>`coalesce(sum(cast(${integrationUsage.totalCost} as real)), 0)`,
    })
    .from(integrationUsage)
    .where(
      and(
        eq(integrationUsage.userId, userId),
        inArray(integrationUsage.status, ['completed', 'failed']),
        gte(integrationUsage.createdAt, start),
        lte(integrationUsage.createdAt, end),
      ),
    )

  return dollarsToCredits(rows[0]?.totalCostUsd ?? 0)
}

export async function creditsAvailableForUser(
  db: DrizzleD1Database,
  userId: string,
): Promise<UserCreditsAvailable> {
  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)

  if (!profile) {
    throw new Error(`No profile found for user ${userId}`)
  }

  const subscriptionAllocation = profile.subscriptionCredits ?? 0
  const purchasedCredits = profile.purchasedCredits ?? 0
  const bonusCreditsStored = profile.bonusCreditsRemaining ?? 0
  const bonusCreditsExpiresAt = profile.bonusCreditsExpiresAt
  const now = new Date()
  const bonusExpired = bonusCreditsExpiresAt ? now > bonusCreditsExpiresAt : false
  const bonusCredits = bonusExpired ? 0 : bonusCreditsStored

  const { start, end } = getBillingPeriodBounds(profile)
  const usedCredits = await getTotalCreditsUsedForPeriod(db, userId, start, end)

  // Burn order: bonus -> subscription -> purchased
  const bonusRemaining = Math.max(bonusCredits - usedCredits, 0)
  const subscriptionPending = Math.max(usedCredits - bonusCredits, 0)
  const subscriptionRemaining = Math.max(subscriptionAllocation - subscriptionPending, 0)
  const purchasedPending = Math.max(usedCredits - bonusCredits - subscriptionAllocation, 0)
  const purchasedRemaining = Math.max(purchasedCredits - purchasedPending, 0)

  return {
    userId,
    credits: bonusRemaining + subscriptionRemaining + purchasedRemaining,
    subscriptionCredits: subscriptionRemaining,
    bonusCredits: bonusRemaining,
    purchasedCredits: purchasedRemaining,
  }
}

/**
 * Check that a user has at least `requiredCredits` available.
 * Throws if insufficient.
 */
export async function checkSufficientCredits(
  db: DrizzleD1Database,
  userId: string,
  requiredCredits: number,
): Promise<void> {
  const { credits } = await creditsAvailableForUser(db, userId)
  if (credits < requiredCredits) {
    throw new Error(
      `Insufficient credits: ${credits.toFixed(1)} available, ${requiredCredits.toFixed(1)} required`,
    )
  }
}
