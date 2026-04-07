/**
 * Baseball integration — API-Baseball v1.
 * API Base: https://v1.baseball.api-sports.io
 * Ported from Miyagi3 ApiBaseballService.ts.
 */

import { z } from 'zod'
import type { IntegrationHandler, EndpointDefinition } from '../_types'

const API_BASE = 'https://v1.baseball.api-sports.io'
const BILLING = { model: 'per_request' as const, baseCost: 0.001, currency: 'USD' }

// ── Shared helper ──────────────────────────────────────────────────────────────

async function apiSportsGet(
  baseUrl: string,
  apiKey: string,
  path: string,
  params: Record<string, unknown>,
): Promise<any> {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      qs.append(key, String(value))
    }
  }

  const url = `${baseUrl}/${path}${qs.toString() ? `?${qs}` : ''}`
  const res = await fetch(url, {
    headers: {
      'x-apisports-key': apiKey,
      'Accept': 'application/json',
    },
  })

  if (!res.ok) throw new Error(`API-Baseball error: ${res.status} - ${await res.text()}`)

  const data: any = await res.json()
  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API-Baseball error: ${Object.values(data.errors).join(', ')}`)
  }

  return data
}

// ── Factory ────────────────────────────────────────────────────────────────────

function baseballEndpoint(path: string): IntegrationHandler {
  return async (env, body) => {
    if (!env.API_SPORTS_KEY) throw new Error('API_SPORTS_KEY not configured')
    return apiSportsGet(API_BASE, env.API_SPORTS_KEY, path, body)
  }
}

// ── Schema ────────────────────────────────────────────────────────────────────

const apiSportsSchema = z.object({}).passthrough()

// ── Export ──────────────────────────────────────────────────────────────────────

export const endpoints: Record<string, EndpointDefinition> = {
  'api-baseball/countries':          { handler: baseballEndpoint('countries'),          billing: BILLING, schema: apiSportsSchema },
  'api-baseball/leagues':            { handler: baseballEndpoint('leagues'),            billing: BILLING, schema: apiSportsSchema },
  'api-baseball/teams':              { handler: baseballEndpoint('teams'),              billing: BILLING, schema: apiSportsSchema },
  'api-baseball/teams-statistics':   { handler: baseballEndpoint('teams/statistics'),   billing: BILLING, schema: apiSportsSchema },
  'api-baseball/standings':          { handler: baseballEndpoint('standings'),          billing: BILLING, schema: apiSportsSchema },
  'api-baseball/standings-stages':   { handler: baseballEndpoint('standings/stages'),   billing: BILLING, schema: apiSportsSchema },
  'api-baseball/standings-groups':   { handler: baseballEndpoint('standings/groups'),   billing: BILLING, schema: apiSportsSchema },
  'api-baseball/games':              { handler: baseballEndpoint('games'),              billing: BILLING, schema: apiSportsSchema },
  'api-baseball/games-h2h':          { handler: baseballEndpoint('games/h2h'),         billing: BILLING, schema: apiSportsSchema },
  'api-baseball/odds':               { handler: baseballEndpoint('odds'),              billing: BILLING, schema: apiSportsSchema },
  'api-baseball/odds-bookmakers':    { handler: baseballEndpoint('odds/bookmakers'),   billing: BILLING, schema: apiSportsSchema },
}
