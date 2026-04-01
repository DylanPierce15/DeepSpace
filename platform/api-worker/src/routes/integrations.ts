/**
 * Integration proxy routes.
 * Validates billing, calls external APIs, records usage.
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

const integrations = new Hono<Env>()

// POST /:name/:endpoint — authenticated, billed integration call
integrations.post('/:name/:endpoint', authMiddleware, async (c) => {
  const db = getDb(c.env)
  const userId = c.get('userId')
  const integrationName = c.req.param('name')
  const endpoint = c.req.param('endpoint')

  // Validate integration exists
  const config = getIntegrationConfig(integrationName, endpoint)
  if (!config || !config.isActive) {
    return c.json({ error: `Unknown integration: ${integrationName}/${endpoint}` }, 404)
  }

  const body = await c.req.json()

  // Pre-flight cost estimate and credit check
  const calculation = calculateCost(integrationName, endpoint, body)
  const estimatedCredits = dollarsToCredits(calculation.totalCost * COST_MARKUP_MULTIPLIER)
  await checkSufficientCredits(db, userId, estimatedCredits)

  // Record pending usage
  const usageId = await recordUsage(db, userId, integrationName, endpoint, calculation)

  // Call the external API
  try {
    const result = await callExternalApi(c.env, integrationName, endpoint, body)

    // Mark completed
    await updateUsageStatus(db, usageId, 'completed')

    return c.json({ success: true, data: result })
  } catch (error) {
    await updateUsageStatus(db, usageId, 'failed')
    console.error(`Integration ${integrationName}/${endpoint} failed:`, error)
    const message = error instanceof Error ? error.message : 'Integration call failed'
    return c.json({ success: false, error: message }, 502)
  }
})

// ============================================================================
// External API dispatch
// ============================================================================

async function callExternalApi(
  env: Env['Bindings'],
  integrationName: string,
  endpoint: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  switch (integrationName) {
    case 'openai':
      return callOpenAI(env, endpoint, body)
    case 'freepik':
      return callFreepik(env, endpoint, body)
    case 'serpapi':
      return callSerpApi(env, endpoint, body)
    default:
      throw new Error(`No handler for integration: ${integrationName}`)
  }
}

// ---- OpenAI ----

async function callOpenAI(
  env: Env['Bindings'],
  endpoint: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured')

  if (endpoint === 'chat-completion') {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: body.model || 'gpt-4o',
        messages: body.messages,
        max_tokens: body.max_tokens,
        temperature: body.temperature,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`OpenAI API error ${response.status}: ${errorBody}`)
    }

    return response.json()
  }

  throw new Error(`Unknown OpenAI endpoint: ${endpoint}`)
}

// ---- Freepik ----

async function callFreepik(
  env: Env['Bindings'],
  endpoint: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  if (!env.FREEPIK_API_KEY) throw new Error('FREEPIK_API_KEY not configured')

  const endpointMap: Record<string, string> = {
    'text-to-image-classic': 'https://api.freepik.com/v1/ai/text-to-image',
    'generate-image-mystic': 'https://api.freepik.com/v1/ai/mystic',
    'generate-image-flux-dev': 'https://api.freepik.com/v1/ai/flux-dev',
  }

  const url = endpointMap[endpoint]
  if (!url) throw new Error(`Unknown Freepik endpoint: ${endpoint}`)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-freepik-api-key': env.FREEPIK_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Freepik API error ${response.status}: ${errorBody}`)
  }

  return response.json()
}

// ---- SerpAPI ----

async function callSerpApi(
  env: Env['Bindings'],
  endpoint: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  if (!env.SERPAPI_API_KEY) throw new Error('SERPAPI_API_KEY not configured')

  if (endpoint === 'search') {
    const params = new URLSearchParams({
      api_key: env.SERPAPI_API_KEY,
      engine: (body.engine as string) || 'google',
      q: body.q as string,
      ...(body.num ? { num: String(body.num) } : {}),
      ...(body.location ? { location: body.location as string } : {}),
    })

    const response = await fetch(`https://serpapi.com/search?${params}`)

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`SerpAPI error ${response.status}: ${errorBody}`)
    }

    return response.json()
  }

  throw new Error(`Unknown SerpAPI endpoint: ${endpoint}`)
}

export default integrations
