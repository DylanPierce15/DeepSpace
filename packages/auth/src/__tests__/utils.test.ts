import { describe, it, expect } from 'vitest'
import { decodeJwtPayload, normalizeArray, bufferToHex } from '../utils.js'

/**
 * Helper to build a minimal JWT string (header.payload.signature)
 * with an arbitrary payload object, without any real cryptographic signing.
 */
function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'ES256', typ: 'JWT' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  const sig = 'fakesignature'
  return `${header}.${body}.${sig}`
}

describe('decodeJwtPayload', () => {
  it('extracts payload from a JWT string', () => {
    const token = fakeJwt({
      iss: 'https://auth.deep.space',
      aud: 'https://api.deep.space',
      azp: 'https://myapp.app.space',
      exp: 1700000000,
      iat: 1699996400,
    })

    const result = decodeJwtPayload(token)

    expect(result).toEqual({
      iss: 'https://auth.deep.space',
      aud: 'https://api.deep.space',
      azp: 'https://myapp.app.space',
      exp: 1700000000,
      iat: 1699996400,
    })
  })

  it('returns null fields for missing claims', () => {
    const token = fakeJwt({ sub: 'user_123' })
    const result = decodeJwtPayload(token)

    expect(result).toEqual({
      iss: null,
      aud: null,
      azp: null,
      exp: null,
      iat: null,
    })
  })

  it('returns undefined for null input', () => {
    expect(decodeJwtPayload(null)).toBeUndefined()
  })

  it('returns undefined for undefined input', () => {
    expect(decodeJwtPayload(undefined)).toBeUndefined()
  })

  it('returns undefined for empty string', () => {
    expect(decodeJwtPayload('')).toBeUndefined()
  })

  it('returns undefined for malformed token (no dots)', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeUndefined()
  })

  it('returns undefined for token with invalid base64 payload', () => {
    expect(decodeJwtPayload('header.!!!invalid!!!.signature')).toBeUndefined()
  })
})

describe('normalizeArray', () => {
  it('returns undefined for null', () => {
    expect(normalizeArray(null)).toBeUndefined()
  })

  it('returns undefined for undefined', () => {
    expect(normalizeArray(undefined)).toBeUndefined()
  })

  it('wraps a single string in an array', () => {
    expect(normalizeArray('hello')).toEqual(['hello'])
  })

  it('wraps a single number in an array', () => {
    expect(normalizeArray(42)).toEqual([42])
  })

  it('returns the array as-is when non-empty', () => {
    expect(normalizeArray(['a', 'b'])).toEqual(['a', 'b'])
  })

  it('returns undefined for an empty array', () => {
    expect(normalizeArray([])).toBeUndefined()
  })
})

describe('bufferToHex', () => {
  it('converts ArrayBuffer to hex string', () => {
    const buffer = new Uint8Array([0x00, 0x0f, 0xff, 0xab]).buffer
    expect(bufferToHex(buffer)).toBe('000fffab')
  })

  it('converts Uint8Array to hex string', () => {
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
    expect(bufferToHex(bytes)).toBe('deadbeef')
  })

  it('returns empty string for empty buffer', () => {
    expect(bufferToHex(new Uint8Array([]))).toBe('')
  })
})
