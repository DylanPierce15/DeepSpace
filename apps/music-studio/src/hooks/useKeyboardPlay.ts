/**
 * useKeyboardPlay — QWERTY keyboard → live note input + step recording.
 *
 * Key layout mirrors a piano keyboard:
 *   Row 2 (white keys): a s d f g h j k l   → C4 D4 E4 F4 G4 A4 B4 C5 D5
 *   Row 1 (black keys):  w e   t y u   o p  → C#4 D#4 F#4 G#4 A#4 C#5 D#5
 *   Z / X = octave down / up
 *
 * TWO modes depending on transport state:
 *
 *   STEP INPUT (transport stopped, piano roll open):
 *     Keydown  → place note at keyInputStep, advance cursor by quantizeSteps
 *     Backspace → back up cursor by quantizeSteps (undo last placement visually)
 *     The cursor wraps at the clip end.
 *
 *   LIVE RECORDING (transport playing, piano roll open):
 *     Keydown  → preview note, record startStep
 *     Keyup    → add note with duration = steps held
 */

import { useEffect, useRef, useCallback } from 'react'
import { useStudio } from './useStudio'
import type { Note } from '../constants'

const KEY_MAP: Record<string, number> = {
  'a': 0, 's': 2, 'd': 4, 'f': 5, 'g': 7, 'h': 9, 'j': 11,
  'k': 12, 'l': 14,
  'w': 1, 'e': 3, 't': 6, 'y': 8, 'u': 10, 'o': 13, 'p': 15,
}

const BASE_MIDI = 60   // C4

function noteId() { return `kb-${Date.now()}-${Math.random().toString(36).slice(2,6)}` }

export function useKeyboardPlay() {
  const { state, dispatch, addNoteToClip, previewNoteRef } = useStudio()
  const octaveRef  = useRef(0)
  const activeKeys = useRef<Map<string, { midi: number; startStep: number; startTime: number }>>(new Map())

  const enabled = state.keyboardMode && state.pianoRollOpen && !!state.pianoRollTrackId

  const getClip = useCallback(() => {
    if (!state.pianoRollTrackId) return null
    const track = state.tracks.find(t => t.id === state.pianoRollTrackId)
    if (!track || !state.pianoRollClipId) return null
    return track.clips?.find(c => c.id === state.pianoRollClipId) ?? null
  }, [state.pianoRollTrackId, state.pianoRollClipId, state.tracks])

  useEffect(() => {
    if (!enabled) return

    const handleDown = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if ((e.target as HTMLElement).tagName === 'INPUT') return

      // Octave shift
      if (e.key === 'z') { octaveRef.current = Math.max(-24, octaveRef.current - 12); return }
      if (e.key === 'x') { octaveRef.current = Math.min(24,  octaveRef.current + 12); return }

      // Step-input: Backspace backs up the cursor
      if (e.key === 'Backspace') {
        e.preventDefault()
        if (!state.isPlaying) {
          const clip = getClip()
          if (!clip) return
          const clipSteps = clip.lengthBars * 16
          const prev = ((state.keyInputStep - state.quantizeSteps) % clipSteps + clipSteps) % clipSteps
          dispatch({ type: 'SET_KEY_INPUT_STEP', step: prev })
        }
        return
      }

      const offset = KEY_MAP[e.key.toLowerCase()]
      if (offset === undefined || activeKeys.current.has(e.key)) return

      const midi = BASE_MIDI + offset + octaveRef.current
      if (midi < 36 || midi > 96) return

      previewNoteRef.current(midi)
      activeKeys.current.set(e.key, {
        midi,
        startStep: state.currentStep,
        startTime: Date.now(),
      })

      // ── STEP INPUT (transport stopped) ────────────────────────────────
      if (!state.isPlaying) {
        const clip = getClip()
        if (!clip || !state.pianoRollTrackId || !state.pianoRollClipId) return

        const clipSteps = clip.lengthBars * 16
        const step      = state.keyInputStep % clipSteps
        const duration  = state.quantizeSteps

        const note: Note = {
          id:       noteId(),
          midi,
          step,
          duration: Math.max(1, Math.min(duration, clipSteps - step)),
          velocity: 0.8,
        }
        addNoteToClip(state.pianoRollTrackId, state.pianoRollClipId, note)

        // Advance cursor — wrap at clip end
        const next = (step + duration) % clipSteps
        dispatch({ type: 'SET_KEY_INPUT_STEP', step: next })
      }
    }

    const handleUp = (e: KeyboardEvent) => {
      const active = activeKeys.current.get(e.key)
      if (!active) return
      activeKeys.current.delete(e.key)

      // ── LIVE RECORDING (transport playing) ────────────────────────────
      if (!state.isPlaying) return   // step-input already handled in keydown

      const clip = getClip()
      if (!clip || !state.pianoRollTrackId || !state.pianoRollClipId) return

      const clipSteps  = clip.lengthBars * 16
      const clipStart  = clip.startBar * 16
      const localStep  = Math.max(0, Math.min(clipSteps - 1, active.startStep - clipStart))
      const duration   = Math.max(1, Math.min(
        state.currentStep - active.startStep,
        clipSteps - localStep,
      ))

      addNoteToClip(state.pianoRollTrackId, state.pianoRollClipId, {
        id:       noteId(),
        midi:     active.midi,
        step:     localStep,
        duration: Math.max(1, duration),
        velocity: 0.8,
      })
    }

    window.addEventListener('keydown', handleDown)
    window.addEventListener('keyup',   handleUp)
    return () => {
      window.removeEventListener('keydown', handleDown)
      window.removeEventListener('keyup',   handleUp)
    }
  }, [
    enabled, state.currentStep, state.isPlaying, state.bpm,
    state.pianoRollTrackId, state.pianoRollClipId,
    state.keyInputStep, state.quantizeSteps,
    addNoteToClip, previewNoteRef, getClip, dispatch,
  ])

  return { octave: octaveRef.current }
}
