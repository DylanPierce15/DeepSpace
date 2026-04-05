/**
 * American Football integration — API-American-Football v1.
 * API Base: https://v1.american-football.api-sports.io
 * Ported from Miyagi3 ApiAmericanFootballService.ts.
 */

import type { IntegrationHandler, EndpointDefinition } from '../_types'

const API_BASE = 'https://v1.american-football.api-sports.io'
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

  if (!res.ok) throw new Error(`API-American-Football error: ${res.status} - ${await res.text()}`)

  const data: any = await res.json()
  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API-American-Football error: ${Object.values(data.errors).join(', ')}`)
  }

  return data
}

// ── Factory ────────────────────────────────────────────────────────────────────

function nflEndpoint(path: string): IntegrationHandler {
  return async (env, body) => {
    if (!env.API_SPORTS_KEY) throw new Error('API_SPORTS_KEY not configured')
    return apiSportsGet(API_BASE, env.API_SPORTS_KEY, path, body)
  }
}

// ── Export ──────────────────────────────────────────────────────────────────────

export const endpoints: Record<string, EndpointDefinition> = {
  'api-american-football/leagues':                   { handler: nflEndpoint('leagues'),                   billing: BILLING },
  'api-american-football/teams':                     { handler: nflEndpoint('teams'),                     billing: BILLING },
  'api-american-football/players':                   { handler: nflEndpoint('players'),                   billing: BILLING },
  'api-american-football/players-statistics':         { handler: nflEndpoint('players/statistics'),        billing: BILLING },
  'api-american-football/injuries':                  { handler: nflEndpoint('injuries'),                  billing: BILLING },
  'api-american-football/games':                     { handler: nflEndpoint('games'),                     billing: BILLING },
  'api-american-football/games-events':              { handler: nflEndpoint('games/events'),              billing: BILLING },
  'api-american-football/games-statistics-teams':    { handler: nflEndpoint('games/statistics/teams'),    billing: BILLING },
  'api-american-football/games-statistics-players':  { handler: nflEndpoint('games/statistics/players'),  billing: BILLING },
  'api-american-football/standings':                 { handler: nflEndpoint('standings'),                 billing: BILLING },
  'api-american-football/standings-conferences':     { handler: nflEndpoint('standings/conferences'),     billing: BILLING },
  'api-american-football/standings-divisions':       { handler: nflEndpoint('standings/divisions'),       billing: BILLING },
  'api-american-football/odds':                      { handler: nflEndpoint('odds'),                      billing: BILLING },
  'api-american-football/odds-bookmakers':           { handler: nflEndpoint('odds/bookmakers'),           billing: BILLING },
}
