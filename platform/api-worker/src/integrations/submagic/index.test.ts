import { describe, it, expect } from 'vitest'
import { ctx, env, hasRealKey } from '../_test-helpers'
import { endpoints } from '.'

const skip = !hasRealKey('SUBMAGIC_API_KEY')

describe('SubMagic', () => {
  // --------------------------------------------------------------------------
  // Billing config tests (always run)
  // --------------------------------------------------------------------------

  it('billing: exports exactly 3 endpoints', () => {
    const keys = Object.keys(endpoints)
    expect(keys).toHaveLength(3)
    expect(keys).toContain('submagic/create-video')
    expect(keys).toContain('submagic/get-project')
    expect(keys).toContain('submagic/wait-for-completion')
  })

  it('billing: create-video costs $0.15 per request', () => {
    const billing = endpoints['submagic/create-video'].billing
    expect(billing.model).toBe('per_request')
    expect(billing.baseCost).toBe(0.15)
    expect(billing.currency).toBe('USD')
  })

  it('billing: get-project costs $0.01 per request', () => {
    const billing = endpoints['submagic/get-project'].billing
    expect(billing.model).toBe('per_request')
    expect(billing.baseCost).toBe(0.01)
    expect(billing.currency).toBe('USD')
  })

  it('billing: wait-for-completion costs $0.15 per request', () => {
    const billing = endpoints['submagic/wait-for-completion'].billing
    expect(billing.model).toBe('per_request')
    expect(billing.baseCost).toBe(0.15)
    expect(billing.currency).toBe('USD')
  })

  // --------------------------------------------------------------------------
  // Validation tests (no API key needed)
  // --------------------------------------------------------------------------

  it('create-video: rejects missing SUBMAGIC_API_KEY', async () => {
    await expect(
      endpoints['submagic/create-video'].handler(
        { ...env, SUBMAGIC_API_KEY: '' } as any,
        { title: 'test', language: 'en', videoUrl: 'https://example.com/video.mp4' },
        ctx,
      ),
    ).rejects.toThrow('SUBMAGIC_API_KEY not configured')
  })

  it('create-video: rejects missing title', async () => {
    await expect(
      endpoints['submagic/create-video'].handler(
        { ...env, SUBMAGIC_API_KEY: 'test-key' } as any,
        { language: 'en', videoUrl: 'https://example.com/video.mp4' },
        ctx,
      ),
    ).rejects.toThrow('title is required')
  })

  it('create-video: rejects missing language', async () => {
    await expect(
      endpoints['submagic/create-video'].handler(
        { ...env, SUBMAGIC_API_KEY: 'test-key' } as any,
        { title: 'test', videoUrl: 'https://example.com/video.mp4' },
        ctx,
      ),
    ).rejects.toThrow('language is required')
  })

  it('create-video: rejects missing videoUrl', async () => {
    await expect(
      endpoints['submagic/create-video'].handler(
        { ...env, SUBMAGIC_API_KEY: 'test-key' } as any,
        { title: 'test', language: 'en' },
        ctx,
      ),
    ).rejects.toThrow('videoUrl is required')
  })

  it('get-project: rejects missing projectId', async () => {
    await expect(
      endpoints['submagic/get-project'].handler(
        { ...env, SUBMAGIC_API_KEY: 'test-key' } as any,
        {},
        ctx,
      ),
    ).rejects.toThrow('projectId is required')
  })

  it('wait-for-completion: rejects missing projectId', async () => {
    await expect(
      endpoints['submagic/wait-for-completion'].handler(
        { ...env, SUBMAGIC_API_KEY: 'test-key' } as any,
        {},
        ctx,
      ),
    ).rejects.toThrow('projectId is required')
  })

  // --------------------------------------------------------------------------
  // Live API tests (only with real key)
  // --------------------------------------------------------------------------

  it.skipIf(skip)('get-project: fetches a project status', async () => {
    // This will likely 404 with a fake ID, but verifies the API call works
    await expect(
      endpoints['submagic/get-project'].handler(
        env as any,
        { projectId: 'test-nonexistent-id' },
        ctx,
      ),
    ).rejects.toThrow()
  }, 15000)
})
