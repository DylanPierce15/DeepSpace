/**
 * useAiComposer — AI-assisted music generation via integration API.
 */

import { useState, useCallback } from 'react'
import { integration } from 'deepspace'
import type { Note } from '../constants'
import { MUSICAL_SCALES } from '../constants'

export type AiMode   = 'chords' | 'melody' | 'drums'
export type AiStatus = 'idle' | 'generating' | 'done' | 'error'

interface AiDrumPattern {
  kick:    number[]
  snare:   number[]
  hihat:   number[]
  openhat: number[]
}

export interface AiResult {
  mode:         AiMode
  description:  string
  notes?:       Note[]
  drumPattern?: boolean[][]
}

function noteId() { return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }

function parseMidiNotes(raw: any[]): Note[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(n => typeof n.midi === 'number' && typeof n.step === 'number')
    .map(n => ({
      id:       noteId(),
      midi:     Math.max(36, Math.min(96, Math.round(n.midi))),
      step:     Math.max(0, Math.round(n.step)),
      duration: Math.max(1, Math.round(n.duration ?? 4)),
      velocity: Math.max(0.1, Math.min(1, n.velocity ?? 0.75)),
    }))
}

function parseDrumPattern(raw: AiDrumPattern): boolean[][] {
  const rows = ['kick', 'snare', 'hihat', 'openhat'] as const
  return rows.map(row => {
    const steps: boolean[] = Array(16).fill(false)
    const indices = raw[row]
    if (Array.isArray(indices)) {
      indices.forEach(i => { if (i >= 0 && i < 16) steps[i] = true })
    }
    return steps
  })
}

const CHORD_PROMPT = (key: string, scale: string, mood: string, bars: number) => `
You are a music theory assistant. Generate a ${bars}-bar chord progression for a ${mood} track.
Key: ${key} ${scale}. Use voicings suitable for a synth pad/piano.

Output ONLY this JSON (no markdown, no explanation):
{
  "description": "one-line description of the chord progression",
  "notes": [
    {"midi": 60, "step": 0, "duration": 8, "velocity": 0.7}
  ]
}

Rules: midi 36-96, step 0-${bars * 16 - 1}, duration in 16th steps 1-${bars * 16}, velocity 0.1-1.0.
Include 3-4 notes per chord. Generate 2-4 chords. Total notes < 20.`.trim()

const MELODY_PROMPT = (key: string, scale: string, mood: string, bars: number, existingNotes: Note[]) => `
You are a music theory assistant. Continue this melody for ${bars} bars.
Key: ${key} ${scale}. Mood: ${mood}.
Existing notes (step/midi/dur): ${existingNotes.slice(0, 16).map(n => `${n.step}:${n.midi}(${n.duration})`).join(', ') || 'none'}

Output ONLY this JSON:
{
  "description": "brief description",
  "notes": [
    {"midi": 64, "step": 0, "duration": 2, "velocity": 0.8}
  ]
}

Rules: midi 48-84, step 0-${bars * 16 - 1}, duration 1-8, velocity 0.5-1.0, max 24 notes. Stay in key.`.trim()

const DRUMS_PROMPT = (genre: string) => `
You are a music production assistant. Generate a 1-bar drum pattern for ${genre}.

Output ONLY this JSON:
{
  "description": "brief description",
  "pattern": {
    "kick":    [0, 8],
    "snare":   [4, 12],
    "hihat":   [0,2,4,6,8,10,12,14],
    "openhat": [6]
  }
}

Rules: Each array has step indices 0-15. Keep it musical and genre-appropriate.`.trim()

export function useAiComposer() {
  const [status,        setStatus]        = useState<AiStatus>('idle')
  const [lastResult,    setLastResult]    = useState<AiResult | null>(null)
  const [pendingResult, setPendingResult] = useState<AiResult | null>(null)
  const [errorMsg,      setErrorMsg]      = useState<string | null>(null)

  const generate = useCallback(async (options: {
    mode:           AiMode
    key?:           string
    scale?:         string
    mood?:          string
    bars?:          number
    genre?:         string
    existingNotes?: Note[]
  }): Promise<AiResult | null> => {
    const {
      mode, key = 'C', scale = 'Major', mood = 'chill',
      bars = 2, genre = 'lo-fi hip-hop', existingNotes = [],
    } = options

    setStatus('generating')
    setErrorMsg(null)
    setPendingResult(null)

    let prompt: string
    if      (mode === 'chords') prompt = CHORD_PROMPT(key, scale, mood, bars)
    else if (mode === 'melody') prompt = MELODY_PROMPT(key, scale, mood, bars, existingNotes)
    else                        prompt = DRUMS_PROMPT(genre)

    try {
      const res = await integration.post('/generate-text', {
        prompt,
        provider: 'anthropic',
        model:    'claude-sonnet-4-6',
      })

      if (!res.success) throw new Error(res.error ?? 'Generation failed')

      let text: string = (res.data as any).text.trim()
      if (text.startsWith('```')) text = text.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim()

      const parsed = JSON.parse(text)

      let result: AiResult

      if (mode === 'drums') {
        result = {
          mode:        'drums',
          description: parsed.description ?? 'AI drum pattern',
          drumPattern: parseDrumPattern(parsed.pattern ?? {}),
        }
      } else {
        result = {
          mode,
          description: parsed.description ?? 'AI composition',
          notes:       parseMidiNotes(parsed.notes ?? []),
        }
      }

      setPendingResult(result)
      setStatus('done')
      return result
    } catch (e: any) {
      setErrorMsg(e.message)
      setStatus('error')
      return null
    }
  }, [])

  const acceptPending = useCallback(() => {
    if (pendingResult) {
      setLastResult(pendingResult)
      setPendingResult(null)
    }
    return pendingResult
  }, [pendingResult])

  const rejectPending = useCallback(() => {
    setPendingResult(null)
    setStatus('idle')
  }, [])

  return {
    status, lastResult, pendingResult, errorMsg,
    generate, acceptPending, rejectPending,
    isGenerating: status === 'generating',
  }
}
