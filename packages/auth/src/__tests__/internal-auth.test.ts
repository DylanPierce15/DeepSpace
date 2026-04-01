import { describe, it, expect, vi } from 'vitest'
import {
  signInternalPayload,
  verifyInternalSignature,
  computeHmacHex,
} from '../internalAuth.js'

const TEST_SECRET = 'test-hmac-secret-key-for-internal-auth'
const TEST_PAYLOAD = '{"action":"deploy","service":"api"}'

describe('signInternalPayload', () => {
  it('produces a timestamp and signature', async () => {
    const result = await signInternalPayload({
      secret: TEST_SECRET,
      payload: TEST_PAYLOAD,
    })

    expect(result.timestamp).toBeDefined()
    expect(result.signature).toBeDefined()
    expect(typeof result.timestamp).toBe('string')
    expect(typeof result.signature).toBe('string')
    // HMAC-SHA256 produces 64 hex characters
    expect(result.signature).toMatch(/^[0-9a-f]{64}$/)
    // timestamp should be a numeric string (milliseconds)
    expect(Number(result.timestamp)).toBeGreaterThan(0)
  })

  it('uses provided timestamp when given', async () => {
    const ts = '1700000000000'
    const result = await signInternalPayload({
      secret: TEST_SECRET,
      payload: TEST_PAYLOAD,
      timestamp: ts,
    })

    expect(result.timestamp).toBe(ts)
  })
})

describe('verifyInternalSignature', () => {
  it('returns true for a valid signature', async () => {
    const ts = Date.now().toString()
    const signature = await computeHmacHex(TEST_SECRET, `${ts}.${TEST_PAYLOAD}`)

    const valid = await verifyInternalSignature({
      secret: TEST_SECRET,
      timestamp: ts,
      signature,
      payload: TEST_PAYLOAD,
    })

    expect(valid).toBe(true)
  })

  it('returns false for wrong secret', async () => {
    const ts = Date.now().toString()
    const signature = await computeHmacHex(TEST_SECRET, `${ts}.${TEST_PAYLOAD}`)

    const valid = await verifyInternalSignature({
      secret: 'wrong-secret',
      timestamp: ts,
      signature,
      payload: TEST_PAYLOAD,
    })

    expect(valid).toBe(false)
  })

  it('returns false for tampered payload', async () => {
    const ts = Date.now().toString()
    const signature = await computeHmacHex(TEST_SECRET, `${ts}.${TEST_PAYLOAD}`)

    const valid = await verifyInternalSignature({
      secret: TEST_SECRET,
      timestamp: ts,
      signature,
      payload: '{"action":"destroy","service":"api"}',
    })

    expect(valid).toBe(false)
  })

  it('returns false for expired timestamp', async () => {
    // Use a timestamp from 10 minutes ago
    const oldTs = (Date.now() - 10 * 60_000).toString()
    const signature = await computeHmacHex(TEST_SECRET, `${oldTs}.${TEST_PAYLOAD}`)

    const valid = await verifyInternalSignature({
      secret: TEST_SECRET,
      timestamp: oldTs,
      signature,
      payload: TEST_PAYLOAD,
      maxSkewMs: 0,
    })

    expect(valid).toBe(false)
  })

  it('returns false for missing secret', async () => {
    const valid = await verifyInternalSignature({
      secret: undefined as unknown as string,
      timestamp: Date.now().toString(),
      signature: 'abc',
      payload: TEST_PAYLOAD,
    })

    expect(valid).toBe(false)
  })

  it('returns false for missing timestamp', async () => {
    const valid = await verifyInternalSignature({
      secret: TEST_SECRET,
      timestamp: null,
      signature: 'abc',
      payload: TEST_PAYLOAD,
    })

    expect(valid).toBe(false)
  })

  it('returns false for missing signature', async () => {
    const valid = await verifyInternalSignature({
      secret: TEST_SECRET,
      timestamp: Date.now().toString(),
      signature: null,
      payload: TEST_PAYLOAD,
    })

    expect(valid).toBe(false)
  })
})

describe('sign + verify round-trip', () => {
  it('sign then verify succeeds', async () => {
    const { timestamp, signature } = await signInternalPayload({
      secret: TEST_SECRET,
      payload: TEST_PAYLOAD,
    })

    const valid = await verifyInternalSignature({
      secret: TEST_SECRET,
      timestamp,
      signature,
      payload: TEST_PAYLOAD,
    })

    expect(valid).toBe(true)
  })

  it('sign then verify with different payload fails', async () => {
    const { timestamp, signature } = await signInternalPayload({
      secret: TEST_SECRET,
      payload: TEST_PAYLOAD,
    })

    const valid = await verifyInternalSignature({
      secret: TEST_SECRET,
      timestamp,
      signature,
      payload: 'tampered-payload',
    })

    expect(valid).toBe(false)
  })
})
