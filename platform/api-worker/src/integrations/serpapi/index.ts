/**
 * SerpAPI integration.
 */

import type { IntegrationHandler, EndpointDefinition } from '../_types'

const search: IntegrationHandler = async (env, body) => {
  if (!env.SERPAPI_API_KEY) throw new Error('SERPAPI_API_KEY not configured')

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

export const endpoints: Record<string, EndpointDefinition> = {
  'serpapi/search': {
    handler: search,
    billing: { model: 'per_request', baseCost: 0.01, currency: 'USD' },
  },
}
