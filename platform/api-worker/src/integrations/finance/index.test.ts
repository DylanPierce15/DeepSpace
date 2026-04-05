import { describe, it, expect } from 'vitest'
import { ctx, env } from '../_test-helpers'
import { endpoints } from '.'

describe('Finance', () => {
  it('crypto price returns BTC price', async () => {
    const result = await endpoints['coinbase/crypto-price'].handler(env as any, { symbol: 'BTC' }, ctx) as any
    expect(result).toHaveProperty('amount')
    expect(result).toHaveProperty('currency')
    expect(parseFloat(result.amount)).toBeGreaterThan(0)
  }, 15000)

  it('crypto search finds Bitcoin', async () => {
    const result = await endpoints['coinbase/search-crypto'].handler(env as any, { query: 'bitcoin' }, ctx) as any[]
    expect(result.length).toBeGreaterThan(0)
    expect(result.some((c: any) => c.code === 'BTC')).toBe(true)
  }, 15000)

  it('currency search finds USD', async () => {
    const result = await endpoints['coinbase/search-currencies'].handler(env as any, { query: 'dollar' }, ctx) as any[]
    expect(result.length).toBeGreaterThan(0)
  }, 15000)

  it('billing: 5 endpoints registered', () => {
    expect(Object.keys(endpoints)).toHaveLength(5)
  })
})
