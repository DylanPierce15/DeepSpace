import { describe, it, expect } from 'vitest'
import { ctx, env, hasRealKey } from '../_test-helpers'
import { endpoints } from '.'

const skip = !hasRealKey('CLOUDCONVERT_API_KEY')

describe('CloudConvert', () => {
  // --------------------------------------------------------------------------
  // Billing config tests (always run)
  // --------------------------------------------------------------------------

  it('billing: exports exactly 1 endpoint', () => {
    const keys = Object.keys(endpoints)
    expect(keys).toHaveLength(1)
    expect(keys).toContain('cloudconvert/convert-file')
  })

  it('billing: convert-file costs $0.018', () => {
    expect(endpoints['cloudconvert/convert-file'].billing.baseCost).toBe(0.018)
    expect(endpoints['cloudconvert/convert-file'].billing.currency).toBe('USD')
    expect(endpoints['cloudconvert/convert-file'].billing.model).toBe('per_request')
  })

  // --------------------------------------------------------------------------
  // Validation tests (no API key needed)
  // --------------------------------------------------------------------------

  it('convert-file: rejects missing CLOUDCONVERT_API_KEY', async () => {
    await expect(
      endpoints['cloudconvert/convert-file'].handler(
        { ...env, CLOUDCONVERT_API_KEY: '' } as any,
        { input_format: 'txt', output_format: 'pdf', file: 'dGVzdA==' },
        ctx,
      ),
    ).rejects.toThrow('CLOUDCONVERT_API_KEY not configured')
  })

  it('convert-file: rejects missing input_format and output_format', async () => {
    await expect(
      endpoints['cloudconvert/convert-file'].handler(
        { ...env, CLOUDCONVERT_API_KEY: 'test-key' } as any,
        { file: 'dGVzdA==' },
        ctx,
      ),
    ).rejects.toThrow('input_format and output_format are required')
  })

  it('convert-file: rejects when neither file nor url is provided', async () => {
    await expect(
      endpoints['cloudconvert/convert-file'].handler(
        { ...env, CLOUDCONVERT_API_KEY: 'test-key' } as any,
        { input_format: 'txt', output_format: 'pdf' },
        ctx,
      ),
    ).rejects.toThrow('Either file (base64) or url must be provided')
  })

  // --------------------------------------------------------------------------
  // Live API tests (require a real key — costs money, use sparingly)
  // --------------------------------------------------------------------------

  it.skipIf(skip)('converts a small text file from txt to pdf', async () => {
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
