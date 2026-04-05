/**
 * SerpAPI integration — Google Search, Flights, Hotels, Places, Events, and Scholar endpoints.
 */

import type { IntegrationHandler, EndpointDefinition } from '../_types'

// =============================================================================
// Shared helper
// =============================================================================

/**
 * Build a SerpAPI handler for a given engine.
 * Every SerpAPI endpoint follows the same pattern: build query params, GET /search.
 */
function createSerpApiHandler(
  engine: string,
  buildParams?: (body: Record<string, unknown>) => Record<string, string>,
): IntegrationHandler {
  return async (env, body) => {
    if (!env.SERPAPI_API_KEY) throw new Error('SERPAPI_API_KEY not configured')

    const extra = buildParams ? buildParams(body) : {}

    const params = new URLSearchParams({
      api_key: env.SERPAPI_API_KEY,
      engine,
      ...extra,
    })

    // Merge any remaining body keys as params (unless already handled by buildParams)
    const handledKeys = new Set(Object.keys(extra))
    for (const [k, v] of Object.entries(body)) {
      if (!handledKeys.has(k) && v !== undefined && v !== null) {
        params.set(k, String(v))
      }
    }

    const response = await fetch(`https://serpapi.com/search?${params}`)

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`SerpAPI error ${response.status}: ${errorBody}`)
    }

    return response.json()
  }
}

// =============================================================================
// Existing: generic search
// =============================================================================

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

// =============================================================================
// Google Flights
// =============================================================================

const flights = createSerpApiHandler('google_flights', (body) => {
  const params: Record<string, string> = {}
  if (body.departure_id) params.departure_id = String(body.departure_id)
  if (body.arrival_id) params.arrival_id = String(body.arrival_id)
  if (body.outbound_date) params.outbound_date = String(body.outbound_date)
  if (body.return_date) params.return_date = String(body.return_date)
  if (body.type) params.type = String(body.type)
  if (body.adults) params.adults = String(body.adults)
  if (body.currency) params.currency = String(body.currency)
  if (body.hl) params.hl = String(body.hl)
  return params
})

// =============================================================================
// Google Maps — Places Search
// =============================================================================

const placesSearch = createSerpApiHandler('google_maps', (body) => {
  const params: Record<string, string> = {}
  if (body.q) params.q = String(body.q)
  if (body.type) params.type = String(body.type)
  if (body.ll) params.ll = String(body.ll)
  if (body.hl) params.hl = String(body.hl)
  return params
})

// =============================================================================
// Google Maps — Place Reviews
// =============================================================================

const placesReviews = createSerpApiHandler('google_maps_reviews', (body) => {
  const params: Record<string, string> = {}
  if (body.data_id) params.data_id = String(body.data_id)
  if (body.place_id) params.place_id = String(body.place_id)
  if (body.hl) params.hl = String(body.hl)
  return params
})

// =============================================================================
// Google Hotels
// =============================================================================

const hotels = createSerpApiHandler('google_hotels', (body) => {
  const params: Record<string, string> = {}
  if (body.q) params.q = String(body.q)
  if (body.check_in_date) params.check_in_date = String(body.check_in_date)
  if (body.check_out_date) params.check_out_date = String(body.check_out_date)
  if (body.adults) params.adults = String(body.adults)
  if (body.location) params.location = String(body.location)
  if (body.gl) params.gl = String(body.gl)
  if (body.hl) params.hl = String(body.hl)
  return params
})

// =============================================================================
// Google Events
// =============================================================================

const events = createSerpApiHandler('google_events', (body) => {
  const params: Record<string, string> = {}
  if (body.q) params.q = String(body.q)
  if (body.location) params.location = String(body.location)
  if (body.hl) params.hl = String(body.hl)
  return params
})

// =============================================================================
// Google Web Search
// =============================================================================

const webSearch = createSerpApiHandler('google', (body) => {
  const params: Record<string, string> = {}
  if (body.q) params.q = String(body.q)
  if (body.num) params.num = String(body.num)
  if (body.start) params.start = String(body.start)
  if (body.location) params.location = String(body.location)
  if (body.gl) params.gl = String(body.gl)
  if (body.hl) params.hl = String(body.hl)
  return params
})

// =============================================================================
// Google Scholar — Author Profiles Search
// =============================================================================

const scholarSearchAuthors = createSerpApiHandler('google_scholar_profiles', (body) => {
  const params: Record<string, string> = {}
  if (body.mauthors) params.mauthors = String(body.mauthors)
  if (body.hl) params.hl = String(body.hl)
  if (body.after_author) params.after_author = String(body.after_author)
  return params
})

// =============================================================================
// Google Scholar — Paper Search
// =============================================================================

const scholarSearchPapers = createSerpApiHandler('google_scholar', (body) => {
  const params: Record<string, string> = {}
  if (body.q) params.q = String(body.q)
  if (body.num) params.num = String(body.num)
  if (body.start) params.start = String(body.start)
  if (body.hl) params.hl = String(body.hl)
  if (body.as_ylo) params.as_ylo = String(body.as_ylo)
  if (body.as_yhi) params.as_yhi = String(body.as_yhi)
  return params
})

// =============================================================================
// Google Scholar — Author Papers
// =============================================================================

const scholarGetAuthorPapers = createSerpApiHandler('google_scholar_author', (body) => {
  const params: Record<string, string> = {}
  if (body.author_id) params.author_id = String(body.author_id)
  if (body.num) params.num = String(body.num)
  if (body.start) params.start = String(body.start)
  if (body.sort) params.sort = String(body.sort)
  if (body.hl) params.hl = String(body.hl)
  return params
})

// =============================================================================
// Google Scholar — Citation Details
// =============================================================================

const scholarGetCitationDetails = createSerpApiHandler('google_scholar_cite', (body) => {
  const params: Record<string, string> = {}
  if (body.q) params.q = String(body.q)
  if (body.hl) params.hl = String(body.hl)
  return params
})

// =============================================================================
// Google Scholar — Author Details (profile)
// =============================================================================

const scholarGetAuthorDetails = createSerpApiHandler('google_scholar_author', (body) => {
  const params: Record<string, string> = {}
  if (body.author_id) params.author_id = String(body.author_id)
  if (body.hl) params.hl = String(body.hl)
  return params
})

// =============================================================================
// Endpoint registry
// =============================================================================

export const endpoints: Record<string, EndpointDefinition> = {
  // Existing
  'serpapi/search': {
    handler: search,
    billing: { model: 'per_request', baseCost: 0.01, currency: 'USD' },
  },

  // Google Flights
  'serpapi/flights': {
    handler: flights,
    billing: { model: 'per_request', baseCost: 0.01, currency: 'USD' },
  },

  // Google Maps — Places
  'serpapi/places-search': {
    handler: placesSearch,
    billing: { model: 'per_request', baseCost: 0.01, currency: 'USD' },
  },
  'serpapi/places-reviews': {
    handler: placesReviews,
    billing: { model: 'per_request', baseCost: 0.01, currency: 'USD' },
  },

  // Google Hotels
  'serpapi/hotels': {
    handler: hotels,
    billing: { model: 'per_request', baseCost: 0.01, currency: 'USD' },
  },

  // Google Events
  'serpapi/events': {
    handler: events,
    billing: { model: 'per_request', baseCost: 0.01, currency: 'USD' },
  },

  // Google Web Search
  'serpapi/web-search': {
    handler: webSearch,
    billing: { model: 'per_request', baseCost: 0.01, currency: 'USD' },
  },

  // Google Scholar
  'scholar/search-authors': {
    handler: scholarSearchAuthors,
    billing: { model: 'per_request', baseCost: 0.01, currency: 'USD' },
  },
  'scholar/search-papers': {
    handler: scholarSearchPapers,
    billing: { model: 'per_request', baseCost: 0.01, currency: 'USD' },
  },
  'scholar/get-author-papers': {
    handler: scholarGetAuthorPapers,
    billing: { model: 'per_request', baseCost: 0.01, currency: 'USD' },
  },
  'scholar/get-citation-details': {
    handler: scholarGetCitationDetails,
    billing: { model: 'per_request', baseCost: 0.01, currency: 'USD' },
  },
  'scholar/get-author-details': {
    handler: scholarGetAuthorDetails,
    billing: { model: 'per_request', baseCost: 0.01, currency: 'USD' },
  },
}
