import { describe, it, expect } from 'vitest'
import { ctx, env, hasRealKey } from '../_test-helpers'
import { endpoints } from '.'

const skip = !hasRealKey('SERPAPI_API_KEY')

describe('LinkedIn', () => {
  // --------------------------------------------------------------------------
  // Billing config tests (always run)
  // --------------------------------------------------------------------------

  it('billing: exports exactly 2 endpoints', () => {
    const keys = Object.keys(endpoints)
    expect(keys).toHaveLength(2)
    expect(keys).toContain('linkedin/search-profiles')
    expect(keys).toContain('linkedin/analyze-profile-url')
  })

  it('billing: search-profiles costs $0.02', () => {
    const billing = endpoints['linkedin/search-profiles'].billing
    expect(billing.model).toBe('per_request')
    expect(billing.baseCost).toBe(0.02)
    expect(billing.currency).toBe('USD')
  })

  it('billing: analyze-profile-url costs $0.05', () => {
    const billing = endpoints['linkedin/analyze-profile-url'].billing
    expect(billing.model).toBe('per_request')
    expect(billing.baseCost).toBe(0.05)
    expect(billing.currency).toBe('USD')
  })

  // --------------------------------------------------------------------------
  // Validation tests (no API key needed)
  // --------------------------------------------------------------------------

  it('search-profiles: rejects missing SERPAPI_API_KEY', async () => {
    await expect(
      endpoints['linkedin/search-profiles'].handler(
        { ...env, SERPAPI_API_KEY: '' } as any,
        { name: 'test' },
        ctx,
      ),
    ).rejects.toThrow('SERPAPI_API_KEY not configured')
  })

  it('search-profiles: rejects empty search terms', async () => {
    await expect(
      endpoints['linkedin/search-profiles'].handler(
        { ...env, SERPAPI_API_KEY: 'test-key' } as any,
        {},
        ctx,
      ),
    ).rejects.toThrow('At least one search term')
  })

  it('analyze-profile-url: rejects invalid URL', async () => {
    await expect(
      endpoints['linkedin/analyze-profile-url'].handler(
        { ...env, SERPAPI_API_KEY: 'test-key' } as any,
        { profileUrl: 'https://example.com/not-linkedin' },
        ctx,
      ),
    ).rejects.toThrow('Invalid LinkedIn profile URL')
  })

  // --------------------------------------------------------------------------
  // Live API tests (only with real key)
  // --------------------------------------------------------------------------

  it.skipIf(skip)('search-profiles: finds LinkedIn profiles', async () => {
    const result = (await endpoints['linkedin/search-profiles'].handler(
      env as any,
      { name: 'software engineer', company: 'Google' },
      ctx,
    )) as any
    expect(Array.isArray(result.profiles)).toBe(true)
    expect(result.total).toBeGreaterThanOrEqual(0)
  }, 15000)

  it.skipIf(skip)('analyze-profile-url: enriches a profile', async () => {
    const result = (await endpoints['linkedin/analyze-profile-url'].handler(
      env as any,
      { profileUrl: 'https://www.linkedin.com/in/satyanadella/' },
      ctx,
    )) as any
    expect(result.profile).toBeDefined()
    expect(result.profile.id).toBeDefined()
  }, 15000)
})
