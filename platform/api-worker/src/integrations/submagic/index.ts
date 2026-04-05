/**
 * SubMagic integration -- AI-powered subtitle/caption generation for videos.
 * Ported from Miyagi3 SubMagicService.ts.
 *
 * Workflow:
 * 1. create-video: Submit a video URL for processing. Returns a projectId.
 * 2. get-project: Check project status / retrieve result.
 * 3. wait-for-completion: Submit + poll until the project finishes.
 *
 * SubMagic API docs: https://docs.submagic.co/api-reference/create-project
 */

import type { IntegrationHandler, EndpointDefinition } from '../_types'
import { pollForResult } from '../_polling'

// ============================================================================
// Constants
// ============================================================================

const SUBMAGIC_API_BASE = 'https://api.submagic.co/v1'

function submagicHeaders(apiKey: string) {
  return {
    'x-api-key': apiKey,
    'Content-Type': 'application/json',
  }
}

// ============================================================================
// create-video -- POST /v1/projects
// ============================================================================

const createVideo: IntegrationHandler = async (env, body) => {
  if (!env.SUBMAGIC_API_KEY) throw new Error('SUBMAGIC_API_KEY not configured')

  const title = body.title as string
  if (!title) throw new Error('title is required')
  const language = body.language as string
  if (!language) throw new Error('language is required')
  const videoUrl = body.videoUrl as string
  if (!videoUrl) throw new Error('videoUrl is required')

  const requestBody: Record<string, unknown> = {
    title,
    language,
    videoUrl,
  }

  if (body.templateName) requestBody.templateName = body.templateName
  if (body.userThemeId) requestBody.userThemeId = body.userThemeId
  if (body.dictionary) requestBody.dictionary = body.dictionary
  if (body.magicZooms !== undefined) requestBody.magicZooms = body.magicZooms
  if (body.magicBrolls !== undefined) requestBody.magicBrolls = body.magicBrolls
  if (body.magicBrollsPercentage !== undefined) {
    requestBody.magicBrollsPercentage = body.magicBrollsPercentage
  }

  const response = await fetch(`${SUBMAGIC_API_BASE}/projects`, {
    method: 'POST',
    headers: submagicHeaders(env.SUBMAGIC_API_KEY),
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`SubMagic API error ${response.status}: ${errorText}`)
  }

  const data: any = await response.json()

  return {
    projectId: data.id,
    status: data.status,
    message: 'Video processing started. Poll get-project for completion.',
  }
}

// ============================================================================
// get-project -- GET /v1/projects/:projectId
// ============================================================================

const getProject: IntegrationHandler = async (env, body) => {
  if (!env.SUBMAGIC_API_KEY) throw new Error('SUBMAGIC_API_KEY not configured')

  const projectId = body.projectId as string
  if (!projectId) throw new Error('projectId is required')

  const response = await fetch(`${SUBMAGIC_API_BASE}/projects/${projectId}`, {
    method: 'GET',
    headers: submagicHeaders(env.SUBMAGIC_API_KEY),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`SubMagic API error ${response.status}: ${errorText}`)
  }

  return response.json()
}

// ============================================================================
// wait-for-completion -- create + poll
// ============================================================================

const waitForCompletion: IntegrationHandler = async (env, body) => {
  if (!env.SUBMAGIC_API_KEY) throw new Error('SUBMAGIC_API_KEY not configured')

  const projectId = body.projectId as string
  if (!projectId) throw new Error('projectId is required')

  const maxAttempts = (body.maxAttempts as number) || 30
  const pollInterval = (body.pollInterval as number) || 10000

  const result = await pollForResult({
    statusUrl: `${SUBMAGIC_API_BASE}/projects/${projectId}`,
    headers: submagicHeaders(env.SUBMAGIC_API_KEY),
    maxAttempts,
    pollInterval,
    initialDelay: 5000,
    completedStatuses: ['completed'],
    failedStatuses: ['failed', 'error'],
  })

  if (!result.success) {
    throw new Error(result.error || 'SubMagic polling failed')
  }

  return result.data
}

// ============================================================================
// Exports
// ============================================================================

export const endpoints: Record<string, EndpointDefinition> = {
  'submagic/create-video': {
    handler: createVideo,
    billing: { model: 'per_request', baseCost: 0.15, currency: 'USD' },
  },
  'submagic/get-project': {
    handler: getProject,
    billing: { model: 'per_request', baseCost: 0.01, currency: 'USD' },
  },
  'submagic/wait-for-completion': {
    handler: waitForCompletion,
    billing: { model: 'per_request', baseCost: 0.15, currency: 'USD' },
  },
}
