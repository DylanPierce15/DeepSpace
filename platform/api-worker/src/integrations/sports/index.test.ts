import { describe, it, expect } from 'vitest'
import { ctx, env, hasRealKey } from '../_test-helpers'
import { endpoints } from '.'

const skipApiSports = !hasRealKey('API_SPORTS_KEY')

describe('Sports', () => {
  // --------------------------------------------------------------------------
  // Billing config tests (always run)
  // --------------------------------------------------------------------------

  it('billing: includes F1 endpoints', () => {
    expect(endpoints).toHaveProperty('f1/season-schedule')
    expect(endpoints).toHaveProperty('f1/driver-standings')
    expect(endpoints).toHaveProperty('f1/latest-race')
  })

  it('billing: includes football endpoints', () => {
    expect(endpoints).toHaveProperty('api-football/fixtures')
    expect(endpoints).toHaveProperty('api-football/standings')
  })

  it('billing: includes basketball endpoints', () => {
    expect(endpoints).toHaveProperty('api-basketball/games')
    expect(endpoints).toHaveProperty('api-basketball/standings')
  })

  it('billing: includes american football endpoints', () => {
    expect(endpoints).toHaveProperty('api-american-football/games')
    expect(endpoints).toHaveProperty('api-american-football/standings')
  })

  it('billing: includes baseball endpoints', () => {
    expect(endpoints).toHaveProperty('api-baseball/games')
    expect(endpoints).toHaveProperty('api-baseball/standings')
  })

  // --------------------------------------------------------------------------
  // Validation tests (no API key needed)
  // --------------------------------------------------------------------------

  it('f1/season-schedule: rejects missing season', async () => {
    await expect(
      endpoints['f1/season-schedule'].handler(env as any, {}, ctx),
    ).rejects.toThrow('season is required')
  })

  it('f1/driver-standings: rejects missing season', async () => {
    await expect(
      endpoints['f1/driver-standings'].handler(env as any, {}, ctx),
    ).rejects.toThrow('season is required')
  })

  it('f1/lap-times: rejects missing season and round', async () => {
    await expect(
      endpoints['f1/lap-times'].handler(env as any, {}, ctx),
    ).rejects.toThrow('season and round are required')
  })

  // --------------------------------------------------------------------------
  // Live API tests — F1 (no API key needed, uses Ergast/Jolpica)
  // --------------------------------------------------------------------------

  it('f1/season-schedule: returns 2024 race calendar', async () => {
    const result = await endpoints['f1/season-schedule'].handler(
      env as any,
      { season: 2024 },
      ctx,
    ) as any[]
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(10)
    expect(result[0]).toHaveProperty('raceName')
    expect(result[0]).toHaveProperty('Circuit')
    expect(result[0]).toHaveProperty('date')
  }, 30000)

  it('f1/driver-standings: returns 2024 standings', async () => {
    const result = await endpoints['f1/driver-standings'].handler(
      env as any,
      { season: 2024 },
      ctx,
    ) as any[]
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('Driver')
    expect(result[0]).toHaveProperty('points')
  }, 30000)

  it('f1/all-constructors: returns 2024 constructors', async () => {
    const result = await endpoints['f1/all-constructors'].handler(
      env as any,
      { season: 2024 },
      ctx,
    ) as any[]
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('constructorId')
    expect(result[0]).toHaveProperty('name')
  }, 30000)

  // --------------------------------------------------------------------------
  // Live API tests — API-Sports (require API_SPORTS_KEY)
  // --------------------------------------------------------------------------

  // OBSTACLE: API-Sports account is suspended. Tests skip until account is reactivated.
  it.skipIf(true)('api-football/standings: returns league standings', async () => {
    const result = await endpoints['api-football/standings'].handler(
      env as any,
      { league: 39, season: 2023 },
      ctx,
    ) as any
    expect(result).toHaveProperty('response')
    expect(Array.isArray(result.response)).toBe(true)
  }, 30000)
})
