import { describe, it, expect } from 'vitest'
import { ctx, env, hasRealKey } from '../_test-helpers'
import { endpoints } from '.'

const skip = !hasRealKey('FREEPIK_API_KEY')

describe('Freepik', () => {
  // --------------------------------------------------------------------------
  // Billing config tests (always run)
  // --------------------------------------------------------------------------

  it('billing: exports sync image generation endpoints', () => {
    expect(endpoints).toHaveProperty('freepik/text-to-image-classic')
    expect(endpoints).toHaveProperty('freepik/generate-image-mystic')
    expect(endpoints).toHaveProperty('freepik/generate-image-flux-dev')
  })

  it('billing: exports async image generation endpoints', () => {
    expect(endpoints).toHaveProperty('freepik/generate-image-flux-pro')
    expect(endpoints).toHaveProperty('freepik/generate-image-flux-2-pro')
    expect(endpoints).toHaveProperty('freepik/generate-image-flux-2-turbo')
  })

  it('billing: exports image tool endpoints', () => {
    expect(endpoints).toHaveProperty('freepik/remove-background')
    expect(endpoints).toHaveProperty('freepik/upscale-image-precision')
    expect(endpoints).toHaveProperty('freepik/image-relight')
    expect(endpoints).toHaveProperty('freepik/image-style-transfer')
    expect(endpoints).toHaveProperty('freepik/image-expand')
  })

  it('billing: exports stock/download endpoints', () => {
    expect(endpoints).toHaveProperty('freepik/download-icons')
    expect(endpoints).toHaveProperty('freepik/download-stock-images')
    expect(endpoints).toHaveProperty('freepik/download-stock-videos')
  })

  it('billing: text-to-image-classic costs $0.005 per request', () => {
    const billing = endpoints['freepik/text-to-image-classic'].billing
    expect(billing.model).toBe('per_request')
    expect(billing.baseCost).toBe(0.005)
    expect(billing.currency).toBe('USD')
  })

  it('billing: mystic costs $0.069 with resolution multipliers', () => {
    const billing = endpoints['freepik/generate-image-mystic'].billing
    expect(billing.baseCost).toBe(0.069)
    expect(billing.costModifiers?.baseMultipliers?.resolution).toBeDefined()
  })

  // --------------------------------------------------------------------------
  // Validation tests (no API key needed)
  // --------------------------------------------------------------------------

  it('text-to-image-classic: rejects missing FREEPIK_API_KEY', async () => {
    await expect(
      endpoints['freepik/text-to-image-classic'].handler(
        { ...env, FREEPIK_API_KEY: '' } as any,
        { prompt: 'a cat' },
        ctx,
      ),
    ).rejects.toThrow('FREEPIK_API_KEY not configured')
  })

  it('download-icons: rejects missing id', async () => {
    await expect(
      endpoints['freepik/download-icons'].handler(
        { ...env, FREEPIK_API_KEY: 'test-key' } as any,
        {},
        ctx,
      ),
    ).rejects.toThrow('id is required')
  })

  it('download-stock-images: rejects missing id', async () => {
    await expect(
      endpoints['freepik/download-stock-images'].handler(
        { ...env, FREEPIK_API_KEY: 'test-key' } as any,
        {},
        ctx,
      ),
    ).rejects.toThrow('id is required')
  })

  it('download-stock-videos: rejects missing id', async () => {
    await expect(
      endpoints['freepik/download-stock-videos'].handler(
        { ...env, FREEPIK_API_KEY: 'test-key' } as any,
        {},
        ctx,
      ),
    ).rejects.toThrow('id is required')
  })

  // --------------------------------------------------------------------------
  // Live API tests (only with real key)
  // --------------------------------------------------------------------------

  it.skipIf(skip)('text-to-image-classic: generates an image', async () => {
    const result = await endpoints['freepik/text-to-image-classic'].handler(
      env as any,
      { prompt: 'a simple blue circle on white background', num_images: 1 },
      ctx,
    ) as any
    expect(result).toHaveProperty('data')
  }, 30000)
})
