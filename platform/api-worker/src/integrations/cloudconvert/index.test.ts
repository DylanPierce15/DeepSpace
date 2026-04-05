import { describe, it, expect } from 'vitest'
import { ctx, env, hasRealKey } from '../_test-helpers'
import { endpoints } from '.'

const skip = !hasRealKey('CLOUDCONVERT_API_KEY')

describe('CloudConvert', () => {
  // Billing verification tests — always run
  it('billing: convert-file costs $0.018', () => {
    expect(endpoints['cloudconvert/convert-file'].billing.baseCost).toBe(0.018)
    expect(endpoints['cloudconvert/convert-file'].billing.currency).toBe('USD')
    expect(endpoints['cloudconvert/convert-file'].billing.model).toBe('per_request')
  })

  it('billing: handler is defined', () => {
    expect(typeof endpoints['cloudconvert/convert-file'].handler).toBe('function')
  })

  // API tests — require a real key
  it.skipIf(skip)('converts a small text file from txt to pdf', async () => {
    // Base64 of "Hello, World!"
    const base64Content = btoa('Hello, World!')
    const result = await endpoints['cloudconvert/convert-file'].handler(
      env as any,
      {
        input_format: 'txt',
        output_format: 'pdf',
        file: base64Content,
      },
      ctx,
    ) as any
    expect(result).toHaveProperty('jobId')
    expect(result).toHaveProperty('downloadUrl')
    expect(typeof result.downloadUrl).toBe('string')
  }, 60000)
})
