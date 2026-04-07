/**
 * TikTok integration -- video posting, user info, scheduled posts.
 * Ported from Miyagi3 TikTokService.ts.
 *
 * Uses TikTok Open API v2:
 * - POST /v2/post/publish/          -- post a video
 * - GET  /v2/user/info/             -- get user profile
 * - GET  /v2/post/scheduled/        -- list scheduled posts
 * - POST /v2/post/scheduled/:id/cancel/ -- cancel a scheduled post
 */

import { z } from 'zod'
import type { IntegrationHandler, EndpointDefinition } from '../_types'

// ============================================================================
// Constants
// ============================================================================

const TIKTOK_API_BASE = 'https://open-api.tiktok.com/v2'

function tiktokHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

// ============================================================================
// post-video
// ============================================================================

const postVideo: IntegrationHandler = async (env, body) => {
  if (!env.TIKTOK_API_KEY) throw new Error('TIKTOK_API_KEY not configured')

  const videoUrl = body.videoUrl as string
  if (!videoUrl) throw new Error('videoUrl is required')
  const caption = body.caption as string
  if (!caption) throw new Error('caption is required')

  const requestBody: Record<string, unknown> = {
    video_url: videoUrl,
    caption,
    privacy_level: (body.privacyLevel as string) || 'PUBLIC_TO_EVERYONE',
  }

  if (body.hashtags) requestBody.hashtags = body.hashtags
  if (body.scheduleTime) {
    requestBody.schedule_time = Math.floor(
      new Date(body.scheduleTime as string).getTime() / 1000,
    )
  }

  const response = await fetch(`${TIKTOK_API_BASE}/post/publish/`, {
    method: 'POST',
    headers: tiktokHeaders(env.TIKTOK_API_KEY),
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`TikTok API error ${response.status}: ${errorText}`)
  }

  const data: any = await response.json()

  return {
    postId: data.post_id,
    scheduled: !!body.scheduleTime,
    scheduledTime: body.scheduleTime || null,
    message: body.scheduleTime
      ? 'Video scheduled successfully'
      : 'Video posted successfully',
  }
}

// ============================================================================
// user-info
// ============================================================================

const getUserInfo: IntegrationHandler = async (env) => {
  if (!env.TIKTOK_API_KEY) throw new Error('TIKTOK_API_KEY not configured')

  const response = await fetch(`${TIKTOK_API_BASE}/user/info/`, {
    method: 'GET',
    headers: tiktokHeaders(env.TIKTOK_API_KEY),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`TikTok API error ${response.status}: ${errorText}`)
  }

  return response.json()
}

// ============================================================================
// get-scheduled-posts
// ============================================================================

const getScheduledPosts: IntegrationHandler = async (env) => {
  if (!env.TIKTOK_API_KEY) throw new Error('TIKTOK_API_KEY not configured')

  const response = await fetch(`${TIKTOK_API_BASE}/post/scheduled/`, {
    method: 'GET',
    headers: tiktokHeaders(env.TIKTOK_API_KEY),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`TikTok API error ${response.status}: ${errorText}`)
  }

  const data: any = await response.json()
  return { posts: data.posts || data || [] }
}

// ============================================================================
// cancel-scheduled-post
// ============================================================================

const cancelScheduledPost: IntegrationHandler = async (env, body) => {
  if (!env.TIKTOK_API_KEY) throw new Error('TIKTOK_API_KEY not configured')

  const postId = body.postId as string
  if (!postId) throw new Error('postId is required')

  const response = await fetch(
    `${TIKTOK_API_BASE}/post/scheduled/${postId}/cancel/`,
    {
      method: 'POST',
      headers: tiktokHeaders(env.TIKTOK_API_KEY),
    },
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`TikTok API error ${response.status}: ${errorText}`)
  }

  return { message: 'Scheduled post cancelled successfully' }
}

// ============================================================================
// Exports
// ============================================================================

const postVideoSchema = z.object({
  videoUrl: z.string(),
  caption: z.string(),
  privacyLevel: z.string().default('PUBLIC_TO_EVERYONE'),
  hashtags: z.array(z.string()).optional(),
  scheduleTime: z.string().optional(),
})

const userInfoSchema = z.object({})

const getScheduledPostsSchema = z.object({})

const cancelScheduledPostSchema = z.object({
  postId: z.string(),
})

export const endpoints: Record<string, EndpointDefinition> = {
  'tiktok/post-video': {
    handler: postVideo,
    billing: { model: 'per_request', baseCost: 0.05, currency: 'USD' },
    schema: postVideoSchema,
  },
  'tiktok/user-info': {
    handler: getUserInfo,
    billing: { model: 'per_request', baseCost: 0.01, currency: 'USD' },
    schema: userInfoSchema,
  },
  'tiktok/get-scheduled-posts': {
    handler: getScheduledPosts,
    billing: { model: 'per_request', baseCost: 0.01, currency: 'USD' },
    schema: getScheduledPostsSchema,
  },
  'tiktok/cancel-scheduled-post': {
    handler: cancelScheduledPost,
    billing: { model: 'per_request', baseCost: 0.01, currency: 'USD' },
    schema: cancelScheduledPostSchema,
  },
}
