/**
 * Freepik integration — text-to-image, image tools, video, and stock endpoints.
 */

import type { IntegrationHandler, EndpointDefinition } from '../_types'
import { pollForResult } from '../_polling'

// =============================================================================
// Shared helpers
// =============================================================================

/**
 * Simple Freepik POST handler — fires and returns the immediate response.
 */
function createFreepikHandler(apiUrl: string): IntegrationHandler {
  return async (env, body) => {
    if (!env.FREEPIK_API_KEY) throw new Error('FREEPIK_API_KEY not configured')

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'x-freepik-api-key': env.FREEPIK_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Freepik API error ${response.status}: ${errorBody}`)
    }

    return response.json()
  }
}

/**
 * Async Freepik image model handler — POSTs to create a task,
 * then polls the text-to-image status endpoint until COMPLETED.
 */
function createAsyncImageHandler(apiPath: string): IntegrationHandler {
  return async (env, body) => {
    if (!env.FREEPIK_API_KEY) throw new Error('FREEPIK_API_KEY not configured')

    const apiUrl = `https://api.freepik.com/v1/ai/${apiPath}`
    const headers: Record<string, string> = {
      'x-freepik-api-key': env.FREEPIK_API_KEY,
      'Content-Type': 'application/json',
    }

    // Create the task
    const createResponse = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!createResponse.ok) {
      const errorBody = await createResponse.text()
      throw new Error(`Freepik API error ${createResponse.status}: ${errorBody}`)
    }

    const createData = (await createResponse.json()) as Record<string, unknown>
    const taskId = (createData.data as Record<string, unknown>)?.task_id as string

    if (!taskId) {
      throw new Error('No task ID returned from Freepik API')
    }

    // Poll for completion via the text-to-image status endpoint
    const statusUrl = `https://api.freepik.com/v1/ai/text-to-image/${taskId}`

    const result = await pollForResult({
      statusUrl,
      headers: { 'x-freepik-api-key': env.FREEPIK_API_KEY },
      maxAttempts: 30,
      pollInterval: 5000,
      initialDelay: 3000,
      extractResult: (data: any) => ({
        taskId,
        status: 'COMPLETED',
        generated: data?.data?.generated || [],
      }),
    })

    if (!result.success) {
      throw new Error(result.error || 'Image generation failed')
    }

    return result.data
  }
}

/**
 * Async Freepik handler for non-image endpoints (custom status URL pattern).
 */
function createAsyncFreepikHandler(
  createUrl: string,
  statusUrlTemplate: string,
  opts?: { maxAttempts?: number; pollInterval?: number; initialDelay?: number },
): IntegrationHandler {
  return async (env, body) => {
    if (!env.FREEPIK_API_KEY) throw new Error('FREEPIK_API_KEY not configured')

    const headers: Record<string, string> = {
      'x-freepik-api-key': env.FREEPIK_API_KEY,
      'Content-Type': 'application/json',
    }

    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!createResponse.ok) {
      const errorBody = await createResponse.text()
      throw new Error(`Freepik API error ${createResponse.status}: ${errorBody}`)
    }

    const createData = (await createResponse.json()) as Record<string, unknown>
    const taskId = (createData.data as Record<string, unknown>)?.task_id as string

    if (!taskId) {
      throw new Error('No task ID returned from Freepik API')
    }

    const statusUrl = statusUrlTemplate.replace('{task_id}', taskId)

    const result = await pollForResult({
      statusUrl,
      headers: { 'x-freepik-api-key': env.FREEPIK_API_KEY },
      maxAttempts: opts?.maxAttempts ?? 30,
      pollInterval: opts?.pollInterval ?? 5000,
      initialDelay: opts?.initialDelay ?? 3000,
      extractResult: (data: any) => ({
        taskId,
        status: 'COMPLETED',
        generated: data?.data?.generated || [],
      }),
    })

    if (!result.success) {
      throw new Error(result.error || 'Task failed')
    }

    return result.data
  }
}

/**
 * Freepik form-data POST handler (for endpoints that require form-urlencoded).
 */
function createFreepikFormHandler(apiUrl: string): IntegrationHandler {
  return async (env, body) => {
    if (!env.FREEPIK_API_KEY) throw new Error('FREEPIK_API_KEY not configured')

    const formData = new URLSearchParams()
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined && v !== null) formData.append(k, String(v))
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'x-freepik-api-key': env.FREEPIK_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Freepik API error ${response.status}: ${errorBody}`)
    }

    return response.json()
  }
}

/**
 * Freepik GET handler — for search/download endpoints.
 */
function createFreepikGetHandler(baseUrl: string): IntegrationHandler {
  return async (env, body) => {
    if (!env.FREEPIK_API_KEY) throw new Error('FREEPIK_API_KEY not configured')

    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined && v !== null) params.set(k, String(v))
    }

    const url = params.toString() ? `${baseUrl}?${params}` : baseUrl
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'x-freepik-api-key': env.FREEPIK_API_KEY },
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Freepik API error ${response.status}: ${errorBody}`)
    }

    return response.json()
  }
}

// =============================================================================
// Stock download handlers
// =============================================================================

const downloadIcons: IntegrationHandler = async (env, body) => {
  if (!env.FREEPIK_API_KEY) throw new Error('FREEPIK_API_KEY not configured')

  const iconId = body.id as number
  if (!iconId) throw new Error('id is required')

  const response = await fetch(`https://api.freepik.com/v1/icons/${iconId}/download`, {
    method: 'GET',
    headers: { 'x-freepik-api-key': env.FREEPIK_API_KEY },
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Freepik API error ${response.status}: ${errorBody}`)
  }

  return response.json()
}

const downloadStockImages: IntegrationHandler = async (env, body) => {
  if (!env.FREEPIK_API_KEY) throw new Error('FREEPIK_API_KEY not configured')

  const resourceId = body.id as number
  if (!resourceId) throw new Error('id is required')

  const url = new URL(`https://api.freepik.com/v1/resources/${resourceId}/download`)
  if (body.image_size) url.searchParams.set('image_size', String(body.image_size))

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'x-freepik-api-key': env.FREEPIK_API_KEY },
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Freepik API error ${response.status}: ${errorBody}`)
  }

  return response.json()
}

const downloadStockVideos: IntegrationHandler = async (env, body) => {
  if (!env.FREEPIK_API_KEY) throw new Error('FREEPIK_API_KEY not configured')

  const videoId = body.id as number
  if (!videoId) throw new Error('id is required')

  const response = await fetch(`https://api.freepik.com/v1/videos/${videoId}/download`, {
    method: 'GET',
    headers: { 'x-freepik-api-key': env.FREEPIK_API_KEY },
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Freepik API error ${response.status}: ${errorBody}`)
  }

  return response.json()
}

// =============================================================================
// Video handler (image-to-video with longer polling)
// =============================================================================

const generateVideo = createAsyncFreepikHandler(
  'https://api.freepik.com/v1/ai/image-to-video/seedance-pro-480p',
  'https://api.freepik.com/v1/ai/image-to-video/seedance-pro-480p/{task_id}',
  { maxAttempts: 60, pollInterval: 10000, initialDelay: 10000 },
)

// =============================================================================
// Image tools — async handlers with custom status URLs
// =============================================================================

const removeBackground = createFreepikFormHandler(
  'https://api.freepik.com/v1/ai/beta/remove-background',
)

const upscaleImagePrecision = createAsyncFreepikHandler(
  'https://api.freepik.com/v1/ai/image-upscaler-precision',
  'https://api.freepik.com/v1/ai/image-upscaler-precision/{task_id}',
  { maxAttempts: 30, pollInterval: 10000, initialDelay: 5000 },
)

const imageRelight = createAsyncFreepikHandler(
  'https://api.freepik.com/v1/ai/image-relight',
  'https://api.freepik.com/v1/ai/image-relight/{task_id}',
  { maxAttempts: 30, pollInterval: 5000, initialDelay: 3000 },
)

const imageStyleTransfer = createAsyncFreepikHandler(
  'https://api.freepik.com/v1/ai/image-style-transfer',
  'https://api.freepik.com/v1/ai/image-style-transfer/{task_id}',
  { maxAttempts: 30, pollInterval: 5000, initialDelay: 3000 },
)

const imageExpand = createAsyncFreepikHandler(
  'https://api.freepik.com/v1/ai/image-expand',
  'https://api.freepik.com/v1/ai/image-expand/{task_id}',
  { maxAttempts: 30, pollInterval: 5000, initialDelay: 3000 },
)

// =============================================================================
// Endpoint registry
// =============================================================================

export const endpoints: Record<string, EndpointDefinition> = {
  // ---- Existing synchronous image endpoints ----
  'freepik/text-to-image-classic': {
    handler: createFreepikHandler('https://api.freepik.com/v1/ai/text-to-image'),
    billing: {
      model: 'per_request',
      baseCost: 0.005,
      currency: 'USD',
      costModifiers: { unitCalculation: { formula: 'num_images', minUnits: 1, roundUp: false } },
    },
  },
  'freepik/generate-image-mystic': {
    handler: createFreepikHandler('https://api.freepik.com/v1/ai/mystic'),
    billing: {
      model: 'per_request',
      baseCost: 0.069,
      currency: 'USD',
      costModifiers: {
        baseMultipliers: { resolution: { '1k': 1.0, '2k': 1.72464, '4k': 5.50725 } },
      },
    },
  },
  'freepik/generate-image-flux-dev': {
    handler: createFreepikHandler('https://api.freepik.com/v1/ai/flux-dev'),
    billing: { model: 'per_request', baseCost: 0.012, currency: 'USD' },
  },

  // ---- Async image generation models ----
  'freepik/generate-image-flux-pro': {
    handler: createAsyncImageHandler('text-to-image/flux-pro-v1-1'),
    billing: { model: 'per_request', baseCost: 0.043, currency: 'USD' },
  },
  'freepik/generate-image-flux-2-pro': {
    handler: createAsyncImageHandler('text-to-image/flux-2-pro'),
    billing: { model: 'per_request', baseCost: 0.036, currency: 'USD' },
  },
  'freepik/generate-image-flux-2-turbo': {
    handler: createAsyncImageHandler('text-to-image/flux-2-turbo'),
    billing: { model: 'per_request', baseCost: 0.01, currency: 'USD' },
  },
  'freepik/generate-image-hyperflux': {
    handler: createAsyncImageHandler('text-to-image/hyperflux'),
    billing: { model: 'per_request', baseCost: 0.161, currency: 'USD' },
  },
  'freepik/generate-image-seedream': {
    handler: createAsyncImageHandler('text-to-image/seedream'),
    billing: { model: 'per_request', baseCost: 0.032, currency: 'USD' },
  },
  'freepik/generate-image-seedream-v4': {
    handler: createAsyncImageHandler('text-to-image/seedream-v4'),
    billing: { model: 'per_request', baseCost: 0.032, currency: 'USD' },
  },
  'freepik/generate-image-seedream-v4-5': {
    handler: createAsyncImageHandler('text-to-image/seedream-v4-5'),
    billing: { model: 'per_request', baseCost: 0.04, currency: 'USD' },
  },
  'freepik/generate-image-z-image': {
    handler: createAsyncImageHandler('text-to-image/z-image'),
    billing: { model: 'per_request', baseCost: 0.02, currency: 'USD' },
  },
  'freepik/generate-image-runway': {
    handler: createAsyncImageHandler('text-to-image/runway'),
    billing: { model: 'per_request', baseCost: 0.10, currency: 'USD' },
  },

  // ---- Image tools ----
  'freepik/remove-background': {
    handler: removeBackground,
    billing: { model: 'per_request', baseCost: 0.02, currency: 'EUR' },
  },
  'freepik/upscale-image-precision': {
    handler: upscaleImagePrecision,
    billing: {
      model: 'per_request',
      baseCost: 0.10,
      currency: 'EUR',
      costModifiers: {
        baseMultipliers: {
          target_resolution: {
            '1k-2k': 1.0,
            '2k-4k': 2.0,
            '4k-8k': 4.0,
            '5k-10k': 6.0,
          },
        },
      },
    },
  },
  'freepik/image-relight': {
    handler: imageRelight,
    billing: { model: 'per_request', baseCost: 0.10, currency: 'EUR' },
  },
  'freepik/image-style-transfer': {
    handler: imageStyleTransfer,
    billing: { model: 'per_request', baseCost: 0.10, currency: 'EUR' },
  },
  'freepik/image-expand': {
    handler: imageExpand,
    billing: { model: 'per_request', baseCost: 0.07, currency: 'EUR' },
  },

  // ---- Video ----
  'freepik/generate-video': {
    handler: generateVideo,
    billing: { model: 'per_second', baseCost: 0.022, currency: 'EUR' },
  },

  // ---- Stock / Downloads ----
  'freepik/download-icons': {
    handler: downloadIcons,
    billing: { model: 'per_request', baseCost: 0.01, currency: 'EUR' },
  },
  'freepik/download-stock-images': {
    handler: downloadStockImages,
    billing: { model: 'per_request', baseCost: 0.04, currency: 'EUR' },
  },
  'freepik/download-stock-videos': {
    handler: downloadStockVideos,
    billing: { model: 'per_request', baseCost: 0.06, currency: 'EUR' },
  },
}
