import { describe, it, expect } from 'vitest'
import { ctx, env, hasRealKey } from '../_test-helpers'
import { endpoints } from '.'

const skip = !hasRealKey('GEMINI_API_KEY')

describe('Gemini', () => {
  // Billing verification tests — always run
  it('billing: generate-image uses per_token model', () => {
    expect(endpoints['gemini/generate-image'].billing.model).toBe('per_token')
    expect(endpoints['gemini/generate-image'].billing.baseCost).toBe(0)
    expect(endpoints['gemini/generate-image'].billing.currency).toBe('USD')
  })

  it('billing: handler is defined', () => {
    expect(typeof endpoints['gemini/generate-image'].handler).toBe('function')
  })

  // API tests — require a real key
  it.skipIf(skip)('generates an image from prompt', async () => {
    const result = await endpoints['gemini/generate-image'].handler(
      env as any,
      { prompt: 'A small red cube on a white background' },
      ctx,
    ) as any
    expect(result).toHaveProperty('base64Images')
    expect(Array.isArray(result.base64Images)).toBe(true)
    expect(result).toHaveProperty('usage')
    expect(result.usage).toHaveProperty('totalTokens')
  }, 60000)
})
