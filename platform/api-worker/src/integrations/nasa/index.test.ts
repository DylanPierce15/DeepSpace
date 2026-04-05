import { describe, it, expect } from 'vitest'
import { ctx, env, hasRealKey } from '../_test-helpers'
import { endpoints } from '.'

const skip = !hasRealKey('NASA_API_KEY')

describe('NASA', () => {
  it.skipIf(skip)('APOD returns picture of the day', async () => {
    const result = await endpoints['nasa/apod'].handler(env as any, {}, ctx) as any
    expect(result).toHaveProperty('title')
    expect(result).toHaveProperty('url')
    expect(result).toHaveProperty('explanation')
  }, 30000)

  it.skipIf(skip)('CME returns array', async () => {
    const result = await endpoints['nasa/cme'].handler(env as any, {}, ctx) as any[]
    expect(Array.isArray(result)).toBe(true)
  }, 30000)

  it.skipIf(skip)('GST returns array', async () => {
    const result = await endpoints['nasa/gst'].handler(env as any, {}, ctx) as any[]
    expect(Array.isArray(result)).toBe(true)
  }, 30000)

  it.skipIf(skip)('FLR returns array', async () => {
    const result = await endpoints['nasa/flr'].handler(env as any, {}, ctx) as any[]
    expect(Array.isArray(result)).toBe(true)
  }, 30000)

  it.skipIf(skip)('NeoWs feed returns near-earth objects', async () => {
    const result = await endpoints['nasa/neo-feed'].handler(env as any, {}, ctx) as any
    expect(result).toHaveProperty('element_count')
    expect(result).toHaveProperty('near_earth_objects')
  }, 30000)

  it.skipIf(skip)('NeoWs browse returns paginated list', async () => {
    const result = await endpoints['nasa/neo-browse'].handler(env as any, { size: 5 }, ctx) as any
    expect(result).toHaveProperty('near_earth_objects')
  }, 30000)

  it('billing: all endpoints at $0.01', () => {
    for (const key of Object.keys(endpoints)) {
      expect(endpoints[key].billing.baseCost).toBe(0.01)
    }
  })
})
