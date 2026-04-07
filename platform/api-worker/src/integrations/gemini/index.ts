/**
 * Gemini integration — image generation via REST API (no SDK).
 */

import { z } from 'zod'
import type { IntegrationHandler, EndpointDefinition } from '../_types'

const generateImage: IntegrationHandler = async (env, body) => {
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured')

  const prompt = body.prompt as string
  if (!prompt) throw new Error('prompt is required')

  const model = (body.model as string) || 'gemini-2.5-flash-image'

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`

  const generationConfig: Record<string, unknown> = {
    responseModalities: ['TEXT', 'IMAGE'],
  }

  // Optional image config
  if (body.aspectRatio || body.imageSize) {
    const imageConfig: Record<string, string> = {}
    if (body.aspectRatio) imageConfig.aspectRatio = String(body.aspectRatio)
    if (body.imageSize) imageConfig.imageSize = String(body.imageSize)
    generationConfig.imageConfig = imageConfig
  }

  if (body.temperature !== undefined) generationConfig.temperature = body.temperature
  if (body.maxOutputTokens !== undefined) generationConfig.maxOutputTokens = body.maxOutputTokens

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig,
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${errorBody}`)
  }

  const data = (await response.json()) as Record<string, unknown>

  // Extract images and text from candidates
  const candidates = (data.candidates as Array<Record<string, unknown>>) || []
  const parts = ((candidates[0]?.content as Record<string, unknown>)?.parts as Array<Record<string, unknown>>) || []

  const base64Images: string[] = []
  const textParts: string[] = []

  for (const part of parts) {
    if (part.text) {
      textParts.push(part.text as string)
    } else if (part.inlineData) {
      const inlineData = part.inlineData as Record<string, string>
      const mimeType = inlineData.mimeType || 'image/png'
      base64Images.push(`data:${mimeType};base64,${inlineData.data}`)
    }
  }

  // Extract usage metadata
  const usage = data.usageMetadata as Record<string, number> | undefined
  const inputTokens = usage?.promptTokenCount ?? 0
  const outputTokens = usage?.candidatesTokenCount ?? 0
  const totalTokens = usage?.totalTokenCount ?? inputTokens + outputTokens

  return {
    base64Images,
    text: textParts.length > 0 ? textParts.join('\n') : undefined,
    usage: { inputTokens, outputTokens, totalTokens },
    model,
  }
}

const generateImageSchema = z.object({
  prompt: z.string(),
  model: z.string().default('gemini-2.5-flash-image'),
  aspectRatio: z.string().optional(),
  imageSize: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().min(1).optional(),
})

export const endpoints: Record<string, EndpointDefinition> = {
  'gemini/generate-image': {
    handler: generateImage,
    billing: { model: 'per_token', baseCost: 0, currency: 'USD' },
    schema: generateImageSchema,
  },
}
