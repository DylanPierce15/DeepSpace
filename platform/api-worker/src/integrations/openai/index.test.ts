import { describe, it, expect } from 'vitest'
import { ctx, env, hasRealKey } from '../_test-helpers'
import { endpoints } from '.'

const skip = !hasRealKey('OPENAI_API_KEY')

describe('OpenAI', () => {
  // --------------------------------------------------------------------------
  // Billing config tests (always run)
  // --------------------------------------------------------------------------

  it('billing: exports chat-completion and generate-image', () => {
    const keys = Object.keys(endpoints)
    expect(keys).toContain('openai/chat-completion')
    expect(keys).toContain('openai/generate-image')
  })

  it('billing: chat-completion uses per_token model', () => {
    const billing = endpoints['openai/chat-completion'].billing
    expect(billing.model).toBe('per_token')
    expect(billing.baseCost).toBe(0.00003)
    expect(billing.currency).toBe('USD')
  })

  it('billing: generate-image uses per_token with model multipliers', () => {
    const billing = endpoints['openai/generate-image'].billing
    expect(billing.model).toBe('per_token')
    expect(billing.baseCost).toBe(0)
    expect(billing.costModifiers?.baseMultipliers?.model?.['gpt-image-1']).toBe(1.25)
    expect(billing.costModifiers?.baseMultipliers?.model?.['gpt-image-1-mini']).toBe(0.3125)
  })

  // --------------------------------------------------------------------------
  // Validation tests (no API key needed)
  // --------------------------------------------------------------------------

  it('generate-image: rejects missing prompt', async () => {
    await expect(
      endpoints['openai/generate-image'].handler(
        { ...env, OPENAI_API_KEY: 'test-key' } as any,
        {},
        ctx,
      ),
    ).rejects.toThrow('prompt is required')
  })

  it('generate-image: rejects invalid model', async () => {
    await expect(
      endpoints['openai/generate-image'].handler(
        { ...env, OPENAI_API_KEY: 'test-key' } as any,
        { prompt: 'test', model: 'bad-model' },
        ctx,
      ),
    ).rejects.toThrow('model must be one of')
  })

  it('generate-image: rejects invalid size', async () => {
    await expect(
      endpoints['openai/generate-image'].handler(
        { ...env, OPENAI_API_KEY: 'test-key' } as any,
        { prompt: 'test', size: '256x256' },
        ctx,
      ),
    ).rejects.toThrow('size must be one of')
  })

  it('generate-image: rejects invalid quality', async () => {
    await expect(
      endpoints['openai/generate-image'].handler(
        { ...env, OPENAI_API_KEY: 'test-key' } as any,
        { prompt: 'test', quality: 'ultra' },
        ctx,
      ),
    ).rejects.toThrow('quality must be one of')
  })

  it('chat-completion: rejects when API key is missing', async () => {
    await expect(
      endpoints['openai/chat-completion'].handler(
        { ...env, OPENAI_API_KEY: '' } as any,
        { messages: [{ role: 'user', content: 'hi' }] },
        ctx,
      ),
    ).rejects.toThrow('OPENAI_API_KEY not configured')
  })

  // --------------------------------------------------------------------------
  // Live API tests (only with real key)
  // --------------------------------------------------------------------------

  it.skipIf(skip)('chat-completion returns a response', async () => {
    const result = await endpoints['openai/chat-completion'].handler(
      env as any,
      {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Reply with exactly: hello' }],
        max_tokens: 10,
      },
      ctx,
    ) as any
    expect(result.choices).toBeDefined()
    expect(result.choices.length).toBeGreaterThan(0)
    expect(result.choices[0].message.content).toBeDefined()
  }, 30000)

  it.skipIf(skip)('generate-image returns image data', async () => {
    const result = await endpoints['openai/generate-image'].handler(
      env as any,
      {
        prompt: 'A simple red circle on a white background',
        model: 'gpt-image-1-mini',
        size: '1024x1024',
        quality: 'low',
        n: 1,
      },
      ctx,
    ) as any
    expect(Array.isArray(result.images)).toBe(true)
    expect(result.images.length).toBe(1)
    expect(result.usage).toBeDefined()
  }, 60000)
})
