/**
 * Binary Protocol for Yjs sync
 * 
 * Inline encoder/decoder implementation matching src/lib/yjs-protocol.ts
 * Used for WebSocket communication between clients and the Durable Object.
 */

// Message types
export const MSG_SYNC = 0
export const MSG_AWARENESS = 1

export const MSG_SYNC_STEP1 = 0
export const MSG_SYNC_STEP2 = 1
export const MSG_SYNC_UPDATE = 2

// ============================================================================
// Encoder
// ============================================================================

export interface Encoder {
  data: number[]
}

export function createEncoder(): Encoder {
  return { data: [] }
}

export function toUint8Array(encoder: Encoder): Uint8Array {
  return new Uint8Array(encoder.data)
}

export function writeVarUint(encoder: Encoder, num: number): void {
  while (num > 0x7f) {
    encoder.data.push((num & 0x7f) | 0x80)
    num = Math.floor(num / 128)
  }
  encoder.data.push(num & 0x7f)
}

export function writeVarUint8Array(encoder: Encoder, arr: Uint8Array): void {
  writeVarUint(encoder, arr.length)
  for (let i = 0; i < arr.length; i++) {
    encoder.data.push(arr[i])
  }
}

// ============================================================================
// Decoder
// ============================================================================

export interface Decoder {
  data: Uint8Array
  pos: number
}

export function createDecoder(data: Uint8Array): Decoder {
  return { data, pos: 0 }
}

export function readVarUint(decoder: Decoder): number {
  let num = 0
  let mult = 1
  const len = decoder.data.length
  while (decoder.pos < len) {
    const byte = decoder.data[decoder.pos++]
    num += (byte & 0x7f) * mult
    mult *= 128
    if (byte < 0x80) return num
  }
  throw new Error('Unexpected end of buffer')
}

export function readVarUint8Array(decoder: Decoder): Uint8Array {
  const len = readVarUint(decoder)
  const arr = decoder.data.subarray(decoder.pos, decoder.pos + len)
  decoder.pos += len
  return arr
}

