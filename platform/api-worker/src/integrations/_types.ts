/**
 * Integration types.
 * Every integration exports a Record<string, EndpointDefinition>.
 * The registry builds handler + billing maps from these.
 */

import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type { Env } from '../worker'

export interface HandlerContext {
  userId: string
  db: DrizzleD1Database
}

/**
 * Pure function that calls an external API and returns the result.
 * Throws on failure — the route handler catches and records billing status.
 */
export type IntegrationHandler = (
  env: Env['Bindings'],
  body: Record<string, unknown>,
  context: HandlerContext,
) => Promise<unknown>

/**
 * Billing configuration for a single endpoint.
 */
export interface BillingConfig {
  model: 'per_request' | 'per_token' | 'per_second' | 'per_pixel'
  baseCost: number
  currency: string
  costModifiers?: {
    baseMultipliers?: Record<string, Record<string, number>>
    unitCalculation?: {
      formula?: string
      minUnits?: number
      roundUp?: boolean
    }
  }
}

/**
 * Complete definition for one endpoint — handler + billing, co-located.
 * The type enforces you can't add a handler without billing or vice versa.
 */
export interface EndpointDefinition {
  handler: IntegrationHandler
  billing: BillingConfig
}
