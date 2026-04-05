import { describe, it, expect } from 'vitest'
import { ctx, env, hasRealKey } from '../_test-helpers'
import { endpoints } from '.'

describe('OpenWeatherMap', () => {
  it.skipIf(!hasRealKey('OPENWEATHER_API_KEY'))('geocoding returns locations', async () => {
    const result = await endpoints['openweathermap/geocoding'].handler(env as any, { query: 'New York' }, ctx) as any[]
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('name')
  }, 15000)

  it.skipIf(!hasRealKey('OPENWEATHER_API_KEY'))('current weather returns temp', async () => {
    const result = await endpoints['openweathermap/current'].handler(env as any, { location: 'London' }, ctx) as any
    expect(result).toHaveProperty('temp')
    expect(result).toHaveProperty('description')
    expect(typeof result.temp).toBe('number')
  }, 15000)

  it.skipIf(!hasRealKey('OPENWEATHER_API_KEY'))('forecast returns array', async () => {
    const result = await endpoints['openweathermap/forecast'].handler(env as any, { location: 'Paris' }, ctx) as any[]
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('temp')
  }, 15000)

  it('billing: all endpoints have per_request at $0.0015', () => {
    for (const key of Object.keys(endpoints)) {
      expect(endpoints[key].billing.model).toBe('per_request')
      expect(endpoints[key].billing.baseCost).toBe(0.0015)
    }
  })
})
