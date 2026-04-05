import { describe, it, expect } from 'vitest'
import { ctx, env, hasRealKey } from '../_test-helpers'
import { endpoints } from '.'

const skip =
  !hasRealKey('LIVEKIT_API_KEY') ||
  !hasRealKey('LIVEKIT_API_SECRET') ||
  !hasRealKey('LIVEKIT_URL')

describe('LiveKit', () => {
  // --------------------------------------------------------------------------
  // Billing config tests (always run)
  // --------------------------------------------------------------------------

  it('billing: exports exactly 4 endpoints', () => {
    const keys = Object.keys(endpoints)
    expect(keys).toHaveLength(4)
    expect(keys).toContain('livekit/generate-token')
    expect(keys).toContain('livekit/create-room')
    expect(keys).toContain('livekit/list-rooms')
    expect(keys).toContain('livekit/delete-room')
  })

  it('billing: generate-token is free', () => {
    const billing = endpoints['livekit/generate-token'].billing
    expect(billing.baseCost).toBe(0)
  })

  it('billing: create-room uses per_participant_minute at $0.01', () => {
    const billing = endpoints['livekit/create-room'].billing
    expect(billing.model).toBe('per_participant_minute')
    expect(billing.baseCost).toBe(0.01)
    expect(billing.currency).toBe('USD')
  })

  it('billing: list-rooms is free', () => {
    expect(endpoints['livekit/list-rooms'].billing.baseCost).toBe(0)
  })

  it('billing: delete-room is free', () => {
    expect(endpoints['livekit/delete-room'].billing.baseCost).toBe(0)
  })

  // --------------------------------------------------------------------------
  // Validation tests (no API key needed)
  // --------------------------------------------------------------------------

  it('generate-token: rejects missing LIVEKIT_API_KEY', async () => {
    await expect(
      endpoints['livekit/generate-token'].handler(
        { ...env, LIVEKIT_API_KEY: '', LIVEKIT_API_SECRET: 'x', LIVEKIT_URL: 'x' } as any,
        { roomName: 'test-room' },
        ctx,
      ),
    ).rejects.toThrow('LIVEKIT_API_KEY not configured')
  })

  it('generate-token: rejects missing roomName', async () => {
    await expect(
      endpoints['livekit/generate-token'].handler(
        { ...env, LIVEKIT_API_KEY: 'key', LIVEKIT_API_SECRET: 'secret', LIVEKIT_URL: 'https://lk.example.com' } as any,
        {},
        ctx,
      ),
    ).rejects.toThrow('roomName is required')
  })

  it('create-room: rejects missing roomName', async () => {
    await expect(
      endpoints['livekit/create-room'].handler(
        { ...env, LIVEKIT_API_KEY: 'key', LIVEKIT_API_SECRET: 'secret', LIVEKIT_URL: 'https://lk.example.com' } as any,
        {},
        ctx,
      ),
    ).rejects.toThrow('roomName is required')
  })

  it('delete-room: rejects missing roomName', async () => {
    await expect(
      endpoints['livekit/delete-room'].handler(
        { ...env, LIVEKIT_API_KEY: 'key', LIVEKIT_API_SECRET: 'secret', LIVEKIT_URL: 'https://lk.example.com' } as any,
        {},
        ctx,
      ),
    ).rejects.toThrow('roomName is required')
  })

  // --------------------------------------------------------------------------
  // Token generation test (works offline -- only uses Web Crypto)
  // --------------------------------------------------------------------------

  it('generate-token: produces a valid JWT string', async () => {
    const result = (await endpoints['livekit/generate-token'].handler(
      { ...env, LIVEKIT_API_KEY: 'devkey', LIVEKIT_API_SECRET: 'devsecret123456', LIVEKIT_URL: 'wss://lk.example.com' } as any,
      { roomName: 'test-room', displayName: 'Alice' },
      ctx,
    )) as any

    expect(result.token).toBeDefined()
    expect(typeof result.token).toBe('string')
    // JWT has 3 dot-separated parts
    expect(result.token.split('.').length).toBe(3)
    expect(result.url).toBe('wss://lk.example.com')
    expect(result.roomName).toBe('test-room')
  })

  // --------------------------------------------------------------------------
  // Live API tests (only with real keys)
  // --------------------------------------------------------------------------

  it.skipIf(skip)('list-rooms: returns room list', async () => {
    const result = (await endpoints['livekit/list-rooms'].handler(
      env as any,
      {},
      ctx,
    )) as any
    expect(Array.isArray(result.rooms)).toBe(true)
  }, 15000)
})
