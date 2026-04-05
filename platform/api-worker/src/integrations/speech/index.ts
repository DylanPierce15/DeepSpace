/**
 * Speech integration — OpenAI Text-to-Speech (TTS) and Speech-to-Text (Whisper).
 * Ported from Miyagi3 TextToSpeechService.ts + SpeechToTextService.ts.
 */

import type { IntegrationHandler, EndpointDefinition } from '../_types'

// ============================================================================
// Constants
// ============================================================================

const OPENAI_API_BASE = 'https://api.openai.com/v1'

const VALID_TTS_MODELS = ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts']
const VALID_TTS_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse']
const VALID_TTS_FORMATS = ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm']

const VALID_STT_MODELS = ['whisper-1', 'gpt-4o-transcribe', 'gpt-4o-mini-transcribe']
const VALID_STT_FORMATS = ['json', 'text', 'srt', 'verbose_json', 'vtt']

// ============================================================================
// text-to-speech — POST /v1/audio/speech
// ============================================================================

const textToSpeech: IntegrationHandler = async (env, body) => {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured')

  const input = body.input || body.text
  if (!input || String(input).length === 0) throw new Error('input text is required')
  if (String(input).length > 4096) throw new Error('input must be 4096 characters or less')

  const model = String(body.model || 'tts-1')
  const voice = String(body.voice || 'alloy')
  const response_format = String(body.response_format || 'mp3')
  const speed = Number(body.speed ?? 1.0)

  if (!VALID_TTS_MODELS.includes(model)) {
    throw new Error(`model must be one of: ${VALID_TTS_MODELS.join(', ')}`)
  }
  if (!VALID_TTS_VOICES.includes(voice)) {
    throw new Error(`voice must be one of: ${VALID_TTS_VOICES.join(', ')}`)
  }
  if (!VALID_TTS_FORMATS.includes(response_format)) {
    throw new Error(`response_format must be one of: ${VALID_TTS_FORMATS.join(', ')}`)
  }
  if (speed < 0.25 || speed > 4.0) {
    throw new Error('speed must be between 0.25 and 4.0')
  }

  const response = await fetch(`${OPENAI_API_BASE}/audio/speech`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, voice, input: String(input), response_format, speed }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI TTS API error ${response.status}: ${errorText}`)
  }

  const audioBuffer = await response.arrayBuffer()
  const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)))
  const audioUrl = `data:audio/${response_format};base64,${base64Audio}`

  return { audioUrl, model, voice, response_format }
}

// ============================================================================
// speech-to-text — POST /v1/audio/transcriptions
// ============================================================================

const speechToText: IntegrationHandler = async (env, body) => {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured')

  const audio = body.audio as string
  if (!audio) throw new Error('audio (base64-encoded) is required')

  const model = String(body.model || 'whisper-1')
  const language = body.language as string | undefined
  const prompt = body.prompt as string | undefined
  const response_format = String(body.response_format || 'json')
  const temperature = Number(body.temperature ?? 0)

  if (!VALID_STT_MODELS.includes(model)) {
    throw new Error(`model must be one of: ${VALID_STT_MODELS.join(', ')}`)
  }
  if (!VALID_STT_FORMATS.includes(response_format)) {
    throw new Error(`response_format must be one of: ${VALID_STT_FORMATS.join(', ')}`)
  }
  if (['gpt-4o-transcribe', 'gpt-4o-mini-transcribe'].includes(model) && response_format !== 'json') {
    throw new Error('gpt-4o-transcribe and gpt-4o-mini-transcribe only support json response format')
  }
  if (temperature < 0 || temperature > 1) {
    throw new Error('temperature must be between 0 and 1')
  }
  if (language && !/^[a-z]{2}$/.test(language)) {
    throw new Error('language must be in ISO-639-1 format (e.g. "en", "es", "fr")')
  }

  // Convert base64 audio to a Blob for multipart form data
  const base64Data = audio.replace(/^data:audio\/[^;]+;base64,/, '')
  const binaryString = atob(base64Data)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  const audioBlob = new Blob([bytes], { type: 'audio/wav' })

  const formData = new FormData()
  formData.append('file', audioBlob, 'audio.wav')
  formData.append('model', model)
  if (language) formData.append('language', language)
  if (prompt) formData.append('prompt', prompt)
  formData.append('response_format', response_format)
  formData.append('temperature', String(temperature))

  const response = await fetch(`${OPENAI_API_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI STT API error ${response.status}: ${errorText}`)
  }

  if (response_format === 'json' || response_format === 'verbose_json') {
    const data = await response.json() as Record<string, unknown>
    return { text: data.text, model, language: language || 'auto-detected' }
  }

  // For text, srt, vtt formats return raw text
  const text = await response.text()
  return { text, model, language: language || 'auto-detected' }
}

// ============================================================================
// Exports
// ============================================================================

export const endpoints: Record<string, EndpointDefinition> = {
  'speech/text-to-speech': {
    handler: textToSpeech,
    billing: {
      model: 'per_token',
      baseCost: 0.015,
      currency: 'USD',
      costModifiers: {
        baseMultipliers: {
          model: {
            'tts-1': 1.0,
            'tts-1-hd': 2.0,
            'gpt-4o-mini-tts': 1.5,
          },
        },
        unitCalculation: {
          formula: 'characters / 1000',
          minUnits: 1,
          roundUp: true,
        },
      },
    },
  },
  'speech/speech-to-text': {
    handler: speechToText,
    billing: {
      model: 'per_request',
      baseCost: 0.006,
      currency: 'USD',
      costModifiers: {
        baseMultipliers: {
          model: {
            'whisper-1': 1.0,
            'gpt-4o-transcribe': 1.5,
            'gpt-4o-mini-transcribe': 1.2,
          },
        },
      },
    },
  },
}
