/**
 * Google integration handlers — Gmail, Calendar, Drive, Contacts.
 * Uses raw fetch to Google REST APIs (no googleapis SDK).
 *
 * OAuth flow:
 * 1. Client POSTs to an endpoint as the authenticated user
 * 2. Handler looks up stored tokens in oauth_tokens; auto-refreshes if expired
 * 3. If no stored tokens, returns { requiresOAuth: true, authUrl } with a signed state param
 * 4. Client opens authUrl → Google consent → callback exchanges code for tokens → stores in DB
 */

import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type { IntegrationHandler, EndpointDefinition, HandlerContext, OAuthProvider } from '../_types'
import { oauthTokens } from '../../db/schema'

// ============================================================================
// Google OAuth scopes
// ============================================================================

export const GOOGLE_SCOPES = {
  OPENID: 'openid',
  USER_EMAIL: 'https://www.googleapis.com/auth/userinfo.email',
  USER_PROFILE: 'https://www.googleapis.com/auth/userinfo.profile',
  GMAIL_SEND: 'https://www.googleapis.com/auth/gmail.send',
  GMAIL_READONLY: 'https://www.googleapis.com/auth/gmail.readonly',
  CONTACTS_READONLY: 'https://www.googleapis.com/auth/contacts.readonly',
  CALENDAR_EVENTS: 'https://www.googleapis.com/auth/calendar.events',
  DRIVE_FILE: 'https://www.googleapis.com/auth/drive.file',
} as const

/**
 * Per-purpose scope sets — kept narrow on purpose. Each scope set targets
 * exactly one Google API surface so the consent screen only asks for what
 * the user is actually trying to use. Bundling unrelated scopes (e.g.,
 * gmail + contacts) triggers Google's "unverified app" warning earlier
 * than necessary and makes incremental auth (`include_granted_scopes`)
 * meaningful.
 */
export const SCOPE_SETS = {
  GMAIL_SEND: [GOOGLE_SCOPES.GMAIL_SEND],
  GMAIL_READ: [GOOGLE_SCOPES.GMAIL_READONLY],
  CALENDAR: [GOOGLE_SCOPES.CALENDAR_EVENTS],
  DRIVE: [GOOGLE_SCOPES.DRIVE_FILE],
  CONTACTS: [GOOGLE_SCOPES.CONTACTS_READONLY],
} as const

export const GOOGLE_CALLBACK_URI = 'https://deepspace-api.eudaimonicincorporated.workers.dev/api/integrations/oauth/google/callback'

// ============================================================================
// OAuth state helpers (HMAC-signed, stateless)
// ============================================================================

function base64UrlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (str.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function hmacSign(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return base64UrlEncode(sig)
}

async function hmacVerify(secret: string, data: string, signature: string): Promise<boolean> {
  const expected = await hmacSign(secret, data)
  return expected === signature
}

const STATE_TTL_MS = 10 * 60 * 1000 // 10 minutes

export async function createOAuthState(
  env: { GOOGLE_CLIENT_SECRET: string },
  userId: string,
): Promise<string> {
  const payload = JSON.stringify({ uid: userId, ts: Date.now() })
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(payload))
  const signature = await hmacSign(env.GOOGLE_CLIENT_SECRET, encodedPayload)
  return `${encodedPayload}.${signature}`
}

export async function verifyOAuthState(
  env: { GOOGLE_CLIENT_SECRET: string },
  state: string,
): Promise<string> {
  const dotIndex = state.indexOf('.')
  if (dotIndex === -1) throw new Error('Invalid state token format')

  const encodedPayload = state.slice(0, dotIndex)
  const signature = state.slice(dotIndex + 1)

  const valid = await hmacVerify(env.GOOGLE_CLIENT_SECRET, encodedPayload, signature)
  if (!valid) throw new Error('Invalid state token signature')

  const payloadBytes = base64UrlDecode(encodedPayload)
  const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as { uid: string; ts: number }

  if (Date.now() - payload.ts > STATE_TTL_MS) throw new Error('State token expired')

  return payload.uid
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a Google OAuth 2.0 authorization URL.
 */
export function buildGoogleAuthUrl(
  env: { GOOGLE_CLIENT_ID: string },
  scopes: readonly string[],
  state?: string,
  redirectUri = GOOGLE_CALLBACK_URI,
): string {
  const allScopes = [
    GOOGLE_SCOPES.OPENID,
    GOOGLE_SCOPES.USER_EMAIL,
    GOOGLE_SCOPES.USER_PROFILE,
    ...scopes,
  ]
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: allScopes.join(' '),
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  })
  if (state) params.set('state', state)
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/**
 * Return a standard requiresOAuth response for a given set of scopes.
 */
async function oauthRequired(
  env: { GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string },
  scopes: readonly string[],
  userId: string,
) {
  const state = await createOAuthState(env, userId)
  return {
    requiresOAuth: true,
    provider: 'google',
    scopes: [...scopes],
    authUrl: buildGoogleAuthUrl(env, scopes, state),
  }
}

function bearerHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` }
}

async function handleGoogleResponse(
  response: Response,
  oauthFallback?: {
    env: { GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string }
    scopes: readonly string[]
    userId: string
  },
): Promise<unknown> {
  if (!response.ok) {
    const errorText = await response.text()
    // Stored token exists but lacks the scope this endpoint needs (user
    // granted other scopes but not this one). Translate to requiresOAuth
    // so the client can prompt for the missing scope — without this, a
    // user connected to e.g. Drive only would get an opaque 502 when
    // trying to list calendar events.
    if (oauthFallback) {
      // 403: stored token doesn't have the required scope (incremental-auth
      // gap). Translate to requiresOAuth so the client prompts for the
      // missing scope.
      if (
        response.status === 403 &&
        (errorText.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') ||
          errorText.includes('insufficientPermissions'))
      ) {
        return oauthRequired(oauthFallback.env, oauthFallback.scopes, oauthFallback.userId)
      }
      // 401: stored token is invalid — typically because the user revoked
      // app access in their Google account, the refresh token expired
      // (refresh tokens for unverified apps die after 7 days of disuse),
      // or the stored expiresAt drifted. Same UX answer: tell the client
      // to re-auth instead of returning an opaque error. The stale row
      // stays for now (next successful callback will overwrite it via
      // upsertOAuthTokens), so disconnect-then-reconnect cleanly recovers.
      if (
        response.status === 401 &&
        (errorText.includes('UNAUTHENTICATED') ||
          errorText.includes('Invalid Credentials') ||
          errorText.includes('authError'))
      ) {
        return oauthRequired(oauthFallback.env, oauthFallback.scopes, oauthFallback.userId)
      }
    }
    throw new Error(`Google API error ${response.status}: ${errorText}`)
  }
  return response.json()
}

// ============================================================================
// Token storage & refresh
// ============================================================================

export async function getStoredGoogleToken(
  db: DrizzleD1Database,
  userId: string,
): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: Date | null; scopes: string | null } | null> {
  const [row] = await db
    .select()
    .from(oauthTokens)
    .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, 'google')))
    .limit(1)
  if (!row) return null
  return {
    accessToken: row.accessToken,
    refreshToken: row.refreshToken,
    expiresAt: row.expiresAt,
    scopes: row.scopes,
  }
}

export async function refreshGoogleAccessToken(
  env: { GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string },
  db: DrizzleD1Database,
  userId: string,
  refreshToken: string,
): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Token refresh failed: ${errorText}`)
  }

  const tokens = (await response.json()) as {
    access_token: string
    expires_in: number
    token_type: string
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

  await db
    .update(oauthTokens)
    .set({
      accessToken: tokens.access_token,
      expiresAt,
      updatedAt: new Date(),
    })
    .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, 'google')))

  return tokens.access_token
}

/**
 * Resolve a valid Google access token for a user from stored tokens.
 * Returns the token string, or null if the user hasn't connected Google.
 */
async function resolveAccessToken(
  env: { GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string },
  ctx: HandlerContext,
): Promise<string | null> {
  const stored = await getStoredGoogleToken(ctx.db, ctx.userId)
  if (!stored) return null

  // Refresh if expired (with 60s buffer)
  const isExpired = stored.expiresAt && stored.expiresAt.getTime() < Date.now() + 60_000
  if (isExpired && stored.refreshToken) {
    return refreshGoogleAccessToken(env, ctx.db, ctx.userId, stored.refreshToken)
  }

  return stored.accessToken
}

// ============================================================================
// Token exchange (used by callback route)
// ============================================================================

export async function exchangeCodeForTokens(
  env: { GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string },
  code: string,
  redirectUri = GOOGLE_CALLBACK_URI,
): Promise<{
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Token exchange failed: ${errorText}`)
  }

  return response.json() as Promise<{
    access_token: string
    refresh_token?: string
    expires_in: number
    scope: string
    token_type: string
  }>
}

/** Union two space-separated scope strings, preserving order, no duplicates. */
function mergeScopes(prior: string | null | undefined, next: string | null | undefined): string {
  const set = new Set<string>()
  for (const s of (prior ?? '').split(/\s+/).filter(Boolean)) set.add(s)
  for (const s of (next ?? '').split(/\s+/).filter(Boolean)) set.add(s)
  return Array.from(set).join(' ')
}

export async function upsertOAuthTokens(
  db: DrizzleD1Database,
  userId: string,
  provider: string,
  tokens: {
    access_token: string
    refresh_token?: string
    expires_in: number
    scope: string
    token_type: string
  },
): Promise<void> {
  const now = new Date()
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

  // Look up the existing row so we can union scopes. We can't trust Google's
  // response.scope to be cumulative across incremental-auth grants — different
  // tenants/clients have observed it returning only the just-granted scopes.
  // If we naively overwrite, granting calendar after drive flips drive: false
  // in /status even though the actual access_token (with include_granted_scopes)
  // still has both. Defensive union here keeps the status truthful.
  const [existing] = await db
    .select({ id: oauthTokens.id, scopes: oauthTokens.scopes })
    .from(oauthTokens)
    .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, provider)))
    .limit(1)

  if (existing) {
    await db
      .update(oauthTokens)
      .set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        tokenType: tokens.token_type,
        expiresAt,
        scopes: mergeScopes(existing.scopes, tokens.scope),
        updatedAt: now,
      })
      .where(eq(oauthTokens.id, existing.id))
  } else {
    await db.insert(oauthTokens).values({
      userId,
      provider,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      tokenType: tokens.token_type,
      expiresAt,
      scopes: tokens.scope,
      createdAt: now,
      updatedAt: now,
    })
  }
}

// ============================================================================
// Gmail — send
// ============================================================================

function createRawEmail(
  to: string,
  subject: string,
  textContent: string,
  htmlContent?: string,
  threadId?: string,
): string {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  const lines: string[] = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
  ]

  if (htmlContent) {
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
    lines.push('')
    lines.push(`--${boundary}`)
    lines.push('Content-Type: text/plain; charset=UTF-8')
    lines.push('')
    lines.push(textContent)
    lines.push('')
    lines.push(`--${boundary}`)
    lines.push('Content-Type: text/html; charset=UTF-8')
    lines.push('')
    lines.push(htmlContent)
    lines.push('')
    lines.push(`--${boundary}--`)
  } else {
    lines.push('Content-Type: text/plain; charset=UTF-8')
    lines.push('')
    lines.push(textContent)
  }

  const raw = lines.join('\r\n')
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const gmailSend: IntegrationHandler = async (env, body, ctx) => {
  const accessToken = await resolveAccessToken(env, ctx)
  if (!accessToken) return oauthRequired(env, SCOPE_SETS.GMAIL_SEND, ctx.userId)

  const to = body.to as string
  const subject = body.subject as string
  const content = body.content as string
  if (!to || !subject || !content) throw new Error('to, subject, and content are required')

  const raw = createRawEmail(to, subject, content, body.html as string | undefined)
  const requestBody: Record<string, unknown> = { raw }
  if (body.threadId) requestBody.threadId = body.threadId

  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: { ...bearerHeaders(accessToken), 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    },
  )
  return handleGoogleResponse(response, { env, scopes: SCOPE_SETS.GMAIL_SEND, userId: ctx.userId })
}

// ============================================================================
// Gmail — list
// ============================================================================

const gmailList: IntegrationHandler = async (env, body, ctx) => {
  const accessToken = await resolveAccessToken(env, ctx)
  if (!accessToken) return oauthRequired(env, SCOPE_SETS.GMAIL_READ, ctx.userId)

  const params = new URLSearchParams()
  if (body.maxResults) params.set('maxResults', String(body.maxResults))
  if (body.pageToken) params.set('pageToken', String(body.pageToken))
  if (body.labelIds) {
    const labels = Array.isArray(body.labelIds) ? body.labelIds : [body.labelIds]
    labels.forEach((l: string) => params.append('labelIds', l))
  } else {
    params.append('labelIds', 'INBOX')
  }
  if (body.q) params.set('q', String(body.q))

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`
  const response = await fetch(url, { headers: bearerHeaders(accessToken) })
  return handleGoogleResponse(response, { env, scopes: SCOPE_SETS.GMAIL_READ, userId: ctx.userId })
}

// ============================================================================
// Gmail — get single message
// ============================================================================

const gmailGet: IntegrationHandler = async (env, body, ctx) => {
  const accessToken = await resolveAccessToken(env, ctx)
  if (!accessToken) return oauthRequired(env, SCOPE_SETS.GMAIL_READ, ctx.userId)

  const messageId = body.messageId || body.id
  if (!messageId) throw new Error('messageId is required')

  const format = body.format || 'full'
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=${format}`
  const response = await fetch(url, { headers: bearerHeaders(accessToken) })
  return handleGoogleResponse(response, { env, scopes: SCOPE_SETS.GMAIL_READ, userId: ctx.userId })
}

// ============================================================================
// Gmail — search (thin wrapper around list with q param)
// ============================================================================

const gmailSearch: IntegrationHandler = async (env, body, ctx) => {
  const accessToken = await resolveAccessToken(env, ctx)
  if (!accessToken) return oauthRequired(env, SCOPE_SETS.GMAIL_READ, ctx.userId)

  const query = body.query || body.q
  if (!query) throw new Error('query is required')

  const params = new URLSearchParams({
    q: String(query),
    maxResults: String(body.maxResults || 20),
  })
  if (body.pageToken) params.set('pageToken', String(body.pageToken))

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`
  const response = await fetch(url, { headers: bearerHeaders(accessToken) })
  return handleGoogleResponse(response, { env, scopes: SCOPE_SETS.GMAIL_READ, userId: ctx.userId })
}

// ============================================================================
// Calendar — list events
// ============================================================================

const calendarListEvents: IntegrationHandler = async (env, body, ctx) => {
  const accessToken = await resolveAccessToken(env, ctx)
  if (!accessToken) return oauthRequired(env, SCOPE_SETS.CALENDAR, ctx.userId)

  const calendarId = encodeURIComponent(String(body.calendarId || 'primary'))
  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
  })
  if (body.timeMin) params.set('timeMin', new Date(String(body.timeMin)).toISOString())
  if (body.timeMax) params.set('timeMax', new Date(String(body.timeMax)).toISOString())
  if (body.maxResults) params.set('maxResults', String(Math.min(2500, Math.max(1, Number(body.maxResults)))))
  if (body.q) params.set('q', String(body.q))

  const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params.toString()}`
  const response = await fetch(url, { headers: bearerHeaders(accessToken) })
  const result = await handleGoogleResponse(response, { env, scopes: SCOPE_SETS.CALENDAR, userId: ctx.userId }) as Record<string, unknown>
  // Normalize: Google returns `items`, clients expect `events`
  if (Array.isArray(result.items)) {
    result.events = result.items
  }
  return result
}

// ============================================================================
// Calendar — create event
// ============================================================================

const calendarCreateEvent: IntegrationHandler = async (env, body, ctx) => {
  const accessToken = await resolveAccessToken(env, ctx)
  if (!accessToken) return oauthRequired(env, SCOPE_SETS.CALENDAR, ctx.userId)

  const calendarId = encodeURIComponent(String(body.calendarId || 'primary'))
  const title = body.title || body.summary
  if (!title) throw new Error('title (or summary) is required')

  const start = body.start as string
  if (!start) throw new Error('start is required')

  const allDay = body.allDay === true
  const resource: Record<string, unknown> = {
    summary: title,
    description: body.description || '',
    start: allDay
      ? { date: start.slice(0, 10) }
      : { dateTime: new Date(start).toISOString() },
    end: allDay
      ? { date: ((body.end as string) || start).slice(0, 10) }
      : { dateTime: new Date(String(body.end || start)).toISOString() },
  }

  if (body.location) resource.location = body.location

  if (Array.isArray(body.attendees) && body.attendees.length > 0) {
    resource.attendees = (body.attendees as string[]).map((email) => ({ email }))
  }

  if (body.addVideoConferencing) {
    resource.conferenceData = {
      createRequest: {
        requestId: `meet-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    }
  }

  const conferenceParam = body.addVideoConferencing ? '?conferenceDataVersion=1' : ''
  const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events${conferenceParam}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { ...bearerHeaders(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify(resource),
  })
  return handleGoogleResponse(response, { env, scopes: SCOPE_SETS.CALENDAR, userId: ctx.userId })
}

// ============================================================================
// Calendar — delete event
// ============================================================================

const calendarDeleteEvent: IntegrationHandler = async (env, body, ctx) => {
  const accessToken = await resolveAccessToken(env, ctx)
  if (!accessToken) return oauthRequired(env, SCOPE_SETS.CALENDAR, ctx.userId)

  const calendarId = encodeURIComponent(String(body.calendarId || 'primary'))
  const eventId = body.eventId
  if (!eventId) throw new Error('eventId is required')

  const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`
  const response = await fetch(url, {
    method: 'DELETE',
    headers: bearerHeaders(accessToken),
  })

  if (response.status === 204) return { deleted: true, eventId }
  return handleGoogleResponse(response, { env, scopes: SCOPE_SETS.CALENDAR, userId: ctx.userId })
}

// ============================================================================
// Drive — list files
// ============================================================================

const driveList: IntegrationHandler = async (env, body, ctx) => {
  const accessToken = await resolveAccessToken(env, ctx)
  if (!accessToken) return oauthRequired(env, SCOPE_SETS.DRIVE, ctx.userId)

  const params = new URLSearchParams({
    pageSize: String(body.pageSize || 50),
    fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink)',
    q: String(body.q || 'trashed=false'),
  })
  if (body.pageToken) params.set('pageToken', String(body.pageToken))

  const url = `https://www.googleapis.com/drive/v3/files?${params.toString()}`
  const response = await fetch(url, { headers: bearerHeaders(accessToken) })
  return handleGoogleResponse(response, { env, scopes: SCOPE_SETS.DRIVE, userId: ctx.userId })
}

// ============================================================================
// Drive — get file metadata
// ============================================================================

const driveGet: IntegrationHandler = async (env, body, ctx) => {
  const accessToken = await resolveAccessToken(env, ctx)
  if (!accessToken) return oauthRequired(env, SCOPE_SETS.DRIVE, ctx.userId)

  const fileId = body.fileId
  if (!fileId) throw new Error('fileId is required')

  const fields = body.fields || 'id,name,mimeType,size,createdTime,modifiedTime,webViewLink'
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=${encodeURIComponent(String(fields))}`
  const response = await fetch(url, { headers: bearerHeaders(accessToken) })
  return handleGoogleResponse(response, { env, scopes: SCOPE_SETS.DRIVE, userId: ctx.userId })
}

// ============================================================================
// Contacts — list
// ============================================================================

const contactsList: IntegrationHandler = async (env, body, ctx) => {
  const accessToken = await resolveAccessToken(env, ctx)
  if (!accessToken) return oauthRequired(env, SCOPE_SETS.CONTACTS, ctx.userId)

  const pageSize = body.pageSize || 1000
  const personFields = body.personFields || 'names,emailAddresses,phoneNumbers,organizations,occupations,biographies'
  const params = new URLSearchParams({
    pageSize: String(pageSize),
    personFields: String(personFields),
  })
  if (body.pageToken) params.set('pageToken', String(body.pageToken))

  const url = `https://people.googleapis.com/v1/people/me/connections?${params.toString()}`
  const response = await fetch(url, { headers: bearerHeaders(accessToken) })
  return handleGoogleResponse(response, { env, scopes: SCOPE_SETS.CONTACTS, userId: ctx.userId })
}

// ============================================================================
// Billing configs
// ============================================================================

const GOOGLE_BILLING = { model: 'per_request' as const, baseCost: 0.01, currency: 'USD' }

// ============================================================================
// Schemas
// ============================================================================

const gmailSendSchema = z.object({
  to: z.string(),
  subject: z.string(),
  content: z.string(),
  html: z.string().optional(),
  threadId: z.string().optional(),
})

const gmailListSchema = z.object({
  maxResults: z.number().min(1).optional(),
  pageToken: z.string().optional(),
  labelIds: z.union([z.string(), z.array(z.string())]).optional(),
  q: z.string().optional(),
})

const gmailGetSchema = z.object({
  messageId: z.string().optional(),
  id: z.string().optional(),
  format: z.string().default('full'),
})

const gmailSearchSchema = z.object({
  query: z.string().optional(),
  q: z.string().optional(),
  maxResults: z.number().min(1).default(20),
  pageToken: z.string().optional(),
})

const calendarListEventsSchema = z.object({
  calendarId: z.string().default('primary'),
  timeMin: z.string().optional(),
  timeMax: z.string().optional(),
  maxResults: z.number().min(1).max(2500).optional(),
  q: z.string().optional(),
})

const calendarCreateEventSchema = z.object({
  calendarId: z.string().default('primary'),
  title: z.string().optional(),
  summary: z.string().optional(),
  start: z.string(),
  end: z.string().optional(),
  allDay: z.boolean().default(false),
  description: z.string().optional(),
  location: z.string().optional(),
  attendees: z.array(z.string()).optional(),
  addVideoConferencing: z.boolean().optional(),
})

const calendarDeleteEventSchema = z.object({
  calendarId: z.string().default('primary'),
  eventId: z.string(),
})

const driveListSchema = z.object({
  pageSize: z.number().min(1).max(1000).default(50),
  q: z.string().optional(),
  pageToken: z.string().optional(),
})

const driveGetSchema = z.object({
  fileId: z.string(),
  fields: z.string().optional(),
})

const contactsListSchema = z.object({
  pageSize: z.number().min(1).max(2000).default(1000),
  personFields: z.string().optional(),
  pageToken: z.string().optional(),
})

// ============================================================================
// OAuth callback, status, disconnect — used by route layer
// ============================================================================

function htmlPage(title: string, body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8f9fa}
.card{text-align:center;padding:2rem;border-radius:12px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.1);max-width:400px}
h1{margin:0 0 .5rem;font-size:1.5rem}p{color:#666;margin:.5rem 0}</style>
</head><body><div class="card">${body}</div></body></html>`
}

/**
 * Handle the Google OAuth callback (browser redirect from Google).
 * Verifies state, exchanges code for tokens, stores them, returns HTML.
 */
export async function handleGoogleCallback(
  env: { GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string },
  db: DrizzleD1Database,
  code: string | undefined,
  state: string | undefined,
): Promise<{ html: string; status: number }> {
  if (!code || !state) {
    return {
      html: htmlPage('Connection Failed', '<h1>Connection Failed</h1><p>Missing authorization code or state token.</p><p>Please close this tab and try again.</p>'),
      status: 400,
    }
  }

  let userId: string
  try {
    userId = await verifyOAuthState(env, state)
  } catch (err) {
    console.error('[google-callback] State verification failed:', err)
    return {
      html: htmlPage('Connection Failed', '<h1>Connection Failed</h1><p>Invalid or expired authorization. Please close this tab and try again.</p>'),
      status: 400,
    }
  }

  try {
    const tokens = await exchangeCodeForTokens(env, code, GOOGLE_CALLBACK_URI)
    await upsertOAuthTokens(db, userId, 'google', tokens)
    return {
      html: htmlPage('Connected!', `<h1>Google Connected!</h1><p>You can close this tab now.</p>
<script>setTimeout(function(){try{window.close()}catch(e){}},1500)</script>`),
      status: 200,
    }
  } catch (err) {
    console.error('[google-callback] Token exchange failed:', err)
    return {
      html: htmlPage('Connection Failed', '<h1>Connection Failed</h1><p>Could not complete Google authorization. Please close this tab and try again.</p>'),
      status: 500,
    }
  }
}

/**
 * Return integration connection status for a user.
 */
export async function getIntegrationStatus(
  db: DrizzleD1Database,
  userId: string,
): Promise<Record<string, unknown>> {
  const [googleRow] = await db
    .select({ scopes: oauthTokens.scopes })
    .from(oauthTokens)
    .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, 'google')))
    .limit(1)

  // Detect granted capabilities by checking the stored scope string for
  // any scope that grants the capability — direct or via a broader parent.
  // Google's scope hierarchy means a token with `gmail.modify` can also
  // send and read; a token with the broad `calendar` scope can also do
  // anything `calendar.events` can. Without this, users who granted
  // a broader scope (or who granted via an older bundled SCOPE_SET that
  // we've since narrowed) appear "not connected" in status, even though
  // their token works for the underlying API calls.
  const granted = (googleRow?.scopes ?? '').split(/\s+/).filter(Boolean)
  const has = (...scopes: string[]) => scopes.some((s) => granted.includes(s))
  const SCOPE = {
    gmailSend: 'https://www.googleapis.com/auth/gmail.send',
    gmailRead: 'https://www.googleapis.com/auth/gmail.readonly',
    gmailModify: 'https://www.googleapis.com/auth/gmail.modify',
    gmailFull: 'https://mail.google.com/',
    calendarEvents: 'https://www.googleapis.com/auth/calendar.events',
    calendarFull: 'https://www.googleapis.com/auth/calendar',
    driveFile: 'https://www.googleapis.com/auth/drive.file',
    driveReadonly: 'https://www.googleapis.com/auth/drive.readonly',
    driveFull: 'https://www.googleapis.com/auth/drive',
    contactsReadonly: 'https://www.googleapis.com/auth/contacts.readonly',
    contactsFull: 'https://www.googleapis.com/auth/contacts',
  }

  const gmailSend = has(SCOPE.gmailSend, SCOPE.gmailModify, SCOPE.gmailFull)
  const gmailRead = has(SCOPE.gmailRead, SCOPE.gmailModify, SCOPE.gmailFull)
  const calendar = has(SCOPE.calendarEvents, SCOPE.calendarFull)
  const drive = has(SCOPE.driveFile, SCOPE.driveReadonly, SCOPE.driveFull)
  const contacts = has(SCOPE.contactsReadonly, SCOPE.contactsFull)

  return {
    connected: !!googleRow,
    // Granular per-scope flags (preferred for new clients)
    gmailSend,
    gmailRead,
    calendar,
    drive,
    contacts,
    // Back-compat aggregate: gmail = either send or read
    gmail: gmailSend || gmailRead,
  }
}

/**
 * Disconnect Google — revoke token (best effort) and delete from DB.
 */
export async function disconnectGoogle(
  db: DrizzleD1Database,
  userId: string,
): Promise<void> {
  const [row] = await db
    .select({ accessToken: oauthTokens.accessToken })
    .from(oauthTokens)
    .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, 'google')))
    .limit(1)

  if (row) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(row.accessToken)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    } catch {
      // Ignore revocation errors
    }

    await db
      .delete(oauthTokens)
      .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, 'google')))
  }
}

// ============================================================================
// Exports
// ============================================================================

export const endpoints: Record<string, EndpointDefinition> = {
  'google/gmail-send':             { handler: gmailSend,           billing: GOOGLE_BILLING, schema: gmailSendSchema },
  'google/gmail-list':             { handler: gmailList,           billing: GOOGLE_BILLING, schema: gmailListSchema },
  'google/gmail-get':              { handler: gmailGet,            billing: GOOGLE_BILLING, schema: gmailGetSchema },
  'google/gmail-search':           { handler: gmailSearch,         billing: GOOGLE_BILLING, schema: gmailSearchSchema },
  'google/calendar-list-events':   { handler: calendarListEvents,  billing: GOOGLE_BILLING, schema: calendarListEventsSchema },
  'google/calendar-create-event':  { handler: calendarCreateEvent, billing: GOOGLE_BILLING, schema: calendarCreateEventSchema },
  'google/calendar-delete-event':  { handler: calendarDeleteEvent, billing: GOOGLE_BILLING, schema: calendarDeleteEventSchema },
  'google/drive-list':             { handler: driveList,           billing: GOOGLE_BILLING, schema: driveListSchema },
  'google/drive-get':              { handler: driveGet,            billing: GOOGLE_BILLING, schema: driveGetSchema },
  'google/contacts-list':          { handler: contactsList,        billing: GOOGLE_BILLING, schema: contactsListSchema },
}

export const oauthProvider: OAuthProvider = {
  handleCallback: handleGoogleCallback,
  getStatus: getIntegrationStatus,
  disconnect: disconnectGoogle,
}
