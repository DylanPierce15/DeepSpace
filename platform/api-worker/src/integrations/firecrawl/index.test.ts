import { describe, it, expect } from 'vitest'
import { ctx, env, hasRealKey } from '../_test-helpers'
import { endpoints } from '.'

const skip = !hasRealKey('FIRECRAWL_API_KEY')

describe('Firecrawl', () => {
  // --------------------------------------------------------------------------
  // Billing config tests (always run)
  // --------------------------------------------------------------------------

  it('billing: exports exactly 4 endpoints', () => {
    const keys = Object.keys(endpoints)
    expect(keys).toHaveLength(4)
    expect(keys).toContain('firecrawl/scrape')
    expect(keys).toContain('firecrawl/crawl')
    expect(keys).toContain('firecrawl/map')
    expect(keys).toContain('firecrawl/search')
  })

  it('billing: all endpoints cost $0.009 per request', () => {
    for (const key of ['firecrawl/scrape', 'firecrawl/crawl', 'firecrawl/map', 'firecrawl/search']) {
      expect(endpoints[key].billing.model).toBe('per_request')
      expect(endpoints[key].billing.baseCost).toBe(0.009)
      expect(endpoints[key].billing.currency).toBe('USD')
    }
  })

  // --------------------------------------------------------------------------
  // Validation tests (no API key needed)
  // --------------------------------------------------------------------------

  it('scrape: rejects missing url', async () => {
    await expect(
      endpoints['firecrawl/scrape'].handler(
        { ...env, FIRECRAWL_API_KEY: 'test-key' } as any,
        {},
        ctx,
      ),
    ).rejects.toThrow('url is required')
  })

  it('crawl: rejects missing url', async () => {
    await expect(
      endpoints['firecrawl/crawl'].handler(
        { ...env, FIRECRAWL_API_KEY: 'test-key' } as any,
        {},
        ctx,
      ),
    ).rejects.toThrow('url is required')
  })

  it('map: rejects missing url', async () => {
    await expect(
      endpoints['firecrawl/map'].handler(
        { ...env, FIRECRAWL_API_KEY: 'test-key' } as any,
        {},
        ctx,
      ),
    ).rejects.toThrow('url is required')
  })

  it('search: rejects missing query', async () => {
    await expect(
      endpoints['firecrawl/search'].handler(
        { ...env, FIRECRAWL_API_KEY: 'test-key' } as any,
        {},
        ctx,
      ),
    ).rejects.toThrow('query is required')
  })

  it('scrape: rejects when API key is missing', async () => {
    await expect(
      endpoints['firecrawl/scrape'].handler(
        { ...env, FIRECRAWL_API_KEY: '' } as any,
        { url: 'https://example.com' },
        ctx,
      ),
    ).rejects.toThrow('FIRECRAWL_API_KEY not configured')
  })

  // --------------------------------------------------------------------------
  // Live API tests (only with real key)
  // --------------------------------------------------------------------------

  it.skipIf(skip)('scrape: scrapes a page and returns markdown', async () => {
    const result = await endpoints['firecrawl/scrape'].handler(env as any, {
      url: 'https://example.com',
      formats: ['markdown'],
    }, ctx) as any
    expect(result.data).toBeDefined()
  }, 30000)

  it.skipIf(skip)('map: returns URLs from a site', async () => {
    const result = await endpoints['firecrawl/map'].handler(env as any, {
      url: 'https://example.com',
    }, ctx) as any
    expect(Array.isArray(result.links)).toBe(true)
  }, 30000)

  it.skipIf(skip)('search: returns results for a query', async () => {
    const result = await endpoints['firecrawl/search'].handler(env as any, {
      query: 'example domain',
      limit: 2,
    }, ctx) as any
    expect(result.data).toBeDefined()
  }, 30000)
})
