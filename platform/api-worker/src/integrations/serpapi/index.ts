/**
 * SerpAPI integration — Google Search, Flights, Hotels, Places, Events, and Scholar endpoints.
 */

import { z } from 'zod'
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
// Schemas
// =============================================================================

const searchSerpSchema = z.object({
  engine: z.string().default('google'),
  q: z.string(),
  num: z.number().optional(),
  location: z.string().optional(),
})

const flightsSchema = z.object({
  departure_id: z.string().optional(),
  arrival_id: z.string().optional(),
  outbound_date: z.string().optional(),
  return_date: z.string().optional(),
  type: z.string().optional(),
  adults: z.number().optional(),
  currency: z.string().optional(),
  hl: z.string().optional(),
})

const placesSearchSchema = z.object({
  q: z.string().optional(),
  type: z.string().optional(),
  ll: z.string().optional(),
  hl: z.string().optional(),
})

const placesReviewsSchema = z.object({
  data_id: z.string().optional(),
  place_id: z.string().optional(),
  hl: z.string().optional(),
})

const hotelsSchema = z.object({
  q: z.string().optional(),
  check_in_date: z.string().optional(),
  check_out_date: z.string().optional(),
  adults: z.number().optional(),
  location: z.string().optional(),
  gl: z.string().optional(),
  hl: z.string().optional(),
})

const eventsSchema = z.object({
  q: z.string().optional(),
  location: z.string().optional(),
  hl: z.string().optional(),
})

const webSearchSchema = z.object({
  q: z.string().optional(),
  num: z.number().optional(),
  start: z.number().optional(),
  location: z.string().optional(),
  gl: z.string().optional(),
  hl: z.string().optional(),
})

const scholarSearchAuthorsSchema = z.object({
  mauthors: z.string().optional(),
  hl: z.string().optional(),
  after_author: z.string().optional(),
})

const scholarSearchPapersSchema = z.object({
  q: z.string().optional(),
  num: z.number().optional(),
  start: z.number().optional(),
  hl: z.string().optional(),
  as_ylo: z.number().optional(),
  as_yhi: z.number().optional(),
})

const scholarGetAuthorPapersSchema = z.object({
  author_id: z.string().optional(),
  num: z.number().optional(),
  start: z.number().optional(),
  sort: z.string().optional(),
  hl: z.string().optional(),
})

const scholarGetCitationDetailsSchema = z.object({
  q: z.string().optional(),
  hl: z.string().optional(),
})

const scholarGetAuthorDetailsSchema = z.object({
  author_id: z.string().optional(),
  hl: z.string().optional(),
})

const SERP_BILLING = { model: 'per_request' as const, baseCost: 0.01, currency: 'USD' }

// =============================================================================
// Endpoint registry
// =============================================================================

export const endpoints: Record<string, EndpointDefinition> = {
  // Existing
  'serpapi/search': {
    handler: search,
    billing: SERP_BILLING,
    schema: searchSerpSchema,
  },

  // Google Flights
  'serpapi/flights': {
    handler: flights,
    billing: SERP_BILLING,
    schema: flightsSchema,
  },

  // Google Maps — Places
  'serpapi/places-search': {
    handler: placesSearch,
    billing: SERP_BILLING,
    schema: placesSearchSchema,
  },
  'serpapi/places-reviews': {
    handler: placesReviews,
    billing: SERP_BILLING,
    schema: placesReviewsSchema,
  },

  // Google Hotels
  'serpapi/hotels': {
    handler: hotels,
    billing: SERP_BILLING,
    schema: hotelsSchema,
  },

  // Google Events
  'serpapi/events': {
    handler: events,
    billing: SERP_BILLING,
    schema: eventsSchema,
  },

  // Google Web Search
  'serpapi/web-search': {
    handler: webSearch,
    billing: SERP_BILLING,
    schema: webSearchSchema,
  },

  // Google Scholar
  'scholar/search-authors': {
    handler: scholarSearchAuthors,
    billing: SERP_BILLING,
    schema: scholarSearchAuthorsSchema,
  },
  'scholar/search-papers': {
    handler: scholarSearchPapers,
    billing: SERP_BILLING,
    schema: scholarSearchPapersSchema,
  },
  'scholar/get-author-papers': {
    handler: scholarGetAuthorPapers,
    billing: SERP_BILLING,
    schema: scholarGetAuthorPapersSchema,
  },
  'scholar/get-citation-details': {
    handler: scholarGetCitationDetails,
    billing: SERP_BILLING,
    schema: scholarGetCitationDetailsSchema,
  },
  'scholar/get-author-details': {
    handler: scholarGetAuthorDetails,
    billing: SERP_BILLING,
    schema: scholarGetAuthorDetailsSchema,
  },
}
