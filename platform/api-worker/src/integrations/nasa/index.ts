/**
 * NASA integration — APOD, DONKI (CME/GST/FLR), NeoWs.
 * Ported from Miyagi3 NASAService.ts.
 */

import type { IntegrationHandler, EndpointDefinition } from '../_types'

const HEADERS = { 'User-Agent': 'DeepSpace-NASA/1.0' }
const BILLING = { model: 'per_request' as const, baseCost: 0.01, currency: 'USD' }

// ── APOD ────────────────────────────────────────────────────────────────────

const apod: IntegrationHandler = async (env, body) => {
  if (!env.NASA_API_KEY) throw new Error('NASA_API_KEY not configured')

  const params = new URLSearchParams({ api_key: env.NASA_API_KEY })
  if (body.date) params.append('date', String(body.date))
  else if (body.start_date) {
    params.append('start_date', String(body.start_date))
    if (body.end_date) params.append('end_date', String(body.end_date))
  } else if (body.count) {
    params.append('count', String(body.count))
  }
  if (body.thumbs) params.append('thumbs', 'true')

  const response = await fetch(`https://api.nasa.gov/planetary/apod?${params}`, { headers: HEADERS })

  if (!response.ok) {
    const text = await response.text()
    let msg = `NASA API error: ${response.status}`
    try { const j = JSON.parse(text); if (j.error) msg = `NASA API error: ${j.error.message || j.error}` } catch { if (text) msg += ` - ${text}` }
    throw new Error(msg)
  }

  const data: any = await response.json()
  if (data.error) throw new Error(`NASA API error: ${data.error.message || data.error}`)
  return data
}

// ── DONKI (CME, GST, FLR) ──────────────────────────────────────────────────

function createDONKI(path: string): IntegrationHandler {
  return async (env, body) => {
    if (!env.NASA_API_KEY) throw new Error('NASA_API_KEY not configured')

    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const ago30 = new Date(now); ago30.setUTCDate(ago30.getUTCDate() - 30)

    const params = new URLSearchParams({
      api_key: env.NASA_API_KEY,
      startDate: (body.startDate as string) || ago30.toISOString().split('T')[0],
      endDate: (body.endDate as string) || today,
    })

    const response = await fetch(`https://api.nasa.gov/DONKI/${path}?${params}`, { headers: HEADERS })

    if (!response.ok) {
      const text = await response.text()
      let msg = `NASA DONKI error: ${response.status}`
      try { const j = JSON.parse(text); if (j.error) msg = `NASA DONKI error: ${j.error.message || j.error}` } catch { if (text) msg += ` - ${text}` }
      throw new Error(msg)
    }

    const data = await response.json()
    if (!Array.isArray(data)) throw new Error('NASA DONKI returned unexpected format')
    return data
  }
}

// ── NeoWs ───────────────────────────────────────────────────────────────────

const neoFeed: IntegrationHandler = async (env, body) => {
  if (!env.NASA_API_KEY) throw new Error('NASA_API_KEY not configured')

  const today = new Date().toISOString().split('T')[0]
  const start = (body.startDate as string) || today
  let end = body.endDate as string
  if (!end) { const d = new Date(start); d.setUTCDate(d.getUTCDate() + 7); end = d.toISOString().split('T')[0] }

  const response = await fetch(`https://api.nasa.gov/neo/rest/v1/feed?start_date=${start}&end_date=${end}&api_key=${env.NASA_API_KEY}`, { headers: HEADERS })
  if (!response.ok) throw new Error(`NASA NeoWs error: ${response.status} - ${await response.text()}`)
  return response.json()
}

const neoLookup: IntegrationHandler = async (env, body) => {
  if (!env.NASA_API_KEY) throw new Error('NASA_API_KEY not configured')
  if (!body.asteroidId) throw new Error('asteroidId is required')

  const response = await fetch(`https://api.nasa.gov/neo/rest/v1/neo/${body.asteroidId}?api_key=${env.NASA_API_KEY}`, { headers: HEADERS })
  if (!response.ok) throw new Error(`NASA NeoWs error: ${response.status} - ${await response.text()}`)
  return response.json()
}

const neoBrowse: IntegrationHandler = async (env, body) => {
  if (!env.NASA_API_KEY) throw new Error('NASA_API_KEY not configured')

  const params = new URLSearchParams({ api_key: env.NASA_API_KEY })
  if (body.page) params.append('page', String(body.page))
  if (body.size) params.append('size', String(body.size))

  const response = await fetch(`https://api.nasa.gov/neo/rest/v1/neo/browse?${params}`, { headers: HEADERS })
  if (!response.ok) throw new Error(`NASA NeoWs error: ${response.status} - ${await response.text()}`)
  return response.json()
}

export const endpoints: Record<string, EndpointDefinition> = {
  'nasa/apod': { handler: apod, billing: BILLING },
  'nasa/cme': { handler: createDONKI('CME'), billing: BILLING },
  'nasa/gst': { handler: createDONKI('GST'), billing: BILLING },
  'nasa/flr': { handler: createDONKI('FLR'), billing: BILLING },
  'nasa/neo-feed': { handler: neoFeed, billing: BILLING },
  'nasa/neo-lookup': { handler: neoLookup, billing: BILLING },
  'nasa/neo-browse': { handler: neoBrowse, billing: BILLING },
}
