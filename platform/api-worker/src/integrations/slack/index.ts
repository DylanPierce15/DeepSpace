/**
 * Slack integration handlers — channels, messaging, team info.
 * Uses raw fetch to the Slack Web API.
 *
 * OAuth pattern: handlers accept `body.accessToken`. If missing they return
 * `{ requiresOAuth: true, scopes, authUrl }` so the client can initiate the
 * OAuth consent flow. Full token exchange / storage / refresh will be added
 * later when the OAuth infrastructure is built.
 */

import { z } from 'zod'
import type { IntegrationHandler, EndpointDefinition } from '../_types'

// ============================================================================
// Slack OAuth scopes (user-token scopes, not bot scopes)
// ============================================================================

export const SLACK_SCOPES = {
  CHAT_WRITE: 'chat:write',
  CHANNELS_READ: 'channels:read',
  CHANNELS_HISTORY: 'channels:history',
  GROUPS_READ: 'groups:read',
  GROUPS_HISTORY: 'groups:history',
  IM_READ: 'im:read',
  IM_HISTORY: 'im:history',
  USERS_READ: 'users:read',
  TEAM_READ: 'team:read',
} as const

export const SLACK_SCOPE_SETS = {
  MESSAGING: [
    SLACK_SCOPES.CHAT_WRITE,
    SLACK_SCOPES.CHANNELS_READ,
    SLACK_SCOPES.USERS_READ,
    SLACK_SCOPES.TEAM_READ,
  ],
  MESSAGING_WITH_HISTORY: [
    SLACK_SCOPES.CHAT_WRITE,
    SLACK_SCOPES.CHANNELS_READ,
    SLACK_SCOPES.CHANNELS_HISTORY,
    SLACK_SCOPES.GROUPS_READ,
    SLACK_SCOPES.GROUPS_HISTORY,
    SLACK_SCOPES.IM_READ,
    SLACK_SCOPES.IM_HISTORY,
    SLACK_SCOPES.USERS_READ,
    SLACK_SCOPES.TEAM_READ,
  ],
} as const

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a Slack OAuth 2.0 authorization URL (user-token flow).
 */
export function buildSlackAuthUrl(
  env: { SLACK_CLIENT_ID: string },
  scopes: readonly string[],
  redirectUri = 'https://api.deep.space/api/integrations/slack-callback',
): string {
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    user_scope: scopes.join(','),
    redirect_uri: redirectUri,
  })
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`
}

function oauthRequired(env: { SLACK_CLIENT_ID?: string }, scopes: readonly string[]) {
  return {
    requiresOAuth: true,
    provider: 'slack',
    scopes: [...scopes],
    authUrl: env.SLACK_CLIENT_ID
      ? buildSlackAuthUrl(env as { SLACK_CLIENT_ID: string }, scopes)
      : undefined,
  }
}

async function slackApiFetch(
  url: string,
  accessToken: string,
  options?: { method?: string; body?: Record<string, unknown> },
): Promise<unknown> {
  const method = options?.method || 'GET'
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  }

  const fetchOptions: RequestInit = { method, headers }

  if (options?.body) {
    headers['Content-Type'] = 'application/json; charset=utf-8'
    fetchOptions.body = JSON.stringify(options.body)
  }

  const response = await fetch(url, fetchOptions)

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Slack API HTTP error ${response.status}: ${errorText}`)
  }

  const data = (await response.json()) as { ok: boolean; error?: string }

  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error || 'unknown_error'}`)
  }

  return data
}

// ============================================================================
// list-channels — conversations.list
// ============================================================================

const listChannels: IntegrationHandler = async (env, body) => {
  const accessToken = body.accessToken as string | undefined
  if (!accessToken) return oauthRequired(env, SLACK_SCOPE_SETS.MESSAGING_WITH_HISTORY)

  const params = new URLSearchParams({
    limit: String(Math.min(Number(body.limit) || 100, 200)),
    types: String(body.types || 'public_channel,private_channel'),
  })
  if (body.cursor) params.set('cursor', String(body.cursor))

  return slackApiFetch(
    `https://slack.com/api/conversations.list?${params.toString()}`,
    accessToken,
  )
}

// ============================================================================
// send-message — chat.postMessage
// ============================================================================

const sendMessage: IntegrationHandler = async (env, body) => {
  const accessToken = body.accessToken as string | undefined
  if (!accessToken) return oauthRequired(env, SLACK_SCOPE_SETS.MESSAGING)

  const channel = body.channel as string
  const text = body.text as string
  if (!channel) throw new Error('channel is required')
  if (!text) throw new Error('text is required')

  const payload: Record<string, unknown> = { channel, text }
  if (body.thread_ts) payload.thread_ts = body.thread_ts
  if (body.unfurl_links !== undefined) payload.unfurl_links = body.unfurl_links
  if (body.unfurl_media !== undefined) payload.unfurl_media = body.unfurl_media
  if (body.blocks) payload.blocks = body.blocks

  return slackApiFetch('https://slack.com/api/chat.postMessage', accessToken, {
    method: 'POST',
    body: payload,
  })
}

// ============================================================================
// channel-history — conversations.history
// ============================================================================

const channelHistory: IntegrationHandler = async (env, body) => {
  const accessToken = body.accessToken as string | undefined
  if (!accessToken) return oauthRequired(env, SLACK_SCOPE_SETS.MESSAGING_WITH_HISTORY)

  const channel = body.channel as string
  if (!channel) throw new Error('channel is required')

  const params = new URLSearchParams({
    channel,
    limit: String(Math.min(Number(body.limit) || 100, 200)),
  })
  if (body.cursor) params.set('cursor', String(body.cursor))
  if (body.oldest) params.set('oldest', String(body.oldest))
  if (body.latest) params.set('latest', String(body.latest))

  return slackApiFetch(
    `https://slack.com/api/conversations.history?${params.toString()}`,
    accessToken,
  )
}

// ============================================================================
// team-info — team.info
// ============================================================================

const teamInfo: IntegrationHandler = async (env, body) => {
  const accessToken = body.accessToken as string | undefined
  if (!accessToken) return oauthRequired(env, SLACK_SCOPE_SETS.MESSAGING)

  return slackApiFetch('https://slack.com/api/team.info', accessToken)
}

// ============================================================================
// Billing configs
// ============================================================================

const SLACK_READ_BILLING = { model: 'per_request' as const, baseCost: 0.001, currency: 'USD' }
const SLACK_WRITE_BILLING = { model: 'per_request' as const, baseCost: 0.01, currency: 'USD' }

// ============================================================================
// Exports
// ============================================================================

const listChannelsSchema = z.object({
  accessToken: z.string().optional(),
  limit: z.number().min(1).max(200).default(100),
  types: z.string().default('public_channel,private_channel'),
  cursor: z.string().optional(),
})

const sendMessageSchema = z.object({
  accessToken: z.string().optional(),
  channel: z.string(),
  text: z.string(),
  thread_ts: z.string().optional(),
  unfurl_links: z.boolean().optional(),
  unfurl_media: z.boolean().optional(),
  blocks: z.array(z.record(z.string(), z.unknown())).optional(),
})

const channelHistorySchema = z.object({
  accessToken: z.string().optional(),
  channel: z.string(),
  limit: z.number().min(1).max(200).default(100),
  cursor: z.string().optional(),
  oldest: z.string().optional(),
  latest: z.string().optional(),
})

const teamInfoSchema = z.object({
  accessToken: z.string().optional(),
})

export const endpoints: Record<string, EndpointDefinition> = {
  'slack/list-channels':   { handler: listChannels,  billing: SLACK_READ_BILLING, schema: listChannelsSchema },
  'slack/send-message':    { handler: sendMessage,    billing: SLACK_WRITE_BILLING, schema: sendMessageSchema },
  'slack/channel-history': { handler: channelHistory, billing: SLACK_READ_BILLING, schema: channelHistorySchema },
  'slack/team-info':       { handler: teamInfo,       billing: SLACK_READ_BILLING, schema: teamInfoSchema },
}
