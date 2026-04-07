/**
 * Google integration handlers — Gmail, Calendar, Drive, Contacts.
 * Uses raw fetch to Google REST APIs (no googleapis SDK).
 *
 * OAuth pattern: handlers accept `body.accessToken`. If missing they return
 * `{ requiresOAuth: true, scopes, authUrl }` so the client can initiate the
 * OAuth consent flow. Full token exchange / storage / refresh will be added
 * later when the OAuth infrastructure is built.
 */

import { z } from 'zod'
import type { IntegrationHandler, EndpointDefinition } from '../_types'

// ============================================================================
// Google OAuth scopes
// ============================================================================

export const GOOGLE_SCOPES = {
  OPENID: 'openid',
  USER_EMAIL: 'https://www.googleapis.com/auth/userinfo.email',
  USER_PROFILE: 'https://www.googleapis.com/auth/userinfo.profile',
  GMAIL_SEND: 'https://www.googleapis.com/auth/gmail.send',
  GMAIL_MODIFY: 'https://www.googleapis.com/auth/gmail.modify',
  CONTACTS_READONLY: 'https://www.googleapis.com/auth/contacts.readonly',
  CALENDAR: 'https://www.googleapis.com/auth/calendar',
  CALENDAR_EVENTS: 'https://www.googleapis.com/auth/calendar.events',
  DRIVE_FILE: 'https://www.googleapis.com/auth/drive.file',
} as const

export const SCOPE_SETS = {
  GMAIL: [GOOGLE_SCOPES.GMAIL_SEND, GOOGLE_SCOPES.CONTACTS_READONLY],
  GMAIL_FULL: [GOOGLE_SCOPES.GMAIL_MODIFY, GOOGLE_SCOPES.CONTACTS_READONLY],
  CALENDAR: [GOOGLE_SCOPES.CALENDAR, GOOGLE_SCOPES.CALENDAR_EVENTS],
  DRIVE: [GOOGLE_SCOPES.DRIVE_FILE],
  CONTACTS: [GOOGLE_SCOPES.CONTACTS_READONLY],
} as const

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a Google OAuth 2.0 authorization URL.
 * Used to redirect users to Google consent when no accessToken is present.
 */
export function buildGoogleAuthUrl(
  env: { GOOGLE_CLIENT_ID: string },
  scopes: readonly string[],
  redirectUri = 'https://api.deep.space/api/integrations/google-callback',
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
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/**
 * Return a standard requiresOAuth response for a given set of scopes.
 */
function oauthRequired(env: { GOOGLE_CLIENT_ID: string }, scopes: readonly string[]) {
  return {
    requiresOAuth: true,
    provider: 'google',
    scopes: [...scopes],
    authUrl: env.GOOGLE_CLIENT_ID
      ? buildGoogleAuthUrl(env, scopes)
      : undefined,
  }
}

function bearerHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` }
}

async function handleGoogleResponse(response: Response): Promise<unknown> {
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Google API error ${response.status}: ${errorText}`)
  }
  return response.json()
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

const gmailSend: IntegrationHandler = async (env, body) => {
  const accessToken = body.accessToken as string | undefined
  if (!accessToken) return oauthRequired(env, SCOPE_SETS.GMAIL_FULL)

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
  return handleGoogleResponse(response)
}

// ============================================================================
// Gmail — list
// ============================================================================

const gmailList: IntegrationHandler = async (env, body) => {
  const accessToken = body.accessToken as string | undefined
  if (!accessToken) return oauthRequired(env, SCOPE_SETS.GMAIL_FULL)

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
  return handleGoogleResponse(response)
}

// ============================================================================
// Gmail — get single message
// ============================================================================

const gmailGet: IntegrationHandler = async (env, body) => {
  const accessToken = body.accessToken as string | undefined
  if (!accessToken) return oauthRequired(env, SCOPE_SETS.GMAIL_FULL)

  const messageId = body.messageId || body.id
  if (!messageId) throw new Error('messageId is required')

  const format = body.format || 'full'
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=${format}`
  const response = await fetch(url, { headers: bearerHeaders(accessToken) })
  return handleGoogleResponse(response)
}

// ============================================================================
// Gmail — search (thin wrapper around list with q param)
// ============================================================================

const gmailSearch: IntegrationHandler = async (env, body) => {
  const accessToken = body.accessToken as string | undefined
  if (!accessToken) return oauthRequired(env, SCOPE_SETS.GMAIL_FULL)

  const query = body.query || body.q
  if (!query) throw new Error('query is required')

  const params = new URLSearchParams({
    q: String(query),
    maxResults: String(body.maxResults || 20),
  })
  if (body.pageToken) params.set('pageToken', String(body.pageToken))

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`
  const response = await fetch(url, { headers: bearerHeaders(accessToken) })
  return handleGoogleResponse(response)
}

// ============================================================================
// Calendar — list events
// ============================================================================

const calendarListEvents: IntegrationHandler = async (env, body) => {
  const accessToken = body.accessToken as string | undefined
  if (!accessToken) return oauthRequired(env, SCOPE_SETS.CALENDAR)

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
  return handleGoogleResponse(response)
}

// ============================================================================
// Calendar — create event
// ============================================================================

const calendarCreateEvent: IntegrationHandler = async (env, body) => {
  const accessToken = body.accessToken as string | undefined
  if (!accessToken) return oauthRequired(env, SCOPE_SETS.CALENDAR)

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
  return handleGoogleResponse(response)
}

// ============================================================================
// Calendar — delete event
// ============================================================================

const calendarDeleteEvent: IntegrationHandler = async (env, body) => {
  const accessToken = body.accessToken as string | undefined
  if (!accessToken) return oauthRequired(env, SCOPE_SETS.CALENDAR)

  const calendarId = encodeURIComponent(String(body.calendarId || 'primary'))
  const eventId = body.eventId
  if (!eventId) throw new Error('eventId is required')

  const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`
  const response = await fetch(url, {
    method: 'DELETE',
    headers: bearerHeaders(accessToken),
  })

  if (response.status === 204) return { deleted: true, eventId }
  return handleGoogleResponse(response)
}

// ============================================================================
// Drive — list files
// ============================================================================

const driveList: IntegrationHandler = async (env, body) => {
  const accessToken = body.accessToken as string | undefined
  if (!accessToken) return oauthRequired(env, SCOPE_SETS.DRIVE)

  const params = new URLSearchParams({
    pageSize: String(body.pageSize || 50),
    fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink)',
    q: String(body.q || 'trashed=false'),
  })
  if (body.pageToken) params.set('pageToken', String(body.pageToken))

  const url = `https://www.googleapis.com/drive/v3/files?${params.toString()}`
  const response = await fetch(url, { headers: bearerHeaders(accessToken) })
  return handleGoogleResponse(response)
}

// ============================================================================
// Drive — get file metadata
// ============================================================================

const driveGet: IntegrationHandler = async (env, body) => {
  const accessToken = body.accessToken as string | undefined
  if (!accessToken) return oauthRequired(env, SCOPE_SETS.DRIVE)

  const fileId = body.fileId
  if (!fileId) throw new Error('fileId is required')

  const fields = body.fields || 'id,name,mimeType,size,createdTime,modifiedTime,webViewLink'
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=${encodeURIComponent(String(fields))}`
  const response = await fetch(url, { headers: bearerHeaders(accessToken) })
  return handleGoogleResponse(response)
}

// ============================================================================
// Contacts — list
// ============================================================================

const contactsList: IntegrationHandler = async (env, body) => {
  const accessToken = body.accessToken as string | undefined
  if (!accessToken) return oauthRequired(env, SCOPE_SETS.CONTACTS)

  const pageSize = body.pageSize || 1000
  const personFields = body.personFields || 'names,emailAddresses,phoneNumbers,organizations,occupations,biographies'
  const params = new URLSearchParams({
    pageSize: String(pageSize),
    personFields: String(personFields),
  })
  if (body.pageToken) params.set('pageToken', String(body.pageToken))

  const url = `https://people.googleapis.com/v1/people/me/connections?${params.toString()}`
  const response = await fetch(url, { headers: bearerHeaders(accessToken) })
  return handleGoogleResponse(response)
}

// ============================================================================
// Billing configs
// ============================================================================

const GOOGLE_BILLING = { model: 'per_request' as const, baseCost: 0.01, currency: 'USD' }

// ============================================================================
// Schemas
// ============================================================================

const gmailSendSchema = z.object({
  accessToken: z.string().optional(),
  to: z.string(),
  subject: z.string(),
  content: z.string(),
  html: z.string().optional(),
  threadId: z.string().optional(),
})

const gmailListSchema = z.object({
  accessToken: z.string().optional(),
  maxResults: z.number().min(1).optional(),
  pageToken: z.string().optional(),
  labelIds: z.union([z.string(), z.array(z.string())]).optional(),
  q: z.string().optional(),
})

const gmailGetSchema = z.object({
  accessToken: z.string().optional(),
  messageId: z.string().optional(),
  id: z.string().optional(),
  format: z.string().default('full'),
})

const gmailSearchSchema = z.object({
  accessToken: z.string().optional(),
  query: z.string().optional(),
  q: z.string().optional(),
  maxResults: z.number().min(1).default(20),
  pageToken: z.string().optional(),
})

const calendarListEventsSchema = z.object({
  accessToken: z.string().optional(),
  calendarId: z.string().default('primary'),
  timeMin: z.string().optional(),
  timeMax: z.string().optional(),
  maxResults: z.number().min(1).max(2500).optional(),
  q: z.string().optional(),
})

const calendarCreateEventSchema = z.object({
  accessToken: z.string().optional(),
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
  accessToken: z.string().optional(),
  calendarId: z.string().default('primary'),
  eventId: z.string(),
})

const driveListSchema = z.object({
  accessToken: z.string().optional(),
  pageSize: z.number().min(1).max(1000).default(50),
  q: z.string().optional(),
  pageToken: z.string().optional(),
})

const driveGetSchema = z.object({
  accessToken: z.string().optional(),
  fileId: z.string(),
  fields: z.string().optional(),
})

const contactsListSchema = z.object({
  accessToken: z.string().optional(),
  pageSize: z.number().min(1).max(2000).default(1000),
  personFields: z.string().optional(),
  pageToken: z.string().optional(),
})

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
