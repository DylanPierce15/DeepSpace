/**
 * HMAC-based internal authentication for service-to-service calls.
 *
 * Ported as-is from Miyagi3 — this is auth-provider-agnostic.
 */

import { bufferToHex, nowMs } from './utils.js'
import type { InternalSignature, SignInternalPayloadInput, VerifyInternalSignatureInput } from './types.js'

const DEFAULT_MAX_SKEW_MS = 5 * 60_000

let nodeCryptoPromise: Promise<typeof import('node:crypto') | null> | null = null

async function loadNodeCrypto(): Promise<typeof import('node:crypto') | null> {
  if (!nodeCryptoPromise) {
    nodeCryptoPromise = import('node:crypto')
      .then((module) => module)
      .catch(() => null)
  }
  return nodeCryptoPromise
}

function hasSubtleCrypto(): boolean {
  return typeof globalThis.crypto?.subtle?.importKey === 'function'
}

export async function computeHmacHex(secret: string, payload: string): Promise<string> {
  if (hasSubtleCrypto()) {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
    return bufferToHex(signature)
  }

  const nodeCrypto = await loadNodeCrypto()
  if (!nodeCrypto) {
    throw new Error('Crypto implementation unavailable for HMAC computation')
  }
  return nodeCrypto.createHmac('sha256', secret).update(payload).digest('hex')
}

export async function timingSafeEqualHex(a: string, b: string): Promise<boolean> {
  if (a.length !== b.length) {
    return false
  }

  const nodeCrypto = await loadNodeCrypto()
  if (nodeCrypto?.timingSafeEqual) {
    const aBuf = Buffer.from(a, 'hex')
    const bBuf = Buffer.from(b, 'hex')
    try {
      return nodeCrypto.timingSafeEqual(aBuf, bBuf)
    } catch {
      return false
    }
  }

  let diff = 0
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export async function signInternalPayload({
  secret,
  payload,
  timestamp,
}: SignInternalPayloadInput): Promise<InternalSignature> {
  const ts = timestamp ?? nowMs().toString()
  const signature = await computeHmacHex(secret, `${ts}.${payload}`)
  return { timestamp: ts, signature }
}

export async function verifyInternalSignature({
  secret,
  timestamp,
  signature,
  payload,
  maxSkewMs = DEFAULT_MAX_SKEW_MS,
}: VerifyInternalSignatureInput): Promise<boolean> {
  if (!secret || !timestamp || !signature) {
    return false
  }

  const tsNumber = Number(timestamp)
  if (!Number.isFinite(tsNumber)) {
    return false
  }

  const skew = Math.abs(nowMs() - tsNumber)
  if (skew > maxSkewMs) {
    return false
  }

  const expected = await computeHmacHex(secret, `${timestamp}.${payload}`)
  return timingSafeEqualHex(signature.toLowerCase(), expected.toLowerCase())
}

export function buildInternalPayload(body: unknown): string {
  if (body === undefined) return '{}'
  if (typeof body === 'string') return body
  try {
    return JSON.stringify(body)
  } catch {
    return '{}'
  }
}

export { DEFAULT_MAX_SKEW_MS }
