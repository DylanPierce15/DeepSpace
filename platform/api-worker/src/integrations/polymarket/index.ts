/**
 * Polymarket integration — prediction market data.
 * Ported from Miyagi3 PolymarketService.ts.
 * Uses Polymarket's public APIs (Gamma for events/markets, CLOB for trading data).
 */

import { z } from 'zod'
import type { IntegrationHandler, EndpointDefinition } from '../_types'

const GAMMA_API = 'https://gamma-api.polymarket.com'
const CLOB_API = 'https://clob.polymarket.com'

const B = { model: 'per_request' as const, baseCost: 0.001, currency: 'USD' }

async function gammaGet(path: string, params?: URLSearchParams): Promise<any> {
  const url = params ? `${GAMMA_API}${path}?${params}` : `${GAMMA_API}${path}`
  const response = await fetch(url, { headers: { 'User-Agent': 'DeepSpace-Polymarket/1.0' } })
  if (!response.ok) throw new Error(`Polymarket API error ${response.status}: ${await response.text()}`)
  return response.json()
}

async function clobGet(path: string, params?: URLSearchParams): Promise<any> {
  const url = params ? `${CLOB_API}${path}?${params}` : `${CLOB_API}${path}`
  const response = await fetch(url, { headers: { 'User-Agent': 'DeepSpace-Polymarket/1.0' } })
  if (!response.ok) throw new Error(`Polymarket CLOB API error ${response.status}: ${await response.text()}`)
  return response.json()
}

// ── Gamma API endpoints ─────────────────────────────────────────────────────

const events: IntegrationHandler = async (_env, body) => {
  const params = new URLSearchParams()
  if (body.limit) params.append('limit', String(body.limit))
  if (body.offset) params.append('offset', String(body.offset))
  if (body.order) params.append('order', String(body.order))
  if (body.ascending !== undefined) params.append('ascending', String(body.ascending))
  if (body.closed !== undefined) params.append('closed', String(body.closed))
  if (body.tag) params.append('tag', String(body.tag))
  return gammaGet('/events', params)
}

const eventDetail: IntegrationHandler = async (_env, body) => {
  if (!body.id) throw new Error('Event ID is required')
  return gammaGet(`/events/${body.id}`)
}

const markets: IntegrationHandler = async (_env, body) => {
  const params = new URLSearchParams()
  if (body.limit) params.append('limit', String(body.limit))
  if (body.offset) params.append('offset', String(body.offset))
  if (body.order) params.append('order', String(body.order))
  if (body.ascending !== undefined) params.append('ascending', String(body.ascending))
  if (body.closed !== undefined) params.append('closed', String(body.closed))
  if (body.tag) params.append('tag', String(body.tag))
  if (body.event_slug) params.append('event_slug', String(body.event_slug))
  return gammaGet('/markets', params)
}

const marketDetail: IntegrationHandler = async (_env, body) => {
  if (!body.id) throw new Error('Market ID (condition_id) is required')
  return gammaGet(`/markets/${body.id}`)
}

const tags: IntegrationHandler = async () => gammaGet('/tags')

const search: IntegrationHandler = async (_env, body) => {
  if (!body.q) throw new Error('Search query (q) is required')
  const params = new URLSearchParams({ q: String(body.q) })
  if (body.limit) params.append('limit', String(body.limit))
  return gammaGet('/events', params)
}

const comments: IntegrationHandler = async (_env, body) => {
  if (!body.market_id) throw new Error('market_id is required')
  const params = new URLSearchParams({ market: String(body.market_id) })
  if (body.limit) params.append('limit', String(body.limit))
  if (body.offset) params.append('offset', String(body.offset))
  return gammaGet('/comments', params)
}

// ── CLOB API endpoints ──────────────────────────────────────────────────────

const price: IntegrationHandler = async (_env, body) => {
  if (!body.token_id) throw new Error('token_id is required')
  const params = new URLSearchParams({ token_id: String(body.token_id) })
  if (body.side) params.append('side', String(body.side))
  return clobGet('/price', params)
}

const prices: IntegrationHandler = async (_env, body) => {
  if (!body.token_ids) throw new Error('token_ids array is required')
  const tokenIds = Array.isArray(body.token_ids) ? body.token_ids : [body.token_ids]
  // CLOB prices endpoint expects comma-separated token IDs
  const params = new URLSearchParams()
  tokenIds.forEach((id: any) => params.append('token_ids', String(id)))
  return clobGet('/prices', params)
}

const orderbook: IntegrationHandler = async (_env, body) => {
  if (!body.token_id) throw new Error('token_id is required')
  const params = new URLSearchParams({ token_id: String(body.token_id) })
  return clobGet('/book', params)
}

const priceHistory: IntegrationHandler = async (_env, body) => {
  if (!body.token_id) throw new Error('token_id is required')
  const params = new URLSearchParams({ market: String(body.token_id) })
  if (body.interval) params.append('interval', String(body.interval))
  if (body.fidelity) params.append('fidelity', String(body.fidelity))
  if (body.startTs) params.append('startTs', String(body.startTs))
  if (body.endTs) params.append('endTs', String(body.endTs))
  return clobGet('/prices-history', params)
}

const trades: IntegrationHandler = async (_env, body) => {
  if (!body.token_id) throw new Error('token_id is required')
  const params = new URLSearchParams()
  params.append('market', String(body.token_id))
  if (body.limit) params.append('limit', String(body.limit))
  if (body.before) params.append('before', String(body.before))
  if (body.after) params.append('after', String(body.after))
  return clobGet('/trades', params)
}

const eventsSchema = z.object({
  limit: z.number().optional(),
  offset: z.number().optional(),
  order: z.string().optional(),
  ascending: z.boolean().optional(),
  closed: z.boolean().optional(),
  tag: z.string().optional(),
})

const eventDetailSchema = z.object({
  id: z.string(),
})

const marketsSchema = z.object({
  limit: z.number().optional(),
  offset: z.number().optional(),
  order: z.string().optional(),
  ascending: z.boolean().optional(),
  closed: z.boolean().optional(),
  tag: z.string().optional(),
  event_slug: z.string().optional(),
})

const marketDetailSchema = z.object({
  id: z.string(),
})

const tagsSchema = z.object({})

const searchSchema = z.object({
  q: z.string(),
  limit: z.number().optional(),
})

const commentsSchema = z.object({
  market_id: z.string(),
  limit: z.number().optional(),
  offset: z.number().optional(),
})

const priceSchema = z.object({
  token_id: z.string(),
  side: z.string().optional(),
})

const pricesSchema = z.object({
  token_ids: z.union([z.array(z.string()), z.string()]),
})

const orderbookSchema = z.object({
  token_id: z.string(),
})

const priceHistorySchema = z.object({
  token_id: z.string(),
  interval: z.string().optional(),
  fidelity: z.number().optional(),
  startTs: z.number().optional(),
  endTs: z.number().optional(),
})

const tradesSchema = z.object({
  token_id: z.string(),
  limit: z.number().optional(),
  before: z.string().optional(),
  after: z.string().optional(),
})

export const endpoints: Record<string, EndpointDefinition> = {
  'polymarket/events':        { handler: events,        billing: B, schema: eventsSchema },
  'polymarket/event-detail':  { handler: eventDetail,   billing: B, schema: eventDetailSchema },
  'polymarket/markets':       { handler: markets,       billing: B, schema: marketsSchema },
  'polymarket/market-detail': { handler: marketDetail,   billing: B, schema: marketDetailSchema },
  'polymarket/tags':          { handler: tags,           billing: B, schema: tagsSchema },
  'polymarket/search':        { handler: search,         billing: B, schema: searchSchema },
  'polymarket/comments':      { handler: comments,       billing: B, schema: commentsSchema },
  'polymarket/price':         { handler: price,          billing: B, schema: priceSchema },
  'polymarket/prices':        { handler: prices,         billing: B, schema: pricesSchema },
  'polymarket/orderbook':     { handler: orderbook,      billing: B, schema: orderbookSchema },
  'polymarket/price-history': { handler: priceHistory,   billing: B, schema: priceHistorySchema },
  'polymarket/trades':        { handler: trades,         billing: B, schema: tradesSchema },
}
