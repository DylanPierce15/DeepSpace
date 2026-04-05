/**
 * OpenAI integration — chat completions and image generation.
 */

import type { IntegrationHandler, EndpointDefinition } from '../_types'

// ============================================================================
// Chat completion
// ============================================================================

const chatCompletion: IntegrationHandler = async (env, body) => {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: body.model || 'gpt-4o',
      messages: body.messages,
      max_tokens: body.max_tokens,
      temperature: body.temperature,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`OpenAI API error ${response.status}: ${errorBody}`)
  }

  return response.json()
}

// ============================================================================
// Image generation — GPT Image models (gpt-image-1, gpt-image-1-mini)
// ============================================================================

type ImageModel = 'gpt-image-1' | 'gpt-image-1-mini'
type ImageSize = '1024x1024' | '1536x1024' | '1024x1536' | 'auto'
type ImageQuality = 'low' | 'medium' | 'high' | 'auto'

const VALID_MODELS: ImageModel[] = ['gpt-image-1', 'gpt-image-1-mini']
const VALID_SIZES: ImageSize[] = ['1024x1024', '1536x1024', '1024x1536', 'auto']
const VALID_QUALITIES: ImageQuality[] = ['low', 'medium', 'high', 'auto']

const generateImage: IntegrationHandler = async (env, body) => {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured')

  const prompt = body.prompt as string
  if (!prompt) throw new Error('prompt is required')

  const model = (body.model as ImageModel) || 'gpt-image-1'
  const n = Math.min(Math.max(Number(body.n) || 1, 1), 4)
  const size = (body.size as ImageSize) || '1024x1024'
  const quality = (body.quality as ImageQuality) || 'auto'

  if (!VALID_MODELS.includes(model)) {
    throw new Error(`model must be one of: ${VALID_MODELS.join(', ')}`)
  }
  if (!VALID_SIZES.includes(size)) {
    throw new Error(`size must be one of: ${VALID_SIZES.join(', ')}`)
  }
  if (!VALID_QUALITIES.includes(quality)) {
    throw new Error(`quality must be one of: ${VALID_QUALITIES.join(', ')}`)
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, prompt, n, size, quality }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`OpenAI API error ${response.status}: ${errorBody}`)
  }

  const data = (await response.json()) as {
    data: Array<{ b64_json?: string; url?: string }>
    usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number }
  }

  // Extract images — GPT Image models return b64_json by default
  const images = (data.data || []).map((img) => {
    if (img.b64_json) return `data:image/png;base64,${img.b64_json}`
    if (img.url) return img.url
    return null
  }).filter((url): url is string => url !== null)

  const usage = data.usage || {}

  return {
    images,
    usage: {
      inputTokens: usage.input_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
      totalTokens: usage.total_tokens ?? 0,
    },
  }
}

// ============================================================================
// Exports
// ============================================================================

export const endpoints: Record<string, EndpointDefinition> = {
  'openai/chat-completion': {
    handler: chatCompletion,
    billing: {
      model: 'per_token',
      baseCost: 0.00003,
      currency: 'USD',
      costModifiers: {
        baseMultipliers: {
          model: {
            'gpt-4o': 1.0,
            'gpt-4o-mini': 0.1,
            'gpt-4.1': 1.0,
            'gpt-4.1-mini': 0.13,
            'gpt-4.1-nano': 0.033,
          },
        },
      },
    },
  },
  'openai/generate-image': {
    handler: generateImage,
    billing: {
      model: 'per_token',
      baseCost: 0,
      currency: 'USD',
      costModifiers: {
        baseMultipliers: {
          model: {
            'gpt-image-1': 1.25,
            'gpt-image-1-mini': 0.3125,
          },
        },
      },
    },
  },
}
