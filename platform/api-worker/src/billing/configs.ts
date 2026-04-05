/**
 * Billing configs — derived from co-located EndpointDefinitions in each integration.
 * This file re-exports from the registry so billing/service.ts imports stay clean.
 */

import { BILLING_CONFIGS } from '../integrations/_registry'

/** Legacy IntegrationConfig shape used by billing/service.ts */
export interface IntegrationConfig {
  integrationName: string
  endpoint: string
  billingModel: 'per_request' | 'per_second' | 'per_token' | 'per_pixel'
  baseCostPerUnit: number
  currency: string
  costModifiers?: {
    baseMultipliers?: Record<string, Record<string, number>>
    unitCalculation?: {
      formula?: string
      minUnits?: number
      roundUp?: boolean
    }
  }
  isActive: boolean
}

/** Build INTEGRATION_CONFIGS from the registry's billing data. */
export const INTEGRATION_CONFIGS: Record<string, IntegrationConfig> = {}

for (const [key, billing] of Object.entries(BILLING_CONFIGS)) {
  INTEGRATION_CONFIGS[key] = {
    integrationName: billing.integrationName,
    endpoint: billing.endpoint,
    billingModel: billing.model,
    baseCostPerUnit: billing.baseCost,
    currency: billing.currency,
    costModifiers: billing.costModifiers,
    isActive: true,
  }
}

export function getIntegrationConfig(
  integrationName: string,
  endpoint: string,
): IntegrationConfig | undefined {
  return INTEGRATION_CONFIGS[`${integrationName}/${endpoint}`]
}
