import { describe, it, expect } from 'vitest'
import { ctx, env, hasRealKey } from '../_test-helpers'
import { endpoints } from '.'

const skip = !hasRealKey('OPENAI_API_KEY')

describe('Speech', () => {
  // --------------------------------------------------------------------------
  // Billing config tests (always run)
  // --------------------------------------------------------------------------

  it('billing: exports exactly 2 endpoints', () => {
    const keys = Object.keys(endpoints)
    expect(keys).toHaveLength(2)
    expect(keys).toContain('speech/text-to-speech')
    expect(keys).toContain('speech/speech-to-text')
  })

  it('billing: TTS uses per_token model at $0.015 base', () => {
    const tts = endpoints['speech/text-to-speech'].billing
    expect(tts.model).toBe('per_token')
    expect(tts.baseCost).toBe(0.015)
    expect(tts.currency).toBe('USD')
  })

  it('billing: TTS has model multipliers', () => {
    const tts = endpoints['speech/text-to-speech'].billing
    expect(tts.costModifiers?.baseMultipliers?.model).toBeDefined()
    expect(tts.costModifiers?.baseMultipliers?.model?.['tts-1']).toBe(1.0)
    expect(tts.costModifiers?.baseMultipliers?.model?.['tts-1-hd']).toBe(2.0)
  })

  it('billing: TTS has unit calculation for characters', () => {
    const tts = endpoints['speech/text-to-speech'].billing
    expect(tts.costModifiers?.unitCalculation?.formula).toBe('characters / 1000')
    expect(tts.costModifiers?.unitCalculation?.minUnits).toBe(1)
    expect(tts.costModifiers?.unitCalculation?.roundUp).toBe(true)
  })

  it('billing: STT uses per_request model at $0.006 base', () => {
    const stt = endpoints['speech/speech-to-text'].billing
    expect(stt.model).toBe('per_request')
    expect(stt.baseCost).toBe(0.006)
    expect(stt.currency).toBe('USD')
  })

  it('billing: STT has model multipliers', () => {
    const stt = endpoints['speech/speech-to-text'].billing
    expect(stt.costModifiers?.baseMultipliers?.model).toBeDefined()
    expect(stt.costModifiers?.baseMultipliers?.model?.['whisper-1']).toBe(1.0)
    expect(stt.costModifiers?.baseMultipliers?.model?.['gpt-4o-transcribe']).toBe(1.5)
  })

  // --------------------------------------------------------------------------
  // Validation tests (no API key needed)
  // --------------------------------------------------------------------------

  it('TTS: rejects empty input', async () => {
    await expect(
      endpoints['speech/text-to-speech'].handler(
        { ...env, OPENAI_API_KEY: 'test-key' } as any,
        { input: '' },
        ctx,
      ),
    ).rejects.toThrow('input text is required')
  })

  it('TTS: rejects invalid model', async () => {
    await expect(
      endpoints['speech/text-to-speech'].handler(
        { ...env, OPENAI_API_KEY: 'test-key' } as any,
        { input: 'hello', model: 'bad-model' },
        ctx,
      ),
    ).rejects.toThrow('model must be one of')
  })

  it('TTS: rejects invalid voice', async () => {
    await expect(
      endpoints['speech/text-to-speech'].handler(
        { ...env, OPENAI_API_KEY: 'test-key' } as any,
        { input: 'hello', voice: 'bad-voice' },
        ctx,
      ),
    ).rejects.toThrow('voice must be one of')
  })

  it('TTS: rejects speed out of range', async () => {
    await expect(
      endpoints['speech/text-to-speech'].handler(
        { ...env, OPENAI_API_KEY: 'test-key' } as any,
        { input: 'hello', speed: 5.0 },
        ctx,
      ),
    ).rejects.toThrow('speed must be between')
  })

  it('STT: rejects missing audio', async () => {
    await expect(
      endpoints['speech/speech-to-text'].handler(
        { ...env, OPENAI_API_KEY: 'test-key' } as any,
        {},
        ctx,
      ),
    ).rejects.toThrow('audio (base64-encoded) is required')
  })

  it('STT: rejects invalid model', async () => {
    await expect(
      endpoints['speech/speech-to-text'].handler(
        { ...env, OPENAI_API_KEY: 'test-key' } as any,
        { audio: 'dGVzdA==', model: 'bad-model' },
        ctx,
      ),
    ).rejects.toThrow('model must be one of')
  })

  it('STT: rejects non-json format for gpt-4o-transcribe', async () => {
    await expect(
      endpoints['speech/speech-to-text'].handler(
        { ...env, OPENAI_API_KEY: 'test-key' } as any,
        { audio: 'dGVzdA==', model: 'gpt-4o-transcribe', response_format: 'srt' },
        ctx,
      ),
    ).rejects.toThrow('only support json response format')
  })

  // --------------------------------------------------------------------------
  // Live API tests (only with real key)
  // --------------------------------------------------------------------------

  it.skipIf(skip)('TTS: generates speech audio', async () => {
    const result = await endpoints['speech/text-to-speech'].handler(env as any, {
      input: 'Hello, this is a test.',
      model: 'tts-1',
      voice: 'alloy',
    }, ctx) as any
    expect(result.audioUrl).toMatch(/^data:audio\/mp3;base64,/)
    expect(result.model).toBe('tts-1')
    expect(result.voice).toBe('alloy')
  }, 30000)

  it.skipIf(skip)('STT: transcribes audio', async () => {
    // First generate some audio to transcribe
    const ttsResult = await endpoints['speech/text-to-speech'].handler(env as any, {
      input: 'Hello world',
      model: 'tts-1',
      voice: 'alloy',
      response_format: 'mp3',
    }, ctx) as any

    const audioBase64 = ttsResult.audioUrl.replace(/^data:audio\/[^;]+;base64,/, '')

    const result = await endpoints['speech/speech-to-text'].handler(env as any, {
      audio: audioBase64,
      model: 'whisper-1',
    }, ctx) as any
    expect(typeof result.text).toBe('string')
    expect(result.text.length).toBeGreaterThan(0)
  }, 30000)
})
