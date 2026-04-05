import { describe, it, expect } from 'vitest'
import { ctx, env, hasRealKey } from '../_test-helpers'
import { endpoints } from '.'

const skip = !hasRealKey('RESEND_API_KEY')

describe('Email (Resend)', () => {
  // --------------------------------------------------------------------------
  // Billing config tests (always run)
  // --------------------------------------------------------------------------

  it('billing: exports exactly 1 endpoint', () => {
    const keys = Object.keys(endpoints)
    expect(keys).toHaveLength(1)
    expect(keys).toContain('email/send')
  })

  it('billing: send costs $0.01 per request', () => {
    expect(endpoints['email/send'].billing.baseCost).toBe(0.01)
    expect(endpoints['email/send'].billing.currency).toBe('USD')
    expect(endpoints['email/send'].billing.model).toBe('per_request')
  })

  // --------------------------------------------------------------------------
  // Validation tests (no API key needed)
  // --------------------------------------------------------------------------

  it('send: rejects missing RESEND_API_KEY', async () => {
    await expect(
      endpoints['email/send'].handler(
        { ...env, RESEND_API_KEY: '' } as any,
        { from: 'a@b.com', to: 'c@d.com', subject: 'test', text: 'hi' },
        ctx,
      ),
    ).rejects.toThrow('RESEND_API_KEY not configured')
  })

  it('send: rejects missing from', async () => {
    await expect(
      endpoints['email/send'].handler(
        { ...env, RESEND_API_KEY: 'test-key' } as any,
        { to: 'c@d.com', subject: 'test', text: 'hi' },
        ctx,
      ),
    ).rejects.toThrow('from is required')
  })

  it('send: rejects missing to', async () => {
    await expect(
      endpoints['email/send'].handler(
        { ...env, RESEND_API_KEY: 'test-key' } as any,
        { from: 'a@b.com', subject: 'test', text: 'hi' },
        ctx,
      ),
    ).rejects.toThrow('to is required')
  })

  it('send: rejects missing subject', async () => {
    await expect(
      endpoints['email/send'].handler(
        { ...env, RESEND_API_KEY: 'test-key' } as any,
        { from: 'a@b.com', to: 'c@d.com', text: 'hi' },
        ctx,
      ),
    ).rejects.toThrow('subject is required')
  })

  it('send: rejects missing html and text content', async () => {
    await expect(
      endpoints['email/send'].handler(
        { ...env, RESEND_API_KEY: 'test-key' } as any,
        { from: 'a@b.com', to: 'c@d.com', subject: 'test' },
        ctx,
      ),
    ).rejects.toThrow('html or text content is required')
  })

  // --------------------------------------------------------------------------
  // Live API tests (require a real key)
  // --------------------------------------------------------------------------

  it.skipIf(skip)('sends an email to Resend test address', async () => {
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
