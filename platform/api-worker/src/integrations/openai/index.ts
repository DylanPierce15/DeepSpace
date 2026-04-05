/**
 * OpenAI integration.
 */

import type { IntegrationHandler, EndpointDefinition } from '../_types'

const chatCompletion: IntegrationHandler = async (env, body) => {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured')

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

export const endpoints: Record<string, EndpointDefinition> = {
  'openai/chat-completion': {
    handler: chatCompletion,
    billing: {
      model: 'per_token',
      baseCost: 0.00003,
      currency: 'USD',
      costModifiers: {
        baseMultipliers: {
          model: {
            'gpt-4o': 1.0,
            'gpt-4o-mini': 0.1,
            'gpt-4.1': 1.0,
            'gpt-4.1-mini': 0.13,
            'gpt-4.1-nano': 0.033,
          },
        },
      },
    },
  },
}
