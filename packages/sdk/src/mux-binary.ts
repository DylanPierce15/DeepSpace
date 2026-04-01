/**
 * Binary encoding helpers for WebSocket multiplexing.
 *
 * Scope-prefixed binary messages use a varint-length-prefixed UTF-8 string
 * as a header before the original payload. This allows the gateway to route
 * Yjs sync/awareness messages without parsing the inner binary content.
 *
 * Wire format: [varint: scopeId byte length] [UTF-8 scopeId bytes] [payload]
 *
 * Shared between MultiplexProvider (client) and GatewaySession (worker).
 */

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function writeVarUint(arr: number[], num: number): void {
  while (num > 0x7f) {
    arr.push((num & 0x7f) | 0x80)
    num = Math.floor(num / 128)
  }
  arr.push(num & 0x7f)
}

function readVarUint(data: Uint8Array, pos: number): [value: number, newPos: number] {
  let num = 0
  let mult = 1
  while (pos < data.length) {
    const byte = data[pos++]
    num += (byte & 0x7f) * mult
    mult *= 128
    if (byte < 0x80) return [num, pos]
  }
  throw new Error('Unexpected end of varint')
}

/** Prefix a binary payload with a varint-length-prefixed scope ID. */
export function prefixBinaryWithScope(scopeId: string, payload: Uint8Array | ArrayBuffer): Uint8Array {
  const scopeBytes = encoder.encode(scopeId)
  const header: number[] = []
  writeVarUint(header, scopeBytes.length)
  const result = new Uint8Array(header.length + scopeBytes.length + (payload instanceof ArrayBuffer ? payload.byteLength : payload.length))
  result.set(header, 0)
  result.set(scopeBytes, header.length)
  result.set(payload instanceof ArrayBuffer ? new Uint8Array(payload) : payload, header.length + scopeBytes.length)
  return result
}

/** Strip scope prefix from binary payload. Returns [scopeId, innerPayload]. */
export function stripBinaryScopePrefix(data: ArrayBuffer): [scopeId: string, inner: Uint8Array] {
  const view = new Uint8Array(data)
  const [len, afterLen] = readVarUint(view, 0)
  const scopeId = decoder.decode(view.subarray(afterLen, afterLen + len))
  const inner = view.subarray(afterLen + len)
  return [scopeId, inner]
}
