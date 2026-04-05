import { describe, it, expect } from 'vitest'
import { ctx, env, hasRealKey } from '../_test-helpers'
import { endpoints } from '.'

const skip = !hasRealKey('TIKTOK_API_KEY')

describe('TikTok', () => {
  // --------------------------------------------------------------------------
  // Billing config tests (always run)
  // --------------------------------------------------------------------------

  it('billing: exports exactly 4 endpoints', () => {
    const keys = Object.keys(endpoints)
    expect(keys).toHaveLength(4)
    expect(keys).toContain('tiktok/post-video')
    expect(keys).toContain('tiktok/user-info')
    expect(keys).toContain('tiktok/get-scheduled-posts')
    expect(keys).toContain('tiktok/cancel-scheduled-post')
  })

  it('billing: post-video costs $0.05 per request', () => {
    const billing = endpoints['tiktok/post-video'].billing
    expect(billing.model).toBe('per_request')
    expect(billing.baseCost).toBe(0.05)
    expect(billing.currency).toBe('USD')
  })

  it('billing: info endpoints cost $0.01 per request', () => {
    for (const key of ['tiktok/user-info', 'tiktok/get-scheduled-posts', 'tiktok/cancel-scheduled-post']) {
      expect(endpoints[key].billing.baseCost).toBe(0.01)
    }
  })

  // --------------------------------------------------------------------------
  // Validation tests (no API key needed)
  // --------------------------------------------------------------------------

  it('post-video: rejects missing TIKTOK_API_KEY', async () => {
    await expect(
      endpoints['tiktok/post-video'].handler(
        { ...env, TIKTOK_API_KEY: '' } as any,
        { videoUrl: 'https://example.com/video.mp4', caption: 'test' },
        ctx,
      ),
    ).rejects.toThrow('TIKTOK_API_KEY not configured')
  })

  it('post-video: rejects missing videoUrl', async () => {
    await expect(
      endpoints['tiktok/post-video'].handler(
        { ...env, TIKTOK_API_KEY: 'test-key' } as any,
        { caption: 'test' },
        ctx,
      ),
    ).rejects.toThrow('videoUrl is required')
  })

  it('post-video: rejects missing caption', async () => {
    await expect(
      endpoints['tiktok/post-video'].handler(
        { ...env, TIKTOK_API_KEY: 'test-key' } as any,
        { videoUrl: 'https://example.com/video.mp4' },
        ctx,
      ),
    ).rejects.toThrow('caption is required')
  })

  it('cancel-scheduled-post: rejects missing postId', async () => {
    await expect(
      endpoints['tiktok/cancel-scheduled-post'].handler(
        { ...env, TIKTOK_API_KEY: 'test-key' } as any,
        {},
        ctx,
      ),
    ).rejects.toThrow('postId is required')
  })

  // --------------------------------------------------------------------------
  // Live API tests (only with real key)
  // --------------------------------------------------------------------------

  it.skipIf(skip)('user-info: returns user data', async () => {
    const result = (await endpoints['tiktok/user-info'].handler(
      env as any,
      {},
      ctx,
    )) as any
    expect(result).toBeDefined()
  }, 15000)
})
