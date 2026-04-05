import { describe, it, expect } from 'vitest'
import { ctx, env, hasRealKey } from '../_test-helpers'
import { endpoints } from '.'

describe('Anthropic', () => {
  it.skipIf(!hasRealKey('ANTHROPIC_API_KEY'))('chat completion returns a response', async () => {
    const result = await endpoints['anthropic/chat-completion'].handler(env as any, {
      messages: [{ role: 'user', content: 'Say "hello" and nothing else.' }],
      max_tokens: 10,
    }, ctx) as any
    expect(result).toHaveProperty('content')
    expect(result.content.length).toBeGreaterThan(0)
  }, 30000)

  it('billing: per_token model', () => {
    expect(endpoints['anthropic/chat-completion'].billing.model).toBe('per_token')
  })
})
