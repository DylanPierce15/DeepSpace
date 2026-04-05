import { describe, it, expect } from 'vitest'
import { ctx, env, hasRealKey } from '../_test-helpers'
import { endpoints } from '.'

const skip = !hasRealKey('SERPAPI_API_KEY')

describe('SerpAPI', () => {
  // --------------------------------------------------------------------------
  // Billing config tests (always run)
  // --------------------------------------------------------------------------

  it('billing: exports core endpoints', () => {
    const keys = Object.keys(endpoints)
    expect(keys).toContain('serpapi/search')
    expect(keys).toContain('serpapi/web-search')
    expect(keys).toContain('serpapi/flights')
    expect(keys).toContain('serpapi/hotels')
    expect(keys).toContain('serpapi/events')
    expect(keys).toContain('serpapi/places-search')
    expect(keys).toContain('serpapi/places-reviews')
  })

  it('billing: exports scholar endpoints', () => {
    const keys = Object.keys(endpoints)
    expect(keys).toContain('scholar/search-authors')
    expect(keys).toContain('scholar/search-papers')
    expect(keys).toContain('scholar/get-author-papers')
    expect(keys).toContain('scholar/get-citation-details')
    expect(keys).toContain('scholar/get-author-details')
  })

  it('billing: all endpoints cost $0.01 per request', () => {
    for (const key of Object.keys(endpoints)) {
      expect(endpoints[key].billing.baseCost).toBe(0.01)
      expect(endpoints[key].billing.currency).toBe('USD')
      expect(endpoints[key].billing.model).toBe('per_request')
    }
  })

  // --------------------------------------------------------------------------
  // Validation tests (no API key needed)
  // --------------------------------------------------------------------------

  it('search: rejects missing SERPAPI_API_KEY', async () => {
    await expect(
      endpoints['serpapi/search'].handler(
        { ...env, SERPAPI_API_KEY: '' } as any,
        { q: 'test' },
        ctx,
      ),
    ).rejects.toThrow('SERPAPI_API_KEY not configured')
  })

  // --------------------------------------------------------------------------
  // Live API tests (only with real key)
  // --------------------------------------------------------------------------

  it.skipIf(skip)('search: returns Google search results', async () => {
    const result = await endpoints['serpapi/search'].handler(
      env as any,
      { q: 'OpenAI', num: 3 },
      ctx,
    ) as any
    expect(result).toHaveProperty('search_metadata')
    expect(result).toHaveProperty('organic_results')
    expect(Array.isArray(result.organic_results)).toBe(true)
  }, 30000)

  it.skipIf(skip)('web-search: returns web results', async () => {
    const result = await endpoints['serpapi/web-search'].handler(
      env as any,
      { q: 'TypeScript programming', num: 3 },
      ctx,
    ) as any
    expect(result).toHaveProperty('search_metadata')
    expect(result).toHaveProperty('organic_results')
    expect(Array.isArray(result.organic_results)).toBe(true)
    expect(result.organic_results.length).toBeGreaterThan(0)
  }, 30000)

  it.skipIf(skip)('events: returns event results', async () => {
    const result = await endpoints['serpapi/events'].handler(
      env as any,
      { q: 'concerts in New York' },
      ctx,
    ) as any
    expect(result).toHaveProperty('search_metadata')
    expect(result).toHaveProperty('events_results')
  }, 30000)

  it.skipIf(skip)('scholar/search-papers: returns academic papers', async () => {
    const result = await endpoints['scholar/search-papers'].handler(
      env as any,
      { q: 'machine learning', num: 3 },
      ctx,
    ) as any
    expect(result).toHaveProperty('search_metadata')
    expect(result).toHaveProperty('organic_results')
    expect(Array.isArray(result.organic_results)).toBe(true)
  }, 30000)
})
