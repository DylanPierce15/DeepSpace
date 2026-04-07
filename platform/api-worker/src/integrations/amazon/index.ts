/**
 * Amazon integration — product search via SerpAPI Amazon engine.
 * Transforms results into a normalized product format with Associate URLs.
 */

import { z } from 'zod'
import type { IntegrationHandler, EndpointDefinition } from '../_types'

const ASSOCIATE_TAG = 'deepspace02a8-20'

const searchProducts: IntegrationHandler = async (env, body) => {
  if (!env.SERPAPI_API_KEY) throw new Error('SERPAPI_API_KEY not configured')

  const query = body.query as string
  if (!query) throw new Error('query is required')

  const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 20)

  const params = new URLSearchParams({
    api_key: env.SERPAPI_API_KEY,
    engine: 'amazon',
    amazon_domain: 'amazon.com',
    k: query,
  })

  const response = await fetch(`https://serpapi.com/search?${params}`)

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`SerpAPI error ${response.status}: ${errorBody}`)
  }

  const data = (await response.json()) as {
    organic_results?: Array<Record<string, unknown>>
    error?: string
  }

  if (data.error) {
    throw new Error(`SerpAPI error: ${data.error}`)
  }

  const organicResults = data.organic_results || []

  const products = organicResults
    .slice(0, limit)
    .map((item) => {
      const asin = item.asin as string | undefined
      if (!asin) return null

      const canonicalUrl = `https://www.amazon.com/dp/${asin}/ref=nosim?tag=${ASSOCIATE_TAG}`

      return {
        title: (item.title as string) || 'Unknown Product',
        link: canonicalUrl,
        price: item.extracted_price
          ? `$${item.extracted_price}`
          : (item.price as string) || 'Price not available',
        image:
          (item.thumbnail as string) ||
          'https://via.placeholder.com/300x300?text=No+Image',
        rating: item.rating,
        boughtInPastMonth: item.bought_last_month,
        deliveryInfo: Array.isArray(item.delivery) ? item.delivery[0] : undefined,
        snapEligible: (item.snap_ebt_eligible as boolean) || false,
      }
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)

  return { products }
}

const searchProductsSchema = z.object({
  query: z.string(),
  limit: z.number().min(1).max(20).default(10),
})

export const endpoints: Record<string, EndpointDefinition> = {
  'amazon/search-products': {
    handler: searchProducts,
    billing: { model: 'per_request', baseCost: 0.01, currency: 'USD' },
    schema: searchProductsSchema,
  },
}
