/**
 * LiveKit integration -- video/audio room management.
 * Ported from Miyagi3 LiveKitIntegrationService.ts.
 *
 * LiveKit requires signed JWT access tokens. In Cloudflare Workers we use the
 * Web Crypto API (HMAC SHA-256) to produce them -- no Node.js SDK needed.
 *
 * Env vars: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL
 *
 * Endpoints:
 * - generate-token:   Free. Produces a participant access token for any room.
 * - create-room:      Billable. Creates a room via LiveKit Twirp API.
 * - list-rooms:       Free. Lists active rooms.
 * - delete-room:      Free. Deletes a room by name.
 */

import type { IntegrationHandler, EndpointDefinition } from '../_types'

// ============================================================================
// JWT helpers -- Web Crypto HMAC-SHA256 (HS256)
// ============================================================================

function base64UrlEncode(data: Uint8Array): string {
  const binStr = String.fromCharCode(...data)
  return btoa(binStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function textToUint8Array(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

/**
 * Sign a LiveKit access token using HS256 via Web Crypto.
 * LiveKit server-sdk uses HS256 (HMAC-SHA256) for access tokens.
 */
async function signLiveKitToken(
  apiKey: string,
  apiSecret: string,
  grants: Record<string, unknown>,
  options: {
    identity: string
    name?: string
    ttlSeconds?: number
    metadata?: string
  },
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const ttl = options.ttlSeconds || 3600

  const payload: Record<string, unknown> = {
    iss: apiKey,
    sub: options.identity,
    iat: now,
    nbf: now,
    exp: now + ttl,
    jti: options.identity + '-' + now,
    video: grants,
  }

  if (options.name) payload.name = options.name
  if (options.metadata) payload.metadata = options.metadata

  const header = { alg: 'HS256', typ: 'JWT' }

  const headerB64 = base64UrlEncode(textToUint8Array(JSON.stringify(header)))
  const payloadB64 = base64UrlEncode(textToUint8Array(JSON.stringify(payload)))

  const signingInput = `${headerB64}.${payloadB64}`

  const key = await crypto.subtle.importKey(
    'raw',
    textToUint8Array(apiSecret) as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    textToUint8Array(signingInput) as BufferSource,
  )

  const signatureB64 = base64UrlEncode(new Uint8Array(signature))

  return `${signingInput}.${signatureB64}`
}

/**
 * Call the LiveKit Twirp RPC API.
 * LiveKit uses Twirp (protobuf-over-HTTP) for server APIs.
 * We use the JSON variant: POST with Content-Type application/json.
 */
async function livekitTwirp(
  livekitUrl: string,
  apiKey: string,
  apiSecret: string,
  service: string,
  method: string,
  body: Record<string, unknown>,
): Promise<any> {
  // Generate a short-lived admin token for the API call
  const token = await signLiveKitToken(apiKey, apiSecret, {
    roomCreate: true,
    roomList: true,
    roomAdmin: true,
  }, {
    identity: 'deepspace-api-worker',
    ttlSeconds: 60,
  })

  const url = `${livekitUrl}/twirp/livekit.${service}/${method}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`LiveKit API error ${response.status}: ${errorText}`)
  }

  return response.json()
}

// ============================================================================
// generate-token (free)
// ============================================================================

const generateToken: IntegrationHandler = async (env, body, context) => {
  if (!env.LIVEKIT_API_KEY) throw new Error('LIVEKIT_API_KEY not configured')
  if (!env.LIVEKIT_API_SECRET) throw new Error('LIVEKIT_API_SECRET not configured')
  if (!env.LIVEKIT_URL) throw new Error('LIVEKIT_URL not configured')

  const roomName = body.roomName as string
  if (!roomName) throw new Error('roomName is required')

  const displayName = (body.displayName as string) || context.userId
  const ttlSeconds = (body.ttlSeconds as number) || 3600

  const token = await signLiveKitToken(
    env.LIVEKIT_API_KEY,
    env.LIVEKIT_API_SECRET,
    {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
    {
      identity: context.userId,
      name: displayName,
      ttlSeconds,
      metadata: JSON.stringify({ name: displayName }),
    },
  )

  return {
    token,
    url: env.LIVEKIT_URL,
    roomName,
  }
}

// ============================================================================
// create-room (billable)
// ============================================================================

const createRoom: IntegrationHandler = async (env, body, context) => {
  if (!env.LIVEKIT_API_KEY) throw new Error('LIVEKIT_API_KEY not configured')
  if (!env.LIVEKIT_API_SECRET) throw new Error('LIVEKIT_API_SECRET not configured')
  if (!env.LIVEKIT_URL) throw new Error('LIVEKIT_URL not configured')

  const roomName = body.roomName as string
  if (!roomName) throw new Error('roomName is required')

  const maxParticipants = Math.min(Math.max(1, (body.maxParticipants as number) || 10), 100)
  const durationMinutes = Math.min(Math.max(1, (body.durationMinutes as number) || 60), 1440)
  const metadata = (body.metadata as string) || JSON.stringify({
    createdBy: context.userId,
    expiresAt: Date.now() + durationMinutes * 60 * 1000,
  })

  const room = await livekitTwirp(
    env.LIVEKIT_URL,
    env.LIVEKIT_API_KEY,
    env.LIVEKIT_API_SECRET,
    'RoomService',
    'CreateRoom',
    {
      name: roomName,
      empty_timeout: 300,
      departure_timeout: 20,
      max_participants: maxParticipants,
      metadata,
    },
  )

  // Generate an admin token for the room creator
  const expiresAt = Date.now() + durationMinutes * 60 * 1000
  const ttlSeconds = Math.floor((expiresAt - Date.now()) / 1000)

  const adminToken = await signLiveKitToken(
    env.LIVEKIT_API_KEY,
    env.LIVEKIT_API_SECRET,
    {
      room: roomName,
      roomJoin: true,
      roomAdmin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
    {
      identity: context.userId,
      ttlSeconds,
      metadata: JSON.stringify({ role: 'admin', createdRoom: true }),
    },
  )

  return {
    roomSid: room.sid,
    roomName: room.name,
    adminToken,
    livekitUrl: env.LIVEKIT_URL,
    expiresAt,
    maxParticipants,
    durationMinutes,
  }
}

// ============================================================================
// list-rooms (free)
// ============================================================================

const listRooms: IntegrationHandler = async (env) => {
  if (!env.LIVEKIT_API_KEY) throw new Error('LIVEKIT_API_KEY not configured')
  if (!env.LIVEKIT_API_SECRET) throw new Error('LIVEKIT_API_SECRET not configured')
  if (!env.LIVEKIT_URL) throw new Error('LIVEKIT_URL not configured')

  const data = await livekitTwirp(
    env.LIVEKIT_URL,
    env.LIVEKIT_API_KEY,
    env.LIVEKIT_API_SECRET,
    'RoomService',
    'ListRooms',
    {},
  )

  return { rooms: data.rooms || [] }
}

// ============================================================================
// delete-room (free)
// ============================================================================

const deleteRoom: IntegrationHandler = async (env, body) => {
  if (!env.LIVEKIT_API_KEY) throw new Error('LIVEKIT_API_KEY not configured')
  if (!env.LIVEKIT_API_SECRET) throw new Error('LIVEKIT_API_SECRET not configured')
  if (!env.LIVEKIT_URL) throw new Error('LIVEKIT_URL not configured')

  const roomName = body.roomName as string
  if (!roomName) throw new Error('roomName is required')

  await livekitTwirp(
    env.LIVEKIT_URL,
    env.LIVEKIT_API_KEY,
    env.LIVEKIT_API_SECRET,
    'RoomService',
    'DeleteRoom',
    { room: roomName },
  )

  return { deleted: true, roomName }
}

// ============================================================================
// Exports
// ============================================================================

export const endpoints: Record<string, EndpointDefinition> = {
  'livekit/generate-token': {
    handler: generateToken,
    billing: { model: 'per_request', baseCost: 0, currency: 'USD' },
  },
  'livekit/create-room': {
    handler: createRoom,
    billing: { model: 'per_participant_minute', baseCost: 0.01, currency: 'USD' },
  },
  'livekit/list-rooms': {
    handler: listRooms,
    billing: { model: 'per_request', baseCost: 0, currency: 'USD' },
  },
  'livekit/delete-room': {
    handler: deleteRoom,
    billing: { model: 'per_request', baseCost: 0, currency: 'USD' },
  },
}
