import { describe, it, expect } from 'vitest'
import { ctx, env, hasRealKey } from '../_test-helpers'
import { endpoints } from '.'

const skip = !hasRealKey('SERPAPI_API_KEY')

describe('Amazon', () => {
  // --------------------------------------------------------------------------
  // Billing config tests (always run)
  // --------------------------------------------------------------------------

  it('billing: exports exactly 1 endpoint', () => {
    const keys = Object.keys(endpoints)
    expect(keys).toHaveLength(1)
    expect(keys).toContain('amazon/search-products')
  })

  it('billing: search-products costs $0.01 per request', () => {
    const billing = endpoints['amazon/search-products'].billing
    expect(billing.model).toBe('per_request')
    expect(billing.baseCost).toBe(0.01)
    expect(billing.currency).toBe('USD')
  })

  // --------------------------------------------------------------------------
  // Validation tests (no API key needed)
  // --------------------------------------------------------------------------

  it('search-products: rejects missing query', async () => {
    await expect(
      endpoints['amazon/search-products'].handler(
        { ...env, SERPAPI_API_KEY: 'test-key' } as any,
        {},
        ctx,
      ),
    ).rejects.toThrow('query is required')
  })

  it('search-products: rejects when API key is missing', async () => {
    await expect(
      endpoints['amazon/search-products'].handler(
        { ...env, SERPAPI_API_KEY: '' } as any,
        { query: 'test' },
        ctx,
      ),
    ).rejects.toThrow('SERPAPI_API_KEY not configured')
  })

  // --------------------------------------------------------------------------
  // Live API tests (only with real key)
  // --------------------------------------------------------------------------

  it.skipIf(skip)('search-products returns products', async () => {
    const result = await endpoints['amazon/search-products'].handler(
      env as any,
      { query: 'wireless earbuds', limit: 3 },
      ctx,
    ) as any
    expect(Array.isArray(result.products)).toBe(true)
    expect(result.products.length).toBeGreaterThan(0)
    expect(result.products[0]).toHaveProperty('title')
    expect(result.products[0]).toHaveProperty('link')
    expect(result.products[0].link).toContain('amazon.com/dp/')
    expect(result.products[0].link).toContain('tag=deepspace02a8-20')
  }, 30000)

  it.skipIf(skip)('search-products respects limit', async () => {
    const result = await endpoints['amazon/search-products'].handler(
      env as any,
      { query: 'laptop stand', limit: 2 },
      ctx,
    ) as any
    expect(result.products.length).toBeLessThanOrEqual(2)
  }, 30000)
})
