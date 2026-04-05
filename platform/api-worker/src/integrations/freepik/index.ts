/**
 * Freepik integration — text-to-image endpoints.
 */

import type { IntegrationHandler, EndpointDefinition } from '../_types'

function createFreepikHandler(apiUrl: string): IntegrationHandler {
  return async (env, body) => {
    if (!env.FREEPIK_API_KEY) throw new Error('FREEPIK_API_KEY not configured')

    const response = await fetch(apiUrl, {
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
}

export const endpoints: Record<string, EndpointDefinition> = {
  'freepik/text-to-image-classic': {
    handler: createFreepikHandler('https://api.freepik.com/v1/ai/text-to-image'),
    billing: {
      model: 'per_request',
      baseCost: 0.005,
      currency: 'USD',
      costModifiers: { unitCalculation: { formula: 'num_images', minUnits: 1, roundUp: false } },
    },
  },
  'freepik/generate-image-mystic': {
    handler: createFreepikHandler('https://api.freepik.com/v1/ai/mystic'),
    billing: {
      model: 'per_request',
      baseCost: 0.069,
      currency: 'USD',
      costModifiers: {
        baseMultipliers: { resolution: { '1k': 1.0, '2k': 1.72464, '4k': 5.50725 } },
      },
    },
  },
  'freepik/generate-image-flux-dev': {
    handler: createFreepikHandler('https://api.freepik.com/v1/ai/flux-dev'),
    billing: { model: 'per_request', baseCost: 0.012, currency: 'USD' },
  },
}
