/**
 * Studio Context + Provider
 *
 * New in this version:
 *   - Undo/Redo history (50-entry cap). Discrete actions push immediately;
 *     slider/step actions debounce at 400 ms via Date.now() in the reducer.
 *   - Drum-clip system: each drum track holds DrumClip[] + activeDrumClipId.
 *   - Migration: LOAD_PROJECT auto-converts legacy `track.pattern` → DrumClip.
 */

import React, { createContext, useReducer, useCallback, useRef } from 'react'
import {
  Track, Note, Clip, DrumClip, SynthSettings,
  DEFAULT_BPM, DRUM_ROW_COUNT, BARS,
} from '../constants'

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_HISTORY      = 50
const HISTORY_DEBOUNCE = 400  // ms

const DISCRETE_HISTORY = new Set([
  'ADD_NOTE', 'REMOVE_NOTE', 'UPDATE_NOTE',
  'ADD_NOTE_TO_CLIP', 'REMOVE_NOTE_FROM_CLIP', 'REPLACE_CLIP_NOTES',
  'ADD_CLIP', 'REMOVE_CLIP', 'DUPLICATE_CLIP',
  'ADD_DRUM_CLIP', 'REMOVE_DRUM_CLIP', 'DUPLICATE_DRUM_CLIP',
  'ADD_TRACK', 'REMOVE_TRACK', 'DUPLICATE_TRACK', 'REORDER_TRACKS',
])

const DEBOUNCED_HISTORY = new Set([
  'TOGGLE_DRUM_STEP', 'TOGGLE_DRUM_CLIP_STEP',
  'UPDATE_TRACK', 'UPDATE_INSTRUMENT',
])

// ── Migration ─────────────────────────────────────────────────────────────────

function migrateDrumTrack(track: Track): Track {
  if (track.type !== 'drums') return track
  if (track.drumClips?.length) return track
  const pattern = track.pattern ?? Array.from({ length: DRUM_ROW_COUNT }, () => Array(16).fill(false))
  const clip: DrumClip = {
    id: `drumclip-${track.id}-migrated`,
    name: 'Pattern 1',
    startBar: 0,
    lengthBars: BARS,
    pattern: pattern.map(row => row.slice(0, 16)),
  }
  return { ...track, drumClips: [clip], activeDrumClipId: clip.id }
}

// ── State ─────────────────────────────────────────────────────────────────────

export interface StudioState {
  bpm: number; isPlaying: boolean; currentStep: number; loopEnabled: boolean
  tracks: Track[]; activeTrackId: string | null; activeClipId: string | null
  pianoRollOpen: boolean; pianoRollTrackId: string | null; pianoRollClipId: string | null
  drumEditorOpen: boolean; drumEditorTrackId: string | null; drumEditorClipId: string | null
  selectedNoteIds: string[]
  quantizeSteps: number; activeScale: string; timelineZoom: 1 | 2 | 4; keyboardMode: boolean
  keyInputStep: number
  projectName: string; savedProjectId: string | null; isDirty: boolean
  history: Track[][]; future: Track[][]; lastHistoryPushMs: number
}

function freshState(): StudioState {
  return {
    bpm: DEFAULT_BPM, isPlaying: false, currentStep: 0, loopEnabled: true,
    tracks: [], activeTrackId: null, activeClipId: null,
    pianoRollOpen: false, pianoRollTrackId: null, pianoRollClipId: null,
    drumEditorOpen: false, drumEditorTrackId: null, drumEditorClipId: null,
    selectedNoteIds: [], quantizeSteps: 4, activeScale: 'None',
    timelineZoom: 1, keyboardMode: false, keyInputStep: 0,
    projectName: 'Untitled Project', savedProjectId: null, isDirty: false,
    history: [], future: [], lastHistoryPushMs: 0,
  }
}

// ── Actions ───────────────────────────────────────────────────────────────────

export type Action =
  | { type: 'SET_BPM'; bpm: number }
  | { type: 'SET_PLAYING'; isPlaying: boolean }
  | { type: 'SET_STEP'; step: number }
  | { type: 'TOGGLE_LOOP' }
  | { type: 'SET_ACTIVE_TRACK'; trackId: string | null }
  | { type: 'ADD_TRACK'; track: Track }
  | { type: 'REMOVE_TRACK'; trackId: string }
  | { type: 'UPDATE_TRACK'; trackId: string; updates: Partial<Track> }
  | { type: 'UPDATE_INSTRUMENT'; trackId: string; settings: Partial<SynthSettings> }
  | { type: 'ADD_NOTE'; trackId: string; note: Note }
  | { type: 'REMOVE_NOTE'; trackId: string; noteId: string }
  | { type: 'UPDATE_NOTE'; trackId: string; noteId: string; updates: Partial<Note> }
  | { type: 'TOGGLE_DRUM_STEP'; trackId: string; row: number; step: number }
  | { type: 'SET_DRUM_ROW_VOLUME'; trackId: string; row: number; volume: number }
  | { type: 'SET_DRUM_STEP_VELOCITY'; trackId: string; row: number; step: number; velocity: number }
  | { type: 'SET_ACTIVE_CLIP'; clipId: string | null }
  | { type: 'ADD_CLIP'; trackId: string; clip: Clip }
  | { type: 'REMOVE_CLIP'; trackId: string; clipId: string }
  | { type: 'UPDATE_CLIP'; trackId: string; clipId: string; updates: Partial<Omit<Clip,'notes'>> }
  | { type: 'DUPLICATE_CLIP'; trackId: string; clipId: string }
  | { type: 'ADD_NOTE_TO_CLIP'; trackId: string; clipId: string; note: Note }
  | { type: 'REMOVE_NOTE_FROM_CLIP'; trackId: string; clipId: string; noteId: string }
  | { type: 'REPLACE_CLIP_NOTES'; trackId: string; clipId: string; notes: Note[] }
  | { type: 'ADD_DRUM_CLIP'; trackId: string; clip: DrumClip }
  | { type: 'REMOVE_DRUM_CLIP'; trackId: string; clipId: string }
  | { type: 'UPDATE_DRUM_CLIP'; trackId: string; clipId: string; updates: Partial<Omit<DrumClip,'pattern'>> }
  | { type: 'DUPLICATE_DRUM_CLIP'; trackId: string; clipId: string }
  | { type: 'SET_ACTIVE_DRUM_CLIP'; trackId: string; clipId: string | null }
  | { type: 'TOGGLE_DRUM_CLIP_STEP'; trackId: string; clipId: string; row: number; step: number }
  | { type: 'OPEN_PIANO_ROLL'; trackId: string; clipId?: string }
  | { type: 'CLOSE_PIANO_ROLL' }
  | { type: 'OPEN_DRUM_EDITOR'; trackId: string; clipId: string }
  | { type: 'CLOSE_DRUM_EDITOR' }
  | { type: 'SET_KEY_INPUT_STEP'; step: number }
  | { type: 'SELECT_NOTES'; noteIds: string[] }
  | { type: 'DESELECT_NOTES' }
  | { type: 'SET_QUANTIZE'; steps: number }
  | { type: 'SET_SCALE'; scale: string }
  | { type: 'SET_TIMELINE_ZOOM'; zoom: 1 | 2 | 4 }
  | { type: 'TOGGLE_KEYBOARD_MODE' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'REORDER_TRACKS'; fromIndex: number; toIndex: number }
  | { type: 'DUPLICATE_TRACK'; trackId: string }
  | { type: 'SET_PROJECT_NAME'; name: string }
  | { type: 'MARK_SAVED'; projectId: string }
  | { type: 'LOAD_PROJECT'; state: Partial<StudioState> }
  | { type: 'NEW_PROJECT' }

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapTracks(tracks: Track[], id: string, fn: (t: Track) => Track): Track[] {
  return tracks.map(t => t.id === id ? fn(t) : t)
}
function mapClips(track: Track, id: string, fn: (c: Clip) => Clip): Track {
  return { ...track, clips: (track.clips ?? []).map(c => c.id === id ? fn(c) : c) }
}
function mapDrumClips(track: Track, id: string, fn: (c: DrumClip) => DrumClip): Track {
  return { ...track, drumClips: (track.drumClips ?? []).map(c => c.id === id ? fn(c) : c) }
}
function pushHistory(s: StudioState): StudioState {
  return { ...s, history: [s.tracks, ...s.history].slice(0, MAX_HISTORY), future: [], lastHistoryPushMs: Date.now() }
}

// ── Reducer ───────────────────────────────────────────────────────────────────

function reducer(state: StudioState, action: Action): StudioState {
  // Auto-push history
  if (DISCRETE_HISTORY.has(action.type)) {
    state = pushHistory(state)
  } else if (DEBOUNCED_HISTORY.has(action.type)) {
    if (Date.now() - state.lastHistoryPushMs > HISTORY_DEBOUNCE) state = pushHistory(state)
    else state = { ...state, future: [] }
  }

  switch (action.type) {
    case 'SET_BPM':     return { ...state, bpm: action.bpm, isDirty: true }
    case 'SET_PLAYING': return { ...state, isPlaying: action.isPlaying }
    case 'SET_STEP':    return { ...state, currentStep: action.step }
    case 'TOGGLE_LOOP': return { ...state, loopEnabled: !state.loopEnabled }
    case 'SET_ACTIVE_TRACK': return { ...state, activeTrackId: action.trackId }
    case 'ADD_TRACK':
      return { ...state, tracks: [...state.tracks, action.track], isDirty: true }
    case 'REMOVE_TRACK':
      return { ...state, tracks: state.tracks.filter(t => t.id !== action.trackId),
        activeTrackId: state.activeTrackId === action.trackId ? null : state.activeTrackId, isDirty: true }
    case 'UPDATE_TRACK':
      return { ...state, tracks: mapTracks(state.tracks, action.trackId, t => ({ ...t, ...action.updates })), isDirty: true }
    case 'UPDATE_INSTRUMENT':
      return { ...state, tracks: mapTracks(state.tracks, action.trackId, t => ({ ...t, instrument: { ...t.instrument, ...action.settings } })), isDirty: true }
    case 'ADD_NOTE':
      return { ...state, tracks: mapTracks(state.tracks, action.trackId, t => ({ ...t, notes: [...(t.notes ?? []), action.note] })), isDirty: true }
    case 'REMOVE_NOTE':
      return { ...state, tracks: mapTracks(state.tracks, action.trackId, t => ({ ...t, notes: (t.notes ?? []).filter(n => n.id !== action.noteId) })), isDirty: true }
    case 'UPDATE_NOTE':
      return { ...state, tracks: mapTracks(state.tracks, action.trackId, t => ({ ...t, notes: (t.notes ?? []).map(n => n.id === action.noteId ? { ...n, ...action.updates } : n) })), isDirty: true }
    case 'TOGGLE_DRUM_STEP': {
      return { ...state, tracks: mapTracks(state.tracks, action.trackId, t => {
        if (!t.pattern) return t
        const p = t.pattern.map(row => [...row])
        p[action.row][action.step] = !p[action.row][action.step]
        return { ...t, pattern: p }
      }), isDirty: true }
    }
    case 'SET_DRUM_ROW_VOLUME': {
      return { ...state, tracks: mapTracks(state.tracks, action.trackId, t => {
        const v = [...(t.drumVolumes ?? Array(DRUM_ROW_COUNT).fill(1))]
        v[action.row] = action.volume
        return { ...t, drumVolumes: v }
      }), isDirty: true }
    }
    case 'SET_DRUM_STEP_VELOCITY': {
      return { ...state, tracks: mapTracks(state.tracks, action.trackId, t => {
        const vels = (t.drumVelocities ?? Array.from({ length: DRUM_ROW_COUNT }, () => Array(16).fill(0.8))).map(r => [...r])
        if (!vels[action.row]) vels[action.row] = Array(16).fill(0.8)
        vels[action.row][action.step] = Math.max(0.05, Math.min(1, action.velocity))
        return { ...t, drumVelocities: vels }
      }), isDirty: true }
    }
    case 'SET_ACTIVE_CLIP': return { ...state, activeClipId: action.clipId }
    case 'ADD_CLIP':
      return { ...state, tracks: mapTracks(state.tracks, action.trackId, t => ({ ...t, clips: [...(t.clips ?? []), action.clip] })), isDirty: true }
    case 'REMOVE_CLIP':
      return { ...state, tracks: mapTracks(state.tracks, action.trackId, t => ({ ...t, clips: (t.clips ?? []).filter(c => c.id !== action.clipId) })),
        activeClipId: state.activeClipId === action.clipId ? null : state.activeClipId, isDirty: true }
    case 'UPDATE_CLIP':
      return { ...state, tracks: mapTracks(state.tracks, action.trackId, t => mapClips(t, action.clipId, c => ({ ...c, ...action.updates }))), isDirty: true }
    case 'DUPLICATE_CLIP': {
      const tr = state.tracks.find(t => t.id === action.trackId)
      const cl = tr?.clips?.find(c => c.id === action.clipId)
      if (!cl) return state
      const nc: Clip = { ...cl, id: `clip-${Date.now()}`, name: `${cl.name} (copy)`, startBar: cl.startBar + cl.lengthBars,
        notes: cl.notes.map(n => ({ ...n, id: `n-${Date.now()}-${Math.random().toString(36).slice(2,6)}` })) }
      return { ...state, tracks: mapTracks(state.tracks, action.trackId, t => ({ ...t, clips: [...(t.clips ?? []), nc] })), isDirty: true }
    }
    case 'ADD_NOTE_TO_CLIP':
      return { ...state, tracks: mapTracks(state.tracks, action.trackId, t => mapClips(t, action.clipId, c => ({ ...c, notes: [...c.notes, action.note] }))), isDirty: true }
    case 'REMOVE_NOTE_FROM_CLIP':
      return { ...state, tracks: mapTracks(state.tracks, action.trackId, t => mapClips(t, action.clipId, c => ({ ...c, notes: c.notes.filter(n => n.id !== action.noteId) }))), isDirty: true }
    case 'REPLACE_CLIP_NOTES':
      return { ...state, tracks: mapTracks(state.tracks, action.trackId, t => mapClips(t, action.clipId, c => ({ ...c, notes: action.notes }))), isDirty: true }

    // Drum clips
    case 'ADD_DRUM_CLIP':
      return { ...state, tracks: mapTracks(state.tracks, action.trackId, t => ({
        ...t, drumClips: [...(t.drumClips ?? []), action.clip], activeDrumClipId: action.clip.id,
      })), isDirty: true }
    case 'REMOVE_DRUM_CLIP':
      return { ...state, tracks: mapTracks(state.tracks, action.trackId, t => {
        const rem = (t.drumClips ?? []).filter(c => c.id !== action.clipId)
        return { ...t, drumClips: rem, activeDrumClipId: t.activeDrumClipId === action.clipId ? (rem[0]?.id) : t.activeDrumClipId }
      }), isDirty: true }
    case 'UPDATE_DRUM_CLIP':
      return { ...state, tracks: mapTracks(state.tracks, action.trackId, t => mapDrumClips(t, action.clipId, c => ({ ...c, ...action.updates }))), isDirty: true }
    case 'DUPLICATE_DRUM_CLIP': {
      const dtr = state.tracks.find(t => t.id === action.trackId)
      const dc  = dtr?.drumClips?.find(c => c.id === action.clipId)
      if (!dc) return state
      const ndc: DrumClip = { ...dc, id: `drumclip-${Date.now()}`, name: `${dc.name} (copy)`,
        startBar: dc.startBar + dc.lengthBars, pattern: dc.pattern.map(row => [...row]) }
      return { ...state, tracks: mapTracks(state.tracks, action.trackId, t => ({ ...t, drumClips: [...(t.drumClips ?? []), ndc] })), isDirty: true }
    }
    case 'SET_ACTIVE_DRUM_CLIP':
      return { ...state, tracks: mapTracks(state.tracks, action.trackId, t => ({ ...t, activeDrumClipId: action.clipId ?? undefined })) }
    case 'TOGGLE_DRUM_CLIP_STEP':
      return { ...state, tracks: mapTracks(state.tracks, action.trackId, t =>
        mapDrumClips(t, action.clipId, c => {
          const p = c.pattern.map(row => [...row])
          if (!p[action.row]) p[action.row] = Array(16).fill(false)
          p[action.row][action.step] = !p[action.row][action.step]
          return { ...c, pattern: p }
        })
      ), isDirty: true }

    case 'OPEN_PIANO_ROLL':
      return { ...state, pianoRollOpen: true, pianoRollTrackId: action.trackId, pianoRollClipId: action.clipId ?? null, selectedNoteIds: [], keyInputStep: 0 }
    case 'CLOSE_PIANO_ROLL':
      return { ...state, pianoRollOpen: false, pianoRollTrackId: null, pianoRollClipId: null, selectedNoteIds: [], keyInputStep: 0 }
    case 'OPEN_DRUM_EDITOR':
      return { ...state, drumEditorOpen: true, drumEditorTrackId: action.trackId, drumEditorClipId: action.clipId }
    case 'CLOSE_DRUM_EDITOR':
      return { ...state, drumEditorOpen: false, drumEditorTrackId: null, drumEditorClipId: null }
    case 'SET_KEY_INPUT_STEP':
      return { ...state, keyInputStep: action.step }
    case 'SELECT_NOTES':   return { ...state, selectedNoteIds: action.noteIds }
    case 'DESELECT_NOTES': return { ...state, selectedNoteIds: [] }
    case 'SET_QUANTIZE':   return { ...state, quantizeSteps: action.steps }
    case 'SET_SCALE':      return { ...state, activeScale: action.scale }
    case 'SET_TIMELINE_ZOOM':    return { ...state, timelineZoom: action.zoom }
    case 'TOGGLE_KEYBOARD_MODE': return { ...state, keyboardMode: !state.keyboardMode }

    case 'UNDO': {
      if (state.history.length === 0) return state
      const [prev, ...rest] = state.history
      return { ...state, tracks: prev, history: rest, future: [state.tracks, ...state.future].slice(0, MAX_HISTORY), isDirty: true }
    }
    case 'REDO': {
      if (state.future.length === 0) return state
      const [next, ...rest] = state.future
      return { ...state, tracks: next, future: rest, history: [state.tracks, ...state.history].slice(0, MAX_HISTORY), isDirty: true }
    }

    case 'REORDER_TRACKS': {
      const arr = [...state.tracks]
      const [moved] = arr.splice(action.fromIndex, 1)
      arr.splice(action.toIndex, 0, moved)
      return { ...state, tracks: arr, isDirty: true }
    }
    case 'DUPLICATE_TRACK': {
      const tr = state.tracks.find(t => t.id === action.trackId)
      if (!tr) return state
      const ts = Date.now()
      const newId = `track-${ts}`
      const newTrack: Track = {
        ...tr,
        id: newId,
        name: `${tr.name} (copy)`,
        clips: tr.clips?.map(c => ({
          ...c,
          id: `clip-${ts}-${c.id}`,
          notes: c.notes.map(n => ({ ...n, id: `n-${ts}-${n.id}` })),
        })),
        drumClips: tr.drumClips?.map(dc => ({
          ...dc,
          id: `drumclip-${ts}-${dc.id}`,
          pattern: dc.pattern.map(row => [...row]),
        })),
        activeDrumClipId: tr.activeDrumClipId
          ? `drumclip-${ts}-${tr.activeDrumClipId}`
          : undefined,
      }
      const idx = state.tracks.findIndex(t => t.id === action.trackId)
      const newTracks = [...state.tracks.slice(0, idx + 1), newTrack, ...state.tracks.slice(idx + 1)]
      return { ...state, tracks: newTracks, isDirty: true }
    }
    case 'SET_PROJECT_NAME': return { ...state, projectName: action.name, isDirty: true }
    case 'MARK_SAVED':  return { ...state, savedProjectId: action.projectId, isDirty: false }
    case 'LOAD_PROJECT': {
      const incoming = action.state.tracks ? action.state.tracks.map(migrateDrumTrack) : state.tracks
      return { ...state, ...action.state, tracks: incoming, isDirty: false, isPlaying: false, currentStep: 0, history: [], future: [] }
    }
    case 'NEW_PROJECT': return freshState()
    default: return state
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

export interface StudioContextValue {
  state: StudioState
  dispatch: React.Dispatch<Action>
  masterVolRef: React.MutableRefObject<any>
  analyserRef:  React.MutableRefObject<any>
  previewNoteRef: React.MutableRefObject<(midi: number, duration?: number) => void>
  previewDrumRef: React.MutableRefObject<(drumId: string, velocity?: number) => void>
  toggleKeyboardMode: () => void
  play: () => void; stop: () => void; setBpm: (bpm: number) => void
  undo: () => void; redo: () => void
  setActiveTrack: (id: string | null) => void
  reorderTracks: (fromIndex: number, toIndex: number) => void
  duplicateTrack: (id: string) => void
  addTrack: (t: Track) => void; removeTrack: (id: string) => void
  updateTrack: (id: string, u: Partial<Track>) => void
  updateInstrument: (id: string, s: Partial<SynthSettings>) => void
  addNote: (tid: string, n: Note) => void
  removeNote: (tid: string, nid: string) => void
  toggleDrumStep: (tid: string, row: number, step: number) => void
  setDrumRowVolume: (tid: string, row: number, vol: number) => void
  setDrumStepVelocity: (tid: string, row: number, step: number, v: number) => void
  addClip: (tid: string, c: Clip) => void
  removeClip: (tid: string, cid: string) => void
  updateClip: (tid: string, cid: string, u: Partial<Omit<Clip,'notes'>>) => void
  duplicateClip: (tid: string, cid: string) => void
  addNoteToClip: (tid: string, cid: string, n: Note) => void
  removeNoteFromClip: (tid: string, cid: string, nid: string) => void
  replaceClipNotes: (tid: string, cid: string, notes: Note[]) => void
  addDrumClip: (tid: string, c: DrumClip) => void
  removeDrumClip: (tid: string, cid: string) => void
  updateDrumClip: (tid: string, cid: string, u: Partial<Omit<DrumClip,'pattern'>>) => void
  duplicateDrumClip: (tid: string, cid: string) => void
  setActiveDrumClip: (tid: string, cid: string | null) => void
  toggleDrumClipStep: (tid: string, cid: string, row: number, step: number) => void
  openPianoRoll: (tid: string, cid?: string) => void
  closePianoRoll: () => void
  openDrumEditor: (tid: string, cid: string) => void
  closeDrumEditor: () => void
  selectNotes: (ids: string[]) => void
  deselectNotes: () => void
  setQuantize: (steps: number) => void
  setScale: (scale: string) => void
  setTimelineZoom: (zoom: 1 | 2 | 4) => void
}

export const StudioContext = createContext<StudioContextValue | null>(null)

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, freshState)
  const masterVolRef   = useRef<any>(null)
  const analyserRef    = useRef<any>(null)
  const previewNoteRef = useRef<(midi: number, duration?: number) => void>(() => {})
  const previewDrumRef = useRef<(drumId: string, velocity?: number) => void>(() => {})

  const toggleKeyboardMode = useCallback(() => dispatch({ type: 'TOGGLE_KEYBOARD_MODE' }), [])
  const play    = useCallback(() => dispatch({ type: 'SET_PLAYING', isPlaying: true }), [])
  const stop    = useCallback(() => { dispatch({ type: 'SET_PLAYING', isPlaying: false }); dispatch({ type: 'SET_STEP', step: 0 }) }, [])
  const setBpm  = useCallback((bpm: number) => dispatch({ type: 'SET_BPM', bpm }), [])
  const undo    = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const redo    = useCallback(() => dispatch({ type: 'REDO' }), [])
  const setActiveTrack     = useCallback((id: string | null) => dispatch({ type: 'SET_ACTIVE_TRACK', trackId: id }), [])
  const reorderTracks      = useCallback((fromIndex: number, toIndex: number) => dispatch({ type: 'REORDER_TRACKS', fromIndex, toIndex }), [])
  const duplicateTrack     = useCallback((trackId: string) => dispatch({ type: 'DUPLICATE_TRACK', trackId }), [])
  const addTrack           = useCallback((track: Track) => dispatch({ type: 'ADD_TRACK', track }), [])
  const removeTrack        = useCallback((trackId: string) => dispatch({ type: 'REMOVE_TRACK', trackId }), [])
  const updateTrack        = useCallback((trackId: string, updates: Partial<Track>) => dispatch({ type: 'UPDATE_TRACK', trackId, updates }), [])
  const updateInstrument   = useCallback((trackId: string, settings: Partial<SynthSettings>) => dispatch({ type: 'UPDATE_INSTRUMENT', trackId, settings }), [])
  const addNote            = useCallback((tid: string, note: Note) => dispatch({ type: 'ADD_NOTE', trackId: tid, note }), [])
  const removeNote         = useCallback((tid: string, nid: string) => dispatch({ type: 'REMOVE_NOTE', trackId: tid, noteId: nid }), [])
  const toggleDrumStep     = useCallback((tid: string, row: number, step: number) => dispatch({ type: 'TOGGLE_DRUM_STEP', trackId: tid, row, step }), [])
  const setDrumRowVolume   = useCallback((tid: string, row: number, volume: number) => dispatch({ type: 'SET_DRUM_ROW_VOLUME', trackId: tid, row, volume }), [])
  const setDrumStepVelocity= useCallback((tid: string, row: number, step: number, velocity: number) => dispatch({ type: 'SET_DRUM_STEP_VELOCITY', trackId: tid, row, step, velocity }), [])
  const addClip            = useCallback((tid: string, clip: Clip) => dispatch({ type: 'ADD_CLIP', trackId: tid, clip }), [])
  const removeClip         = useCallback((tid: string, cid: string) => dispatch({ type: 'REMOVE_CLIP', trackId: tid, clipId: cid }), [])
  const updateClip         = useCallback((tid: string, cid: string, u: Partial<Omit<Clip,'notes'>>) => dispatch({ type: 'UPDATE_CLIP', trackId: tid, clipId: cid, updates: u }), [])
  const duplicateClip      = useCallback((tid: string, cid: string) => dispatch({ type: 'DUPLICATE_CLIP', trackId: tid, clipId: cid }), [])
  const addNoteToClip      = useCallback((tid: string, cid: string, note: Note) => dispatch({ type: 'ADD_NOTE_TO_CLIP', trackId: tid, clipId: cid, note }), [])
  const removeNoteFromClip = useCallback((tid: string, cid: string, nid: string) => dispatch({ type: 'REMOVE_NOTE_FROM_CLIP', trackId: tid, clipId: cid, noteId: nid }), [])
  const replaceClipNotes   = useCallback((tid: string, cid: string, notes: Note[]) => dispatch({ type: 'REPLACE_CLIP_NOTES', trackId: tid, clipId: cid, notes }), [])
  const addDrumClip        = useCallback((tid: string, clip: DrumClip) => dispatch({ type: 'ADD_DRUM_CLIP', trackId: tid, clip }), [])
  const removeDrumClip     = useCallback((tid: string, cid: string) => dispatch({ type: 'REMOVE_DRUM_CLIP', trackId: tid, clipId: cid }), [])
  const updateDrumClip     = useCallback((tid: string, cid: string, u: Partial<Omit<DrumClip,'pattern'>>) => dispatch({ type: 'UPDATE_DRUM_CLIP', trackId: tid, clipId: cid, updates: u }), [])
  const duplicateDrumClip  = useCallback((tid: string, cid: string) => dispatch({ type: 'DUPLICATE_DRUM_CLIP', trackId: tid, clipId: cid }), [])
  const setActiveDrumClip  = useCallback((tid: string, cid: string | null) => dispatch({ type: 'SET_ACTIVE_DRUM_CLIP', trackId: tid, clipId: cid }), [])
  const toggleDrumClipStep = useCallback((tid: string, cid: string, row: number, step: number) => dispatch({ type: 'TOGGLE_DRUM_CLIP_STEP', trackId: tid, clipId: cid, row, step }), [])
  const openPianoRoll  = useCallback((tid: string, cid?: string) => dispatch({ type: 'OPEN_PIANO_ROLL', trackId: tid, clipId: cid }), [])
  const closePianoRoll = useCallback(() => dispatch({ type: 'CLOSE_PIANO_ROLL' }), [])
  const openDrumEditor = useCallback((tid: string, cid: string) => dispatch({ type: 'OPEN_DRUM_EDITOR', trackId: tid, clipId: cid }), [])
  const closeDrumEditor= useCallback(() => dispatch({ type: 'CLOSE_DRUM_EDITOR' }), [])
  const selectNotes    = useCallback((ids: string[]) => dispatch({ type: 'SELECT_NOTES', noteIds: ids }), [])
  const deselectNotes  = useCallback(() => dispatch({ type: 'DESELECT_NOTES' }), [])
  const setQuantize    = useCallback((steps: number) => dispatch({ type: 'SET_QUANTIZE', steps }), [])
  const setScale       = useCallback((scale: string) => dispatch({ type: 'SET_SCALE', scale }), [])
  const setTimelineZoom= useCallback((zoom: 1 | 2 | 4) => dispatch({ type: 'SET_TIMELINE_ZOOM', zoom }), [])

  return (
    <StudioContext.Provider value={{
      state, dispatch, masterVolRef, analyserRef, previewNoteRef, previewDrumRef, toggleKeyboardMode,
      play, stop, setBpm, undo, redo,
      setActiveTrack, reorderTracks, duplicateTrack, addTrack, removeTrack, updateTrack, updateInstrument,
      addNote, removeNote, toggleDrumStep, setDrumRowVolume, setDrumStepVelocity,
      addClip, removeClip, updateClip, duplicateClip,
      addNoteToClip, removeNoteFromClip, replaceClipNotes,
      addDrumClip, removeDrumClip, updateDrumClip, duplicateDrumClip,
      setActiveDrumClip, toggleDrumClipStep,
      openPianoRoll, closePianoRoll, openDrumEditor, closeDrumEditor,
      selectNotes, deselectNotes,
      setQuantize, setScale, setTimelineZoom,
    }}>
      {children}
    </StudioContext.Provider>
  )
}
