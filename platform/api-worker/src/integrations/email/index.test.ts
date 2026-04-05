import { describe, it, expect } from 'vitest'
import { ctx, env, hasRealKey } from '../_test-helpers'
import { endpoints } from '.'

const skip = !hasRealKey('RESEND_API_KEY')

describe('Email (Resend)', () => {
  // Billing verification tests — always run
  it('billing: send costs $0.01 per request', () => {
    expect(endpoints['email/send'].billing.baseCost).toBe(0.01)
    expect(endpoints['email/send'].billing.currency).toBe('USD')
    expect(endpoints['email/send'].billing.model).toBe('per_request')
  })

  it('billing: handler is defined', () => {
    expect(typeof endpoints['email/send'].handler).toBe('function')
  })

  // API tests — require a real key
  it.skipIf(skip)('sends an email', async () => {
    const result = await endpoints['email/send'].handler(
      env as any,
      {
        from: 'test@updates.app.space',
        to: 'delivered@resend.dev',
        subject: 'DeepSpace integration test',
        text: 'This is a test email from the DeepSpace API worker integration tests.',
      },
      ctx,
    ) as any
    expect(result).toHaveProperty('id')
    expect(typeof result.id).toBe('string')
  }, 30000)
})
