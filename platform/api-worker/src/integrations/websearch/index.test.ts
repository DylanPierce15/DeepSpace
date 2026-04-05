import { describe, it, expect } from 'vitest'
import { ctx, env, hasRealKey } from '../_test-helpers'
import { endpoints } from '.'

const skip = !hasRealKey('SERPAPI_API_KEY') || !hasRealKey('OPENAI_API_KEY')

describe('WebSearch', () => {
  // --------------------------------------------------------------------------
  // Billing config tests (always run)
  // --------------------------------------------------------------------------

  it('billing: exports exactly 1 endpoint', () => {
    const keys = Object.keys(endpoints)
    expect(keys).toHaveLength(1)
    expect(keys).toContain('websearch/advanced-search')
  })

  it('billing: advanced-search costs $0.02 per request', () => {
    const billing = endpoints['websearch/advanced-search'].billing
    expect(billing.model).toBe('per_request')
    expect(billing.baseCost).toBe(0.02)
    expect(billing.currency).toBe('USD')
  })

  // --------------------------------------------------------------------------
  // Validation tests (no API key needed)
  // --------------------------------------------------------------------------

  it('advanced-search: rejects missing searchPrompt', async () => {
    await expect(
      endpoints['websearch/advanced-search'].handler(
        { ...env, SERPAPI_API_KEY: 'test-key', OPENAI_API_KEY: 'test-key' } as any,
        {},
        ctx,
      ),
    ).rejects.toThrow('searchPrompt is required')
  })

  it('advanced-search: rejects empty searchPrompt', async () => {
    await expect(
      endpoints['websearch/advanced-search'].handler(
        { ...env, SERPAPI_API_KEY: 'test-key', OPENAI_API_KEY: 'test-key' } as any,
        { searchPrompt: '   ' },
        ctx,
      ),
    ).rejects.toThrow('searchPrompt is required')
  })

  it('advanced-search: rejects when SERPAPI_API_KEY is missing', async () => {
    await expect(
      endpoints['websearch/advanced-search'].handler(
        { ...env, SERPAPI_API_KEY: '', OPENAI_API_KEY: 'test-key' } as any,
        { searchPrompt: 'test' },
        ctx,
      ),
    ).rejects.toThrow('SERPAPI_API_KEY not configured')
  })

  it('advanced-search: rejects when OPENAI_API_KEY is missing', async () => {
    await expect(
      endpoints['websearch/advanced-search'].handler(
        { ...env, SERPAPI_API_KEY: 'test-key', OPENAI_API_KEY: '' } as any,
        { searchPrompt: 'test' },
        ctx,
      ),
    ).rejects.toThrow('OPENAI_API_KEY not configured')
  })

  // --------------------------------------------------------------------------
  // Live API tests (only with real keys)
  // --------------------------------------------------------------------------

  it.skipIf(skip)('advanced-search returns summary and citations', async () => {
    const result = await endpoints['websearch/advanced-search'].handler(
      env as any,
      {
        searchPrompt: 'What is the tallest building in the world?',
        searchType: 'web',
        count: 3,
      },
      ctx,
    ) as any
    expect(typeof result.summary).toBe('string')
    expect(result.summary.length).toBeGreaterThan(0)
    expect(Array.isArray(result.citations)).toBe(true)
    expect(result.dataset).toBeDefined()
    expect(Array.isArray(result.dataset.sources)).toBe(true)
  }, 60000)

  it.skipIf(skip)('advanced-search returns images for image search', async () => {
    const result = await endpoints['websearch/advanced-search'].handler(
      env as any,
      {
        searchPrompt: 'aurora borealis',
        searchType: 'images',
        count: 3,
      },
      ctx,
    ) as any
    expect(typeof result.summary).toBe('string')
    expect(Array.isArray(result.assets)).toBe(true)
    expect(result.dataset.images.length).toBeGreaterThan(0)
  }, 30000)
})
