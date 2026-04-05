/**
 * MTA Subway integration — real-time NYC subway data from GTFS-RT feeds.
 * Ported from Miyagi3 MTASubwayService.ts.
 *
 * The MTA provides GTFS-Realtime feeds in Protocol Buffer format.
 * We use a JSON proxy approach: the MTA's public feeds return protobuf,
 * which we parse using gtfs-realtime-bindings (loaded dynamically).
 *
 * No API key is required for subway feeds.
 */

import type { IntegrationHandler, EndpointDefinition } from '../_types'

// ============================================================================
// Constants
// ============================================================================

type MTAFeedId = 'ace' | 'bdfm' | 'g' | 'jz' | 'l' | 'nqrw' | '1234567' | 'sir'

const FEED_LINE_MAP: Record<MTAFeedId, string[]> = {
  ace: ['A', 'C', 'E'],
  bdfm: ['B', 'D', 'F', 'M'],
  g: ['G'],
  jz: ['J', 'Z'],
  l: ['L'],
  nqrw: ['N', 'Q', 'R', 'W'],
  '1234567': ['1', '2', '3', '4', '5', '6', '7'],
  sir: ['SIR'],
}

const LINE_TO_FEED: Record<string, MTAFeedId> = {
  A: 'ace', C: 'ace', E: 'ace',
  B: 'bdfm', D: 'bdfm', F: 'bdfm', M: 'bdfm',
  G: 'g',
  J: 'jz', Z: 'jz',
  L: 'l',
  N: 'nqrw', Q: 'nqrw', R: 'nqrw', W: 'nqrw',
  '1': '1234567', '2': '1234567', '3': '1234567',
  '4': '1234567', '5': '1234567', '6': '1234567', '7': '1234567',
  SIR: 'sir',
}

const FEED_URLS: Record<MTAFeedId, string> = {
  ace: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace',
  bdfm: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm',
  g: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g',
  jz: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz',
  l: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l',
  nqrw: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw',
  '1234567': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs',
  sir: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si',
}

const ALERTS_FEED_URL = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fsubway-alerts'
const STOPS_DATA_URL = 'https://data.ny.gov/resource/39hk-dx4f.json?$limit=5000'
const FETCH_TIMEOUT_MS = 15000

const VALID_FEED_IDS = Object.keys(FEED_URLS) as MTAFeedId[]

// ============================================================================
// Station name cache (module-level, shared across invocations)
// ============================================================================

let stationsCache: Map<string, string> | null = null
let stationsCacheExpiry = 0
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
let stationsCacheLoadPromise: Promise<void> | null = null

function getStationName(stopId: string): string | undefined {
  if (!stationsCache) return undefined
  if (stationsCache.has(stopId)) return stationsCache.get(stopId)
  const baseStopId = stopId.replace(/[NS]$/, '')
  return stationsCache.get(baseStopId)
}

async function ensureStationsCache(): Promise<void> {
  const now = Date.now()
  if (stationsCache && now < stationsCacheExpiry) return
  if (stationsCacheLoadPromise) { await stationsCacheLoadPromise; return }

  stationsCacheLoadPromise = loadStationsCache()
  try { await stationsCacheLoadPromise } finally { stationsCacheLoadPromise = null }
}

async function loadStationsCache(): Promise<void> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(STOPS_DATA_URL, {
        method: 'GET',
        headers: { 'User-Agent': 'DeepSpace-MTA-Service/1.0', Accept: 'application/json' },
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!response.ok) {
      if (!stationsCache) stationsCache = new Map()
      return
    }

    const data: unknown = await response.json()
    if (!Array.isArray(data)) {
      if (!stationsCache) stationsCache = new Map()
      return
    }

    const stations = new Map<string, string>()
    for (const stop of data) {
      if (typeof stop !== 'object' || stop === null) continue
      const rec = stop as Record<string, unknown>
      const stopId = rec.gtfs_stop_id ?? rec.stop_id
      const stopName = rec.stop_name
      if (typeof stopId !== 'string' || typeof stopName !== 'string') continue
      stations.set(stopId, stopName)
      const baseId = stopId.replace(/[NS]$/, '')
      if (!stations.has(baseId)) stations.set(baseId, stopName)
    }

    stationsCache = stations
    stationsCacheExpiry = Date.now() + CACHE_TTL_MS
  } catch {
    if (!stationsCache) stationsCache = new Map()
  }
}

// ============================================================================
// GTFS-RT parsing helpers
// ============================================================================

interface GtfsRealtimeBindingsType {
  transit_realtime: {
    FeedMessage: {
      decode(data: Uint8Array): GtfsFeedMessage
    }
  }
}

interface GtfsFeedMessage {
  header?: { timestamp?: unknown }
  entity?: GtfsFeedEntity[]
}

interface GtfsFeedEntity {
  id: string
  tripUpdate?: {
    trip?: {
      tripId?: string
      routeId?: string
      startDate?: string
      startTime?: string
      scheduleRelationship?: number
    }
    stopTimeUpdate?: Array<{
      stopId?: string
      arrival?: { time?: unknown; delay?: number }
      departure?: { time?: unknown; delay?: number }
      scheduleRelationship?: number
    }>
  }
  vehicle?: {
    trip?: { tripId?: string; routeId?: string }
    currentStopSequence?: number
    currentStatus?: number
    timestamp?: unknown
    stopId?: string
  }
  alert?: {
    headerText?: { translation?: Array<{ text?: string; language?: string }> }
    descriptionText?: { translation?: Array<{ text?: string; language?: string }> }
    activePeriod?: Array<{ start?: unknown; end?: unknown }>
    informedEntity?: Array<{ agencyId?: string; routeId?: string; stopId?: string }>
    cause?: number
    effect?: number
  }
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return Number.isNaN(value) ? 0 : value
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    const num = (value as { toNumber(): number }).toNumber()
    return Number.isNaN(num) ? 0 : num
  }
  const num = Number(value)
  return Number.isNaN(num) ? 0 : num
}

function getTranslatedText(ts: { translation?: Array<{ text?: string; language?: string }> } | undefined): string | undefined {
  if (!ts?.translation) return undefined
  const en = ts.translation.find(t => t.language === 'en' || !t.language)
  return en?.text || ts.translation[0]?.text
}

const SCHEDULE_RELATIONSHIP: Record<number, string> = {
  0: 'SCHEDULED', 1: 'ADDED', 2: 'UNSCHEDULED', 3: 'CANCELED', 4: 'SKIPPED', 5: 'NO_DATA', 6: 'DUPLICATED',
}
const VEHICLE_STATUS: Record<number, string> = { 0: 'INCOMING_AT', 1: 'STOPPED_AT', 2: 'IN_TRANSIT_TO' }
const ALERT_CAUSE: Record<number, string> = {
  1: 'UNKNOWN_CAUSE', 2: 'OTHER_CAUSE', 3: 'TECHNICAL_PROBLEM', 4: 'STRIKE',
  5: 'DEMONSTRATION', 6: 'ACCIDENT', 7: 'HOLIDAY', 8: 'WEATHER',
  9: 'MAINTENANCE', 10: 'CONSTRUCTION', 11: 'POLICE_ACTIVITY', 12: 'MEDICAL_EMERGENCY',
}
const ALERT_EFFECT: Record<number, string> = {
  1: 'NO_SERVICE', 2: 'REDUCED_SERVICE', 3: 'SIGNIFICANT_DELAYS', 4: 'DETOUR',
  5: 'ADDITIONAL_SERVICE', 6: 'MODIFIED_SERVICE', 7: 'OTHER_EFFECT', 8: 'UNKNOWN_EFFECT', 9: 'STOP_MOVED',
}

async function loadGtfsBindings(): Promise<GtfsRealtimeBindingsType> {
  const module = await import('gtfs-realtime-bindings')
  return (module.default || module) as GtfsRealtimeBindingsType
}

function parseFeedMessage(feed: GtfsFeedMessage, feedId: MTAFeedId) {
  const tripUpdates: any[] = []
  const vehiclePositions: any[] = []
  const alerts: any[] = []

  for (const entity of feed.entity || []) {
    if (entity.tripUpdate) {
      const tu = entity.tripUpdate
      tripUpdates.push({
        tripId: tu.trip?.tripId || entity.id,
        routeId: tu.trip?.routeId || '',
        startDate: tu.trip?.startDate,
        startTime: tu.trip?.startTime,
        scheduleRelationship: tu.trip?.scheduleRelationship !== undefined
          ? SCHEDULE_RELATIONSHIP[tu.trip.scheduleRelationship]
          : undefined,
        stopTimeUpdates: (tu.stopTimeUpdate || []).map(stu => ({
          stopId: stu.stopId || '',
          stationName: getStationName(stu.stopId || ''),
          arrival: stu.arrival ? { time: toNumber(stu.arrival.time), delay: stu.arrival.delay } : undefined,
          departure: stu.departure ? { time: toNumber(stu.departure.time), delay: stu.departure.delay } : undefined,
          scheduleRelationship: stu.scheduleRelationship !== undefined
            ? SCHEDULE_RELATIONSHIP[stu.scheduleRelationship]
            : undefined,
        })),
      })
    }

    if (entity.vehicle) {
      const vp = entity.vehicle
      vehiclePositions.push({
        tripId: vp.trip?.tripId,
        routeId: vp.trip?.routeId,
        currentStopSequence: vp.currentStopSequence,
        currentStatus: vp.currentStatus !== undefined ? VEHICLE_STATUS[vp.currentStatus] : undefined,
        timestamp: toNumber(vp.timestamp),
        stopId: vp.stopId,
        stationName: vp.stopId ? getStationName(vp.stopId) : undefined,
      })
    }

    if (entity.alert) {
      alerts.push(parseAlertEntity(entity))
    }
  }

  return {
    feedId,
    timestamp: toNumber(feed.header?.timestamp) || Date.now() / 1000,
    tripUpdates,
    vehiclePositions,
    alerts,
  }
}

function parseAlertEntity(entity: GtfsFeedEntity) {
  const alert = entity.alert!
  return {
    id: entity.id,
    headerText: getTranslatedText(alert.headerText),
    descriptionText: getTranslatedText(alert.descriptionText),
    activePeriods: (alert.activePeriod || []).map(p => ({
      start: toNumber(p.start),
      end: toNumber(p.end),
    })),
    informedEntities: (alert.informedEntity || []).map(e => ({
      agencyId: e.agencyId,
      routeId: e.routeId,
      stopId: e.stopId,
      stationName: e.stopId ? getStationName(e.stopId) : undefined,
    })),
    cause: alert.cause !== undefined ? ALERT_CAUSE[alert.cause] : undefined,
    effect: alert.effect !== undefined ? ALERT_EFFECT[alert.effect] : undefined,
  }
}

async function fetchAndParseFeed(feedId: MTAFeedId) {
  const url = FEED_URLS[feedId]
  if (!url) {
    throw new Error(`Unknown feed ID: ${feedId}. Valid IDs: ${VALID_FEED_IDS.join(', ')}`)
  }

  const [GtfsBindings] = await Promise.all([
    loadGtfsBindings(),
    ensureStationsCache(),
  ])

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'DeepSpace-MTA-Service/1.0', Accept: 'application/x-protobuf' },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    throw new Error(`MTA API error: ${response.status} ${response.statusText}`)
  }

  const buffer = await response.arrayBuffer()
  const feed = GtfsBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer))
  return parseFeedMessage(feed, feedId)
}

// ============================================================================
// feed — fetch and parse a GTFS-RT feed
// ============================================================================

const feed: IntegrationHandler = async (_env, body) => {
  const feedId = body.feedId as MTAFeedId
  if (!feedId) throw new Error('feedId is required')
  if (!VALID_FEED_IDS.includes(feedId)) {
    throw new Error(`Unknown feed ID: ${feedId}. Valid IDs: ${VALID_FEED_IDS.join(', ')}`)
  }
  return fetchAndParseFeed(feedId)
}

// ============================================================================
// arrivals — get upcoming arrivals for a line, optionally at a specific stop
// ============================================================================

const arrivals: IntegrationHandler = async (_env, body) => {
  const line = String(body.line || '').toUpperCase()
  if (!line) throw new Error('line is required')

  const feedId = LINE_TO_FEED[line]
  if (!feedId) {
    throw new Error(`Unknown subway line: ${line}. Valid lines: ${Object.keys(LINE_TO_FEED).join(', ')}`)
  }

  const feedData = await fetchAndParseFeed(feedId)
  const stopId = body.stopId as string | undefined

  const result: any[] = []
  for (const tu of feedData.tripUpdates) {
    if (tu.routeId !== line) continue
    for (const stu of tu.stopTimeUpdates) {
      if (stopId && stu.stopId !== stopId) continue
      result.push({
        tripId: tu.tripId,
        routeId: tu.routeId,
        stopId: stu.stopId,
        stationName: stu.stationName,
        arrivalTime: stu.arrival?.time,
        departureTime: stu.departure?.time,
        delay: stu.arrival?.delay ?? stu.departure?.delay,
      })
    }
  }

  result.sort((a, b) => (a.arrivalTime ?? 0) - (b.arrivalTime ?? 0))
  return { arrivals: result }
}

// ============================================================================
// alerts — service alerts, optionally filtered by line
// ============================================================================

const alerts: IntegrationHandler = async (_env, body) => {
  const line = body.line ? String(body.line).toUpperCase() : undefined

  const [GtfsBindings] = await Promise.all([
    loadGtfsBindings(),
    ensureStationsCache(),
  ])

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(ALERTS_FEED_URL, {
      method: 'GET',
      headers: { 'User-Agent': 'DeepSpace-MTA-Service/1.0', Accept: 'application/x-protobuf' },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    throw new Error(`MTA Alerts API error: ${response.status} ${response.statusText}`)
  }

  const buffer = await response.arrayBuffer()
  const feedMsg = GtfsBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer))

  let parsed: any[] = []
  for (const entity of feedMsg.entity || []) {
    if (entity.alert) parsed.push(parseAlertEntity(entity))
  }

  if (line) {
    parsed = parsed.filter(a => a.informedEntities.some((e: any) => e.routeId === line))
  }

  return { alerts: parsed }
}

// ============================================================================
// list-feeds — returns available feeds and the lines they cover
// ============================================================================

const listFeeds: IntegrationHandler = async () => {
  return {
    feeds: VALID_FEED_IDS.map(feedId => ({
      feedId,
      lines: FEED_LINE_MAP[feedId],
    })),
  }
}

// ============================================================================
// Exports
// ============================================================================

const MTA_BILLING = { model: 'per_request' as const, baseCost: 0.001, currency: 'USD' }

export const endpoints: Record<string, EndpointDefinition> = {
  'mta/feed':       { handler: feed,      billing: MTA_BILLING },
  'mta/arrivals':   { handler: arrivals,  billing: MTA_BILLING },
  'mta/alerts':     { handler: alerts,    billing: MTA_BILLING },
  'mta/list-feeds': { handler: listFeeds, billing: MTA_BILLING },
}
