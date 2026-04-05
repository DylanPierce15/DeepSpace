/**
 * Integration proxy routes.
 * Validates billing, calls external APIs via handler registry, records usage.
 */

import { Hono } from 'hono'
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
import { HANDLER_REGISTRY } from '../integrations/_registry'

const integrations = new Hono<Env>()

// POST /:name/:endpoint — authenticated, billed integration call
integrations.post('/:name/:endpoint', authMiddleware, async (c) => {
  const db = getDb(c.env)
  const userId = c.get('userId')
  const integrationName = c.req.param('name')
  const endpoint = c.req.param('endpoint')

  // Look up handler in registry
  const handlerKey = `${integrationName}/${endpoint}`
  const handler = HANDLER_REGISTRY.get(handlerKey)
  if (!handler) {
    return c.json({ error: `Unknown integration: ${handlerKey}` }, 404)
  }

  // Validate billing config exists and is active
  const config = getIntegrationConfig(integrationName, endpoint)
  if (!config || !config.isActive) {
    return c.json({ error: `Integration not active: ${handlerKey}` }, 404)
  }

  const body = await c.req.json()

  // Pre-flight cost estimate and credit check
  const calculation = calculateCost(integrationName, endpoint, body)
  const estimatedCredits = dollarsToCredits(calculation.totalCost * COST_MARKUP_MULTIPLIER)
  await checkSufficientCredits(db, userId, estimatedCredits)

  // Record pending usage
  const usageId = await recordUsage(db, userId, integrationName, endpoint, calculation)

  // Call the handler
  try {
    const result = await handler(c.env, body, { userId, db })

    // Mark completed
    await updateUsageStatus(db, usageId, 'completed')

    return c.json({ success: true, data: result })
  } catch (error) {
    await updateUsageStatus(db, usageId, 'failed')
    console.error(`Integration ${handlerKey} failed:`, error)
    const message = error instanceof Error ? error.message : 'Integration call failed'
    return c.json({ success: false, error: message }, 502)
  }
})

export default integrations
