/**
 * F1 integration — Formula 1 data via Jolpica (Ergast) API.
 * No API key required.
 *
 * API Base: https://api.jolpi.ca/ergast/f1
 * Ported from Miyagi3 F1Service.ts.
 */

import type { IntegrationHandler, EndpointDefinition } from '../_types'

const API_BASE = 'https://api.jolpi.ca/ergast/f1'
const PAGE_SIZE = 30
const BILLING = { model: 'per_request' as const, baseCost: 0.01, currency: 'USD' }

// ── Helpers ────────────────────────────────────────────────────────────────────

async function f1Fetch(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'DeepSpace-F1/1.0' },
  })
  if (!res.ok) throw new Error(`F1 API error: ${res.status} - ${await res.text()}`)
  return res.json()
}

/**
 * Paginate through Ergast-style API (offset-based, 30 per page).
 * `extractFn` pulls the array out of each page's JSON response.
 */
async function f1Paginate(
  baseUrl: string,
  extractFn: (json: any) => any[],
): Promise<any[]> {
  let offset = 0
  const all: any[] = []

  while (true) {
    const url = offset === 0
      ? `${baseUrl}.json`
      : `${baseUrl}.json?offset=${offset}`

    const json = await f1Fetch(url)
    const page = extractFn(json)

    if (!Array.isArray(page) || page.length === 0) break
    all.push(...page)
    offset += PAGE_SIZE
  }

  return all
}

// ── Handlers ───────────────────────────────────────────────────────────────────

const seasonSchedule: IntegrationHandler = async (_env, body) => {
  const { season } = body as { season: number }
  if (!season) throw new Error('season is required')
  return f1Paginate(
    `${API_BASE}/${season}`,
    (json) => json?.MRData?.RaceTable?.Races || [],
  )
}

const raceWeekend: IntegrationHandler = async (_env, body) => {
  const { season, round } = body as { season: number; round: number }
  if (!season || !round) throw new Error('season and round are required')

  const [results, qualifying, sprint] = await Promise.all([
    f1Paginate(
      `${API_BASE}/${season}/${round}/results`,
      (json) => json?.MRData?.RaceTable?.Races?.[0]?.Results || [],
    ),
    f1Paginate(
      `${API_BASE}/${season}/${round}/qualifying`,
      (json) => json?.MRData?.RaceTable?.Races?.[0]?.QualifyingResults || [],
    ),
    f1Paginate(
      `${API_BASE}/${season}/${round}/sprint`,
      (json) => json?.MRData?.RaceTable?.Races?.[0]?.SprintResults || [],
    ),
  ])

  const metaJson = await f1Fetch(`${API_BASE}/${season}/${round}.json`)
  const raceInfo = metaJson?.MRData?.RaceTable?.Races?.[0] || {}

  return {
    season,
    round,
    raceName: raceInfo.raceName,
    circuit: raceInfo.Circuit,
    date: raceInfo.date,
    time: raceInfo.time,
    results,
    qualifying,
    sprint: sprint.length > 0 ? sprint : null,
  }
}

const latestRace: IntegrationHandler = async (_env, body) => {
  const season = (body as any).season || new Date().getFullYear()
  const json = await f1Fetch(`${API_BASE}/${season}/last/results.json`)
  return json?.MRData?.RaceTable?.Races?.[0] ?? null
}

const lapTimes: IntegrationHandler = async (_env, body) => {
  const { season, round, driverId } = body as {
    season: number
    round: number
    driverId?: string
  }
  if (!season || !round) throw new Error('season and round are required')

  const rawLaps = await f1Paginate(
    `${API_BASE}/${season}/${round}/laps`,
    (json) => json?.MRData?.RaceTable?.Races?.[0]?.Laps || [],
  )

  // Merge laps that may be split across pagination pages
  const lapMap: Record<string, any> = {}
  for (const lap of rawLaps) {
    const n = lap.number
    if (!lapMap[n]) lapMap[n] = { number: n, Timings: [] }
    lapMap[n].Timings.push(...(lap.Timings || []))
  }

  const laps = Object.values(lapMap).sort(
    (a, b) => parseInt(a.number) - parseInt(b.number),
  )

  if (driverId) {
    const driverLaps = laps
      .map((lap) => ({
        lap: lap.number,
        timings: lap.Timings?.filter((t: any) => t.driverId === driverId) || [],
      }))
      .filter((l) => l.timings.length > 0)
    return { laps: driverLaps, driverId, totalLaps: driverLaps.length, totalTimings: driverLaps.length }
  }

  const driverLaps: Record<string, any[]> = {}
  let totalTimings = 0
  for (const lap of laps) {
    for (const timing of lap.Timings || []) {
      if (!driverLaps[timing.driverId]) driverLaps[timing.driverId] = []
      driverLaps[timing.driverId].push({
        lap: lap.number,
        time: timing.time,
        position: timing.position,
      })
      totalTimings++
    }
  }

  return { laps, totalLaps: laps.length, driverLaps, totalTimings }
}

const pitStops: IntegrationHandler = async (_env, body) => {
  const { season, round } = body as { season: number; round: number }
  if (!season || !round) throw new Error('season and round are required')
  return f1Paginate(
    `${API_BASE}/${season}/${round}/pitstops`,
    (json) => json?.MRData?.RaceTable?.Races?.[0]?.PitStops || [],
  )
}

const driverStandings: IntegrationHandler = async (_env, body) => {
  const { season, round } = body as { season: number; round?: number }
  if (!season) throw new Error('season is required')
  const url = round
    ? `${API_BASE}/${season}/${round}/driverStandings`
    : `${API_BASE}/${season}/driverStandings`
  return f1Paginate(
    url,
    (json) => json?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [],
  )
}

const constructorStandings: IntegrationHandler = async (_env, body) => {
  const { season, round } = body as { season: number; round?: number }
  if (!season) throw new Error('season is required')
  const url = round
    ? `${API_BASE}/${season}/${round}/constructorStandings`
    : `${API_BASE}/${season}/constructorStandings`
  return f1Paginate(
    url,
    (json) => json?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [],
  )
}

const qualifying: IntegrationHandler = async (_env, body) => {
  const { season, round } = body as { season: number; round: number }
  if (!season || !round) throw new Error('season and round are required')
  return f1Paginate(
    `${API_BASE}/${season}/${round}/qualifying`,
    (json) => json?.MRData?.RaceTable?.Races?.[0]?.QualifyingResults || [],
  )
}

const sprint: IntegrationHandler = async (_env, body) => {
  const { season, round } = body as { season: number; round: number }
  if (!season || !round) throw new Error('season and round are required')
  return f1Paginate(
    `${API_BASE}/${season}/${round}/sprint`,
    (json) => json?.MRData?.RaceTable?.Races?.[0]?.SprintResults || [],
  )
}

const raceResults: IntegrationHandler = async (_env, body) => {
  const { season, round } = body as { season: number; round: number }
  if (!season || !round) throw new Error('season and round are required')
  return f1Paginate(
    `${API_BASE}/${season}/${round}/results`,
    (json) => json?.MRData?.RaceTable?.Races?.[0]?.Results || [],
  )
}

const allDrivers: IntegrationHandler = async (_env, body) => {
  const { season } = body as { season: number }
  if (!season) throw new Error('season is required')
  return f1Paginate(
    `${API_BASE}/${season}/drivers`,
    (json) => json?.MRData?.DriverTable?.Drivers || [],
  )
}

const allConstructors: IntegrationHandler = async (_env, body) => {
  const { season } = body as { season: number }
  if (!season) throw new Error('season is required')
  return f1Paginate(
    `${API_BASE}/${season}/constructors`,
    (json) => json?.MRData?.ConstructorTable?.Constructors || [],
  )
}

const circuitInfo: IntegrationHandler = async (_env, body) => {
  const { circuitId } = body as { circuitId: string }
  if (!circuitId) throw new Error('circuitId is required')
  const json = await f1Fetch(`${API_BASE}/circuits/${circuitId}.json`)
  return json?.MRData?.CircuitTable?.Circuits?.[0] ?? null
}

// ── Export ──────────────────────────────────────────────────────────────────────

export const endpoints: Record<string, EndpointDefinition> = {
  'f1/season-schedule':        { handler: seasonSchedule,        billing: BILLING },
  'f1/race-weekend':           { handler: raceWeekend,           billing: BILLING },
  'f1/latest-race':            { handler: latestRace,            billing: BILLING },
  'f1/lap-times':              { handler: lapTimes,              billing: BILLING },
  'f1/pit-stops':              { handler: pitStops,              billing: BILLING },
  'f1/driver-standings':       { handler: driverStandings,       billing: BILLING },
  'f1/constructor-standings':  { handler: constructorStandings,  billing: BILLING },
  'f1/qualifying':             { handler: qualifying,            billing: BILLING },
  'f1/sprint':                 { handler: sprint,                billing: BILLING },
  'f1/race-results':           { handler: raceResults,           billing: BILLING },
  'f1/all-drivers':            { handler: allDrivers,            billing: BILLING },
  'f1/all-constructors':       { handler: allConstructors,       billing: BILLING },
  'f1/circuit-info':           { handler: circuitInfo,           billing: BILLING },
}
