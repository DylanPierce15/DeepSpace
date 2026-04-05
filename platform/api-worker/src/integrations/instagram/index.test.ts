import { describe, it, expect } from 'vitest'
import { ctx, env } from '../_test-helpers'
import { endpoints } from '.'

// Instagram scraping is fragile and rate-limited. Always skip live tests
// unless explicitly running them locally.
const skip = true

describe('Instagram', () => {
  // --------------------------------------------------------------------------
  // Billing config tests (always run)
  // --------------------------------------------------------------------------

  it('billing: exports exactly 1 endpoint', () => {
    const keys = Object.keys(endpoints)
    expect(keys).toHaveLength(1)
    expect(keys).toContain('instagram/extract-content')
  })

  it('billing: extract-content costs $0.02 per request', () => {
    const billing = endpoints['instagram/extract-content'].billing
    expect(billing.model).toBe('per_request')
    expect(billing.baseCost).toBe(0.02)
    expect(billing.currency).toBe('USD')
  })

  // --------------------------------------------------------------------------
  // Validation tests (no API key needed)
  // --------------------------------------------------------------------------

  it('extract-content: rejects missing url', async () => {
    await expect(
      endpoints['instagram/extract-content'].handler(env as any, {}, ctx),
    ).rejects.toThrow('Instagram URL is required')
  })

  it('extract-content: rejects invalid url', async () => {
    await expect(
      endpoints['instagram/extract-content'].handler(
        env as any,
        { url: 'https://example.com/not-instagram' },
        ctx,
      ),
    ).rejects.toThrow('Invalid Instagram URL format')
  })

  // --------------------------------------------------------------------------
  // Live API tests (fragile -- skip by default)
  // --------------------------------------------------------------------------

  it.skipIf(skip)('extract-content: extracts from a real post', async () => {
    const result = (await endpoints['instagram/extract-content'].handler(
      env as any,
      { url: 'https://www.instagram.com/p/C1234567890/' },
      ctx,
    )) as any
    expect(result.postId).toBeDefined()
    expect(result.caption).toBeDefined()
    expect(result.mediaType).toBeDefined()
    expect(result.permalink).toBeDefined()
  }, 30000)
})
