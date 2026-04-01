/**
 * Binary message multiplexing helpers for GatewaySession.
 *
 * Encodes/decodes a UTF-8 scope ID prefix on binary (Yjs) WebSocket
 * messages using a varint length header:
 *
 *   [varint scopeLen] [UTF-8 scope bytes] [original payload]
 *
 * Varint encoding uses the standard LEB128 scheme (7 bits per byte,
 * high bit = continuation).
 */

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function encodeVarint(value: number): Uint8Array {
  const bytes: number[] = []
  let v = value
  while (v > 0x7f) {
    bytes.push((v & 0x7f) | 0x80)
    v >>>= 7
  }
  bytes.push(v & 0x7f)
  return new Uint8Array(bytes)
}

function decodeVarint(data: Uint8Array): [value: number, bytesRead: number] {
  let value = 0
  let shift = 0
  let i = 0
  while (i < data.length) {
    const byte = data[i]
    value |= (byte & 0x7f) << shift
    i++
    if ((byte & 0x80) === 0) break
    shift += 7
  }
  return [value, i]
}

/**
 * Prefix a binary payload with a varint-length-prefixed UTF-8 scope ID.
 */
export function prefixBinaryWithScope(scopeId: string, payload: ArrayBuffer): ArrayBuffer {
  const scopeBytes = encoder.encode(scopeId)
  const varint = encodeVarint(scopeBytes.length)
  const result = new Uint8Array(varint.length + scopeBytes.length + payload.byteLength)
  result.set(varint, 0)
  result.set(scopeBytes, varint.length)
  result.set(new Uint8Array(payload), varint.length + scopeBytes.length)
  return result.buffer
}

/**
 * Strip the varint-length-prefixed scope ID from a binary message,
 * returning [scopeId, innerPayload].
 */
export function stripBinaryScopePrefix(data: ArrayBuffer): [scopeId: string, inner: ArrayBuffer] {
  const bytes = new Uint8Array(data)
  const [scopeLen, varintBytes] = decodeVarint(bytes)
  const scopeStart = varintBytes
  const scopeEnd = scopeStart + scopeLen
  const scopeId = decoder.decode(bytes.slice(scopeStart, scopeEnd))
  const inner = data.slice(scopeEnd)
  return [scopeId, inner]
}
