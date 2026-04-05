import { describe, it, expect } from 'vitest'
import { ctx, env } from '../_test-helpers'
import { endpoints } from '.'

describe('MTA', () => {
  // --------------------------------------------------------------------------
  // Billing config tests (always run)
  // --------------------------------------------------------------------------

  it('billing: all endpoints cost $0.001 per request', () => {
    for (const key of ['mta/feed', 'mta/arrivals', 'mta/alerts', 'mta/list-feeds']) {
      expect(endpoints[key].billing.model).toBe('per_request')
      expect(endpoints[key].billing.baseCost).toBe(0.001)
      expect(endpoints[key].billing.currency).toBe('USD')
    }
  })

  it('billing: exports exactly 4 endpoints', () => {
    const keys = Object.keys(endpoints)
    expect(keys).toHaveLength(4)
    expect(keys).toContain('mta/feed')
    expect(keys).toContain('mta/arrivals')
    expect(keys).toContain('mta/alerts')
    expect(keys).toContain('mta/list-feeds')
  })

  // --------------------------------------------------------------------------
  // API tests (MTA feeds are free — no key needed, always run)
  // --------------------------------------------------------------------------

  it('list-feeds returns all 8 feeds', async () => {
    const result = await endpoints['mta/list-feeds'].handler(env as any, {}, ctx) as any
    expect(result.feeds).toHaveLength(8)
    expect(result.feeds[0]).toHaveProperty('feedId')
    expect(result.feeds[0]).toHaveProperty('lines')
  }, 30000)

  it('feed: fetches and parses GTFS-RT for the L line', async () => {
    const result = await endpoints['mta/feed'].handler(env as any, { feedId: 'l' }, ctx) as any
    expect(result).toHaveProperty('feedId', 'l')
    expect(result).toHaveProperty('timestamp')
    expect(Array.isArray(result.tripUpdates)).toBe(true)
    expect(Array.isArray(result.vehiclePositions)).toBe(true)
    expect(Array.isArray(result.alerts)).toBe(true)
  }, 30000)

  it('feed: rejects unknown feed ID', async () => {
    await expect(
      endpoints['mta/feed'].handler(env as any, { feedId: 'xyz' }, ctx),
    ).rejects.toThrow('Unknown feed ID')
  })

  it('arrivals: returns arrivals for the L line', async () => {
    const result = await endpoints['mta/arrivals'].handler(env as any, { line: 'L' }, ctx) as any
    expect(Array.isArray(result.arrivals)).toBe(true)
    if (result.arrivals.length > 0) {
      expect(result.arrivals[0]).toHaveProperty('tripId')
      expect(result.arrivals[0]).toHaveProperty('routeId', 'L')
      expect(result.arrivals[0]).toHaveProperty('stopId')
    }
  }, 30000)

  it('arrivals: rejects unknown line', async () => {
    await expect(
      endpoints['mta/arrivals'].handler(env as any, { line: 'X' }, ctx),
    ).rejects.toThrow('Unknown subway line')
  })

  it('alerts: returns service alerts', async () => {
    const result = await endpoints['mta/alerts'].handler(env as any, {}, ctx) as any
    expect(Array.isArray(result.alerts)).toBe(true)
    if (result.alerts.length > 0) {
      expect(result.alerts[0]).toHaveProperty('id')
      expect(result.alerts[0]).toHaveProperty('informedEntities')
    }
  }, 30000)

  it('alerts: filters by line when provided', async () => {
    const result = await endpoints['mta/alerts'].handler(env as any, { line: 'L' }, ctx) as any
    expect(Array.isArray(result.alerts)).toBe(true)
    for (const alert of result.alerts) {
      const hasLine = alert.informedEntities.some((e: any) => e.routeId === 'L')
      expect(hasLine).toBe(true)
    }
  }, 30000)
})
