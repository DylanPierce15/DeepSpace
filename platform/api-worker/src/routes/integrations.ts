/**
 * Integration proxy routes.
 * Validates billing, calls external APIs via handler registry, records usage.
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { safeJson } from 'deepspace/worker'
import type { Env } from '../worker'
import { authMiddleware } from '../middleware/auth'
import { getDb } from '../worker'
import {
  calculateCost,
  recordUsage,
  updateUsageStatus,
  checkSufficientCredits,
  dollarsToCredits,
  COST_MARKUP_MULTIPLIER,
} from '../billing/service'
import { getIntegrationConfig } from '../billing/configs'
import { HANDLER_REGISTRY, BILLING_CONFIGS, SCHEMA_REGISTRY } from '../integrations/_registry'

const integrations = new Hono<Env>()

/**
 * Extract example values from a JSON Schema's property defaults.
 */
function extractExampleFromJsonSchema(jsonSchema: Record<string, unknown>): Record<string, unknown> {
  const properties = jsonSchema.properties as Record<string, Record<string, unknown>> | undefined
  if (!properties) return {}
  const example: Record<string, unknown> = {}
  for (const [key, prop] of Object.entries(properties)) {
    if (prop.default !== undefined) {
      example[key] = prop.default
    }
  }
  return example
}

// GET / — list all available integrations (no auth required)
integrations.get('/', (c) => {
  const catalog: Record<string, Array<{
    endpoint: string
    billing: { model: string; baseCost: number; currency: string }
    inputSchema: Record<string, unknown> | null
    example: Record<string, unknown> | null
  }>> = {}

  for (const [key, config] of Object.entries(BILLING_CONFIGS)) {
    const { integrationName, endpoint, ...billing } = config
    if (!catalog[integrationName]) catalog[integrationName] = []

    const schema = SCHEMA_REGISTRY.get(key)
    const inputSchema = schema ? z.toJSONSchema(schema) as Record<string, unknown> : null
    const example = inputSchema ? extractExampleFromJsonSchema(inputSchema) : null

    catalog[integrationName].push({
      endpoint,
      billing: { model: billing.model, baseCost: billing.baseCost, currency: billing.currency },
      inputSchema,
      example,
    })
  }

  return safeJson(c, { integrations: catalog })
})

// POST /:name/:endpoint — authenticated, billed integration call
integrations.post('/:name/:endpoint', authMiddleware, async (c) => {
  console.log(`[integrations] ${c.req.param('name')}/${c.req.param('endpoint')} userId=${c.get('userId')}`)
  const db = getDb(c.env)
  const userId = c.get('userId')
  const integrationName = c.req.param('name')
  const endpoint = c.req.param('endpoint')

  // Billing: charge X-Billing-User-Id if set (developer-pays), otherwise charge the caller
  const billingUserId = c.req.header('X-Billing-User-Id') ?? userId

  // Look up handler in registry
  const handlerKey = `${integrationName}/${endpoint}`
  const handler = HANDLER_REGISTRY.get(handlerKey)
  if (!handler) {
    return safeJson(c, { error: `Unknown integration: ${handlerKey}` }, 404)
  }

  // Validate billing config exists and is active
  const config = getIntegrationConfig(integrationName, endpoint)
  if (!config || !config.isActive) {
    return safeJson(c, { error: `Integration not active: ${handlerKey}` }, 404)
  }

  const rawBody = await c.req.json()

  // Validate and apply defaults via Zod schema (if one exists for this endpoint)
  let body: Record<string, unknown>
  const schema = SCHEMA_REGISTRY.get(handlerKey)
  if (schema) {
    try {
      body = schema.parse(rawBody) as Record<string, unknown>
    } catch (error) {
      if (error instanceof z.ZodError) {
        return safeJson(c, {
          success: false,
          error: 'Validation failed',
          issues: error.issues,
        }, 400)
      }
      throw error
    }
  } else {
    body = rawBody
  }

  // Pre-flight cost estimate and credit check (against billing user, not caller)
  const calculation = calculateCost(integrationName, endpoint, body)
  const estimatedCredits = dollarsToCredits(calculation.totalCost * COST_MARKUP_MULTIPLIER)
  await checkSufficientCredits(db, billingUserId, estimatedCredits)

  // Record usage — track both caller and billing user
  const usageId = await recordUsage(db, billingUserId, integrationName, endpoint, calculation, userId)

  // Call the handler
  try {
    const result = await handler(c.env, body, { userId, db })

    // Mark completed
    await updateUsageStatus(db, usageId, 'completed')

    return safeJson(c, { success: true, data: result as Record<string, unknown> })
  } catch (error) {
    await updateUsageStatus(db, usageId, 'failed')
    console.error(`Integration ${handlerKey} failed:`, error)
    const message = error instanceof Error ? error.message : 'Integration call failed'
    return safeJson(c, { success: false, error: message }, 502)
  }
})

export default integrations
