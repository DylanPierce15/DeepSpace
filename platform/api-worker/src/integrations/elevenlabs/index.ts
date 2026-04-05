/**
 * ElevenLabs integration — text-to-speech and voice listing.
 * Ported from Miyagi3 ElevenLabsTextToSpeechService.ts.
 */

import type { IntegrationHandler, EndpointDefinition } from '../_types'

// ============================================================================
// Constants
// ============================================================================

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1'

/** Default voice: George — warm, captivating storyteller */
const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'

const VALID_MODELS = [
  'eleven_v3',
  'eleven_multilingual_v2',
  'eleven_flash_v2_5',
  'eleven_flash_v2',
  'eleven_turbo_v2_5',
  'eleven_turbo_v2',
]

const VALID_OUTPUT_FORMATS = [
  'mp3_22050_32', 'mp3_44100_64', 'mp3_44100_96', 'mp3_44100_128', 'mp3_44100_192',
  'pcm_16000', 'pcm_22050', 'pcm_24000', 'pcm_44100',
]

// ============================================================================
// Helpers
// ============================================================================

function elevenlabsHeaders(apiKey: string) {
  return {
    'xi-api-key': apiKey,
    'Content-Type': 'application/json',
  }
}

// ============================================================================
// list-voices — GET /v1/voices
// ============================================================================

const listVoices: IntegrationHandler = async (env) => {
  if (!env.ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY not configured')

  const headers = { 'xi-api-key': env.ELEVENLABS_API_KEY }

  const response = await fetch(`${ELEVENLABS_API_BASE}/voices?show_legacy=false`, {
    method: 'GET',
    headers,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`ElevenLabs API error ${response.status}: ${errorText}`)
  }

  const data = await response.json() as { voices: Array<Record<string, unknown>> }

  const voices = (data.voices || []).map(v => {
    const labels = (v.labels as Record<string, string>) || {}
    return {
      voice_id: v.voice_id as string,
      name: v.name as string,
      category: v.category as string,
      gender: labels.gender || '',
      age: labels.age || '',
      accent: labels.accent || '',
      description: (v.description as string) || '',
      use_case: labels.use_case || '',
      preview_url: (v.preview_url as string) || null,
    }
  })

  return { voices }
}

// ============================================================================
// generate-speech — POST /v1/text-to-speech/{voice_id}
// ============================================================================

const generateSpeech: IntegrationHandler = async (env, body) => {
  if (!env.ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY not configured')

  const text = body.text as string
  if (!text || text.length === 0) throw new Error('text is required')
  if (text.length > 5000) throw new Error('text must be 5000 characters or less')

  const voice_id = String(body.voice_id || DEFAULT_VOICE_ID)
  const model_id = String(body.model_id || 'eleven_flash_v2_5')
  const output_format = String(body.output_format || 'mp3_44100_128')
  const voice_settings = body.voice_settings as {
    stability?: number
    similarity_boost?: number
    style?: number
    use_speaker_boost?: boolean
  } | undefined

  if (!VALID_MODELS.includes(model_id)) {
    throw new Error(`model_id must be one of: ${VALID_MODELS.join(', ')}`)
  }
  if (!VALID_OUTPUT_FORMATS.includes(output_format)) {
    throw new Error(`output_format must be one of: ${VALID_OUTPUT_FORMATS.join(', ')}`)
  }

  const requestBody: Record<string, unknown> = { text, model_id }

  if (voice_settings) {
    requestBody.voice_settings = {
      stability: voice_settings.stability ?? 0.5,
      similarity_boost: voice_settings.similarity_boost ?? 0.75,
      style: voice_settings.style ?? 0,
      use_speaker_boost: voice_settings.use_speaker_boost ?? true,
    }
  }

  const response = await fetch(
    `${ELEVENLABS_API_BASE}/text-to-speech/${voice_id}?output_format=${output_format}`,
    {
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg',
        ...elevenlabsHeaders(env.ELEVENLABS_API_KEY),
      },
      body: JSON.stringify(requestBody),
    },
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`ElevenLabs API error ${response.status}: ${errorText}`)
  }

  const audioBuffer = await response.arrayBuffer()
  const mimeType = output_format.startsWith('mp3') ? 'audio/mpeg' : 'audio/wav'
  const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)))
  const audioUrl = `data:${mimeType};base64,${base64Audio}`

  return { audioUrl, voice_id, model_id, output_format }
}

// ============================================================================
// Exports
// ============================================================================

export const endpoints: Record<string, EndpointDefinition> = {
  'elevenlabs/list-voices': {
    handler: listVoices,
    billing: { model: 'per_request', baseCost: 0.001, currency: 'USD' },
  },
  'elevenlabs/generate-speech': {
    handler: generateSpeech,
    billing: { model: 'per_request', baseCost: 0.01, currency: 'USD' },
  },
}
