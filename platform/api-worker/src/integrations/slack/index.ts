/**
 * Slack integration handlers — channels, messaging, team info.
 * Uses raw fetch to the Slack Web API. Callers must supply an `accessToken`
 * in the request body; obtaining one is the caller's responsibility.
 */

import { z } from 'zod'
import type { IntegrationHandler, EndpointDefinition } from '../_types'

// ============================================================================
// Helpers
// ============================================================================

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

const listChannels: IntegrationHandler = async (_env, body) => {
  const accessToken = body.accessToken as string | undefined
  if (!accessToken) throw new Error('accessToken is required')

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

const sendMessage: IntegrationHandler = async (_env, body) => {
  const accessToken = body.accessToken as string | undefined
  if (!accessToken) throw new Error('accessToken is required')

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

const channelHistory: IntegrationHandler = async (_env, body) => {
  const accessToken = body.accessToken as string | undefined
  if (!accessToken) throw new Error('accessToken is required')

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

const teamInfo: IntegrationHandler = async (_env, body) => {
  const accessToken = body.accessToken as string | undefined
  if (!accessToken) throw new Error('accessToken is required')

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
  accessToken: z.string(),
  limit: z.number().min(1).max(200).default(100),
  types: z.string().default('public_channel,private_channel'),
  cursor: z.string().optional(),
})

const sendMessageSchema = z.object({
  accessToken: z.string(),
  channel: z.string(),
  text: z.string(),
  thread_ts: z.string().optional(),
  unfurl_links: z.boolean().optional(),
  unfurl_media: z.boolean().optional(),
  blocks: z.array(z.record(z.string(), z.unknown())).optional(),
})

const channelHistorySchema = z.object({
  accessToken: z.string(),
  channel: z.string(),
  limit: z.number().min(1).max(200).default(100),
  cursor: z.string().optional(),
  oldest: z.string().optional(),
  latest: z.string().optional(),
})

const teamInfoSchema = z.object({
  accessToken: z.string(),
})

export const endpoints: Record<string, EndpointDefinition> = {
  'slack/list-channels':   { handler: listChannels,  billing: SLACK_READ_BILLING, schema: listChannelsSchema },
  'slack/send-message':    { handler: sendMessage,    billing: SLACK_WRITE_BILLING, schema: sendMessageSchema },
  'slack/channel-history': { handler: channelHistory, billing: SLACK_READ_BILLING, schema: channelHistorySchema },
  'slack/team-info':       { handler: teamInfo,       billing: SLACK_READ_BILLING, schema: teamInfoSchema },
}
