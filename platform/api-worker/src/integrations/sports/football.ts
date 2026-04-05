/**
 * Football (soccer) integration — API-Football v3.
 * API Base: https://v3.football.api-sports.io
 * Ported from Miyagi3 ApiFootballService.ts.
 */

import type { IntegrationHandler, EndpointDefinition } from '../_types'

const API_BASE = 'https://v3.football.api-sports.io'
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

  if (!res.ok) throw new Error(`API-Football error: ${res.status} - ${await res.text()}`)

  const data: any = await res.json()
  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API-Football error: ${Object.values(data.errors).join(', ')}`)
  }

  return data
}

// ── Factory ────────────────────────────────────────────────────────────────────

function footballEndpoint(path: string): IntegrationHandler {
  return async (env, body) => {
    if (!env.API_SPORTS_KEY) throw new Error('API_SPORTS_KEY not configured')
    return apiSportsGet(API_BASE, env.API_SPORTS_KEY, path, body)
  }
}

// ── Export ──────────────────────────────────────────────────────────────────────

export const endpoints: Record<string, EndpointDefinition> = {
  'api-football/countries':            { handler: footballEndpoint('countries'),            billing: BILLING },
  'api-football/leagues':              { handler: footballEndpoint('leagues'),              billing: BILLING },
  'api-football/teams':                { handler: footballEndpoint('teams'),                billing: BILLING },
  'api-football/teams-statistics':     { handler: footballEndpoint('teams/statistics'),     billing: BILLING },
  'api-football/fixtures':             { handler: footballEndpoint('fixtures'),             billing: BILLING },
  'api-football/fixtures-headtohead':  { handler: footballEndpoint('fixtures/headtohead'),  billing: BILLING },
  'api-football/fixtures-statistics':  { handler: footballEndpoint('fixtures/statistics'),  billing: BILLING },
  'api-football/fixtures-events':      { handler: footballEndpoint('fixtures/events'),      billing: BILLING },
  'api-football/fixtures-lineups':     { handler: footballEndpoint('fixtures/lineups'),     billing: BILLING },
  'api-football/standings':            { handler: footballEndpoint('standings'),            billing: BILLING },
  'api-football/players-topscorers':   { handler: footballEndpoint('players/topscorers'),   billing: BILLING },
  'api-football/players-topassists':   { handler: footballEndpoint('players/topassists'),   billing: BILLING },
  'api-football/players':              { handler: footballEndpoint('players'),              billing: BILLING },
  'api-football/players-squads':       { handler: footballEndpoint('players/squads'),       billing: BILLING },
  'api-football/transfers':            { handler: footballEndpoint('transfers'),            billing: BILLING },
  'api-football/injuries':             { handler: footballEndpoint('injuries'),             billing: BILLING },
  'api-football/predictions':          { handler: footballEndpoint('predictions'),          billing: BILLING },
  'api-football/coachs':               { handler: footballEndpoint('coachs'),               billing: BILLING },
  'api-football/venues':               { handler: footballEndpoint('venues'),               billing: BILLING },
}
