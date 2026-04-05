/**
 * Anthropic integration — text generation via Claude API.
 * Ported from Miyagi3 TextGenerationService (Anthropic portion).
 */

import type { IntegrationHandler, EndpointDefinition } from '../_types'

const chatCompletion: IntegrationHandler = async (env, body) => {
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured')

  const model = (body.model as string) || 'claude-sonnet-4-20250514'
  const maxTokens = (body.max_tokens as number) || 4096

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: body.messages,
      ...(body.system ? { system: body.system } : {}),
      ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Anthropic API error ${response.status}: ${errorBody}`)
  }

  return response.json()
}

export const endpoints: Record<string, EndpointDefinition> = {
  'anthropic/chat-completion': {
    handler: chatCompletion,
    billing: {
      model: 'per_token',
      baseCost: 0.000003, // ~$3/M input tokens (Claude Sonnet class)
      currency: 'USD',
      costModifiers: {
        baseMultipliers: {
          model: {
            'claude-sonnet-4-20250514': 1.0,
            'claude-haiku-4-5-20251001': 0.33,
            'claude-opus-4-6-20250626': 5.0,
          },
        },
      },
    },
  },
}
