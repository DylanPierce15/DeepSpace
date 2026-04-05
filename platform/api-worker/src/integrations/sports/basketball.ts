/**
 * Basketball integration — API-Basketball v1.
 * API Base: https://v1.basketball.api-sports.io
 * Ported from Miyagi3 ApiBasketballService.ts.
 */

import type { IntegrationHandler, EndpointDefinition } from '../_types'

const API_BASE = 'https://v1.basketball.api-sports.io'
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

  if (!res.ok) throw new Error(`API-Basketball error: ${res.status} - ${await res.text()}`)

  const data: any = await res.json()
  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API-Basketball error: ${Object.values(data.errors).join(', ')}`)
  }

  return data
}

// ── Factory ────────────────────────────────────────────────────────────────────

function basketballEndpoint(path: string): IntegrationHandler {
  return async (env, body) => {
    if (!env.API_SPORTS_KEY) throw new Error('API_SPORTS_KEY not configured')
    return apiSportsGet(API_BASE, env.API_SPORTS_KEY, path, body)
  }
}

// ── Export ──────────────────────────────────────────────────────────────────────

export const endpoints: Record<string, EndpointDefinition> = {
  'api-basketball/countries':                 { handler: basketballEndpoint('countries'),                billing: BILLING },
  'api-basketball/leagues':                   { handler: basketballEndpoint('leagues'),                  billing: BILLING },
  'api-basketball/teams':                     { handler: basketballEndpoint('teams'),                    billing: BILLING },
  'api-basketball/statistics':                { handler: basketballEndpoint('statistics'),               billing: BILLING },
  'api-basketball/players':                   { handler: basketballEndpoint('players'),                  billing: BILLING },
  'api-basketball/games':                     { handler: basketballEndpoint('games'),                    billing: BILLING },
  'api-basketball/games-statistics-teams':    { handler: basketballEndpoint('games/statistics/teams'),   billing: BILLING },
  'api-basketball/games-statistics-players':  { handler: basketballEndpoint('games/statistics/players'), billing: BILLING },
  'api-basketball/games-h2h':                 { handler: basketballEndpoint('games/h2h'),               billing: BILLING },
  'api-basketball/standings':                 { handler: basketballEndpoint('standings'),                billing: BILLING },
  'api-basketball/standings-stages':          { handler: basketballEndpoint('standings/stages'),         billing: BILLING },
  'api-basketball/standings-groups':          { handler: basketballEndpoint('standings/groups'),         billing: BILLING },
  'api-basketball/odds':                      { handler: basketballEndpoint('odds'),                     billing: BILLING },
  'api-basketball/bookmakers':                { handler: basketballEndpoint('bookmakers'),               billing: BILLING },
}
