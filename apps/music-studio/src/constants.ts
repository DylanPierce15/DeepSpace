/** App name — replaced by the CLI during scaffolding */
export const APP_NAME = 'music-studio'

/** Primary scope ID for the app's RecordRoom DO */
export const SCOPE_ID = `app:${APP_NAME}`

/** Roles and display config — imported from SDK (single source of truth) */
export { ROLES, ROLE_CONFIG, type Role } from 'deepspace'

// ============================================================================
// Music Studio — Transport
// ============================================================================

export const DEFAULT_BPM = 120
export const MIN_BPM = 40
export const MAX_BPM = 200
export const DEFAULT_TIME_SIGNATURE = '4/4'
export const BARS = 8
export const STEPS_PER_BAR = 16
export const TOTAL_STEPS = BARS * STEPS_PER_BAR

// ============================================================================
// Piano Roll
// ============================================================================

export const PIANO_ROLL_NOTES = Array.from({ length: 48 }, (_, i) => {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const midi = 84 - i
  const octave = Math.floor(midi / 12) - 1
  const name = noteNames[midi % 12]
  return { midi, name, octave, label: `${name}${octave}`, isBlack: name.includes('#') }
})

export const QUANTIZE_OPTIONS = [
  { label: '1/16', steps: 1 },
  { label: '1/8', steps: 2 },
  { label: '1/4', steps: 4 },
  { label: '1/2', steps: 8 },
  { label: 'Bar', steps: 16 },
] as const

export const MUSICAL_SCALES: Record<string, number[]> = {
  'None': [],
  'Major': [0, 2, 4, 5, 7, 9, 11],
  'Minor': [0, 2, 3, 5, 7, 8, 10],
  'Dorian': [0, 2, 3, 5, 7, 9, 10],
  'Pentatonic': [0, 2, 4, 7, 9],
  'Blues': [0, 3, 5, 6, 7, 10],
}
export const SCALE_NAMES = Object.keys(MUSICAL_SCALES)

// ============================================================================
// Drum Sequencer
// ============================================================================

export const DRUM_ROWS = [
  { id: 'kick', label: 'Kick', color: '#ef4444' },
  { id: 'snare', label: 'Snare', color: '#f59e0b' },
  { id: 'clap', label: 'Clap', color: '#10b981' },
  { id: 'hihat', label: 'Hi-Hat', color: '#06b6d4' },
  { id: 'openhat', label: 'Open Hat', color: '#3b82f6' },
  { id: 'perc', label: 'Perc', color: '#8b5cf6' },
  { id: 'tom', label: 'Tom', color: '#ec4899' },
  { id: 'shaker', label: 'Shaker', color: '#a855f7' },
] as const

export const DRUM_ROW_COUNT = DRUM_ROWS.length
export const DEFAULT_STEP_VELOCITY = 0.9

// ============================================================================
// Types
// ============================================================================

export interface Note {
  id: string
  midi: number
  step: number
  duration: number
  velocity: number
}

export interface DrumClip {
  id: string
  name: string
  startBar: number
  lengthBars: number
  pattern: boolean[][]
  color?: string
}

export interface Clip {
  id: string
  name: string
  startBar: number
  lengthBars: number
  notes: Note[]
  color?: string
}

export interface SynthSettings {
  oscillator: 'sine' | 'sawtooth' | 'square' | 'triangle'
  filterFreq: number
  filterRes: number
  attack: number
  decay: number
  sustain: number
  release: number
  fxReverb?: number
  fxDelay?: number
  soundfont?: string
}

export interface Track {
  id: string
  name: string
  type: 'synth' | 'drums' | 'sample'
  clips?: Clip[]
  notes?: Note[]
  drumClips?: DrumClip[]
  activeDrumClipId?: string
  pattern?: boolean[][]
  drumVolumes?: number[]
  drumVelocities?: number[][]
  sampleUrl?: string
  volume: number
  pan: number
  muted: boolean
  soloed: boolean
  color: string
  instrument: SynthSettings
}

export interface Project {
  id: string
  name: string
  bpm: number
  timeSignature: string
  tracks: Track[]
  visibility: 'private' | 'public'
  publishedUrl?: string
  remixedFrom?: string
  updatedAt: string
}

// ============================================================================
// Instrument sources
// ============================================================================

const SALAMANDER_BASE = 'https://tonejs.github.io/audio/salamander/'
const MUSYNGKITE_BASE = 'https://raw.githubusercontent.com/gleitz/midi-js-soundfonts/gh-pages/MusyngKite/'

const SALAMANDER_NOTES: Record<string, string> = {
  'A0': 'A0.mp3', 'C1': 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
  'A1': 'A1.mp3', 'C2': 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
  'A2': 'A2.mp3', 'C3': 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
  'A3': 'A3.mp3', 'C4': 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
  'A4': 'A4.mp3', 'C5': 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
  'A5': 'A5.mp3', 'C6': 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
  'A6': 'A6.mp3', 'C7': 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3',
  'A7': 'A7.mp3', 'C8': 'C8.mp3',
}

const MK: Record<string, Record<string, string>> = {
  electric_piano_1: { 'A2': 'A2.mp3', 'C3': 'C3.mp3', 'E3': 'E3.mp3', 'A3': 'A3.mp3', 'C4': 'C4.mp3', 'E4': 'E4.mp3', 'A4': 'A4.mp3', 'C5': 'C5.mp3', 'E5': 'E5.mp3', 'A5': 'A5.mp3' },
  vibraphone: { 'A3': 'A3.mp3', 'C4': 'C4.mp3', 'E4': 'E4.mp3', 'A4': 'A4.mp3', 'C5': 'C5.mp3', 'E5': 'E5.mp3', 'A5': 'A5.mp3', 'C6': 'C6.mp3' },
  marimba: { 'A2': 'A2.mp3', 'C3': 'C3.mp3', 'E3': 'E3.mp3', 'A3': 'A3.mp3', 'C4': 'C4.mp3', 'E4': 'E4.mp3', 'A4': 'A4.mp3', 'C5': 'C5.mp3' },
  acoustic_guitar_nylon: { 'E2': 'E2.mp3', 'A2': 'A2.mp3', 'D3': 'D3.mp3', 'G3': 'G3.mp3', 'B3': 'B3.mp3', 'E4': 'E4.mp3', 'A4': 'A4.mp3', 'D5': 'D5.mp3' },
  acoustic_guitar_steel: { 'E2': 'E2.mp3', 'A2': 'A2.mp3', 'D3': 'D3.mp3', 'G3': 'G3.mp3', 'B3': 'B3.mp3', 'E4': 'E4.mp3', 'A4': 'A4.mp3', 'D5': 'D5.mp3' },
  electric_guitar_clean: { 'E2': 'E2.mp3', 'A2': 'A2.mp3', 'D3': 'D3.mp3', 'G3': 'G3.mp3', 'B3': 'B3.mp3', 'E4': 'E4.mp3', 'A4': 'A4.mp3', 'D5': 'D5.mp3' },
  acoustic_bass: { 'E1': 'E1.mp3', 'A1': 'A1.mp3', 'D2': 'D2.mp3', 'G2': 'G2.mp3', 'C3': 'C3.mp3', 'E3': 'E3.mp3', 'A3': 'A3.mp3' },
  electric_bass_finger: { 'E1': 'E1.mp3', 'A1': 'A1.mp3', 'D2': 'D2.mp3', 'G2': 'G2.mp3', 'C3': 'C3.mp3', 'E3': 'E3.mp3', 'A3': 'A3.mp3' },
  violin: { 'G3': 'G3.mp3', 'A3': 'A3.mp3', 'C4': 'C4.mp3', 'E4': 'E4.mp3', 'A4': 'A4.mp3', 'C5': 'C5.mp3', 'E5': 'E5.mp3', 'A5': 'A5.mp3' },
  cello: { 'C2': 'C2.mp3', 'G2': 'G2.mp3', 'C3': 'C3.mp3', 'G3': 'G3.mp3', 'C4': 'C4.mp3', 'E4': 'E4.mp3', 'A4': 'A4.mp3' },
  string_ensemble_1: { 'C3': 'C3.mp3', 'G3': 'G3.mp3', 'C4': 'C4.mp3', 'E4': 'E4.mp3', 'G4': 'G4.mp3', 'C5': 'C5.mp3', 'E5': 'E5.mp3', 'G5': 'G5.mp3' },
  flute: { 'C4': 'C4.mp3', 'E4': 'E4.mp3', 'A4': 'A4.mp3', 'C5': 'C5.mp3', 'E5': 'E5.mp3', 'A5': 'A5.mp3', 'C6': 'C6.mp3', 'A6': 'A6.mp3' },
  clarinet: { 'E3': 'E3.mp3', 'A3': 'A3.mp3', 'C4': 'C4.mp3', 'E4': 'E4.mp3', 'A4': 'A4.mp3', 'C5': 'C5.mp3', 'E5': 'E5.mp3', 'A5': 'A5.mp3' },
  oboe: { 'A3': 'A3.mp3', 'C4': 'C4.mp3', 'E4': 'E4.mp3', 'A4': 'A4.mp3', 'C5': 'C5.mp3', 'E5': 'E5.mp3', 'A5': 'A5.mp3' },
  trumpet: { 'E3': 'E3.mp3', 'A3': 'A3.mp3', 'C4': 'C4.mp3', 'E4': 'E4.mp3', 'A4': 'A4.mp3', 'C5': 'C5.mp3', 'E5': 'E5.mp3', 'A5': 'A5.mp3' },
  trombone: { 'A1': 'A1.mp3', 'D2': 'D2.mp3', 'G2': 'G2.mp3', 'C3': 'C3.mp3', 'E3': 'E3.mp3', 'A3': 'A3.mp3', 'D4': 'D4.mp3', 'G4': 'G4.mp3' },
  french_horn: { 'A1': 'A1.mp3', 'D2': 'D2.mp3', 'G2': 'G2.mp3', 'C3': 'C3.mp3', 'E3': 'E3.mp3', 'A3': 'A3.mp3', 'C4': 'C4.mp3', 'E4': 'E4.mp3' },
  alto_sax: { 'A3': 'A3.mp3', 'C4': 'C4.mp3', 'E4': 'E4.mp3', 'A4': 'A4.mp3', 'C5': 'C5.mp3', 'E5': 'E5.mp3', 'A5': 'A5.mp3' },
  choir_aahs: { 'C3': 'C3.mp3', 'G3': 'G3.mp3', 'C4': 'C4.mp3', 'G4': 'G4.mp3', 'C5': 'C5.mp3' },
  voice_oohs: { 'C3': 'C3.mp3', 'G3': 'G3.mp3', 'C4': 'C4.mp3', 'G4': 'G4.mp3', 'C5': 'C5.mp3' },
  pad_1_new_age: { 'C2': 'C2.mp3', 'C3': 'C3.mp3', 'C4': 'C4.mp3', 'C5': 'C5.mp3', 'C6': 'C6.mp3' },
  pad_2_warm: { 'C2': 'C2.mp3', 'C3': 'C3.mp3', 'C4': 'C4.mp3', 'C5': 'C5.mp3', 'C6': 'C6.mp3' },
  pad_8_sweep: { 'C2': 'C2.mp3', 'C3': 'C3.mp3', 'C4': 'C4.mp3', 'C5': 'C5.mp3', 'C6': 'C6.mp3' },
}

export interface SampleSource {
  baseUrl: string
  urls: Record<string, string>
  boostDb: number
}

// Per-instrument boost calibration. MusyngKite samples vary widely in recorded
// level — bass/brass instruments are hot, pads/vocals are quiet.
const INSTRUMENT_BOOST: Record<string, number> = {
  // Piano
  acoustic_grand_piano:   8,
  bright_acoustic_piano:  8,
  electric_piano_1:      12,
  // Mallet
  vibraphone:            14,
  marimba:               14,
  // Guitar
  acoustic_guitar_nylon: 14,
  acoustic_guitar_steel: 14,
  electric_guitar_clean: 14,
  // Bass — already loud/bassy, keep boost minimal
  acoustic_bass:          4,
  electric_bass_finger:   4,
  // Strings
  violin:                20,
  cello:                 16,
  string_ensemble_1:     18,
  // Wind
  flute:                 22,
  clarinet:              20,
  oboe:                  20,
  // Brass — MusyngKite brass samples are quiet
  trumpet:               22,
  trombone:              16,
  french_horn:           18,
  alto_sax:              18,
  // Vocal
  choir_aahs:            22,
  voice_oohs:            24,
  // Pad
  pad_1_new_age:         24,
  pad_2_warm:            24,
  pad_8_sweep:           24,
}

export function getInstrumentSource(id: string): SampleSource | null {
  const boostDb = INSTRUMENT_BOOST[id] ?? 14
  if (id === 'acoustic_grand_piano' || id === 'bright_acoustic_piano') {
    return { baseUrl: SALAMANDER_BASE, urls: SALAMANDER_NOTES, boostDb }
  }
  const urls = MK[id]
  if (!urls) return null
  return { baseUrl: `${MUSYNGKITE_BASE}${id}-mp3/`, urls, boostDb }
}

export const SOUNDFONT_INSTRUMENTS: Array<{ id: string; label: string; category: string }> = [
  { id: '', label: 'Synthesizer', category: 'Synth' },
  { id: 'acoustic_grand_piano', label: 'Grand Piano', category: 'Piano' },
  { id: 'bright_acoustic_piano', label: 'Bright Piano', category: 'Piano' },
  { id: 'electric_piano_1', label: 'Electric Piano', category: 'Piano' },
  { id: 'vibraphone', label: 'Vibraphone', category: 'Mallet' },
  { id: 'marimba', label: 'Marimba', category: 'Mallet' },
  { id: 'acoustic_guitar_nylon', label: 'Nylon Guitar', category: 'Guitar' },
  { id: 'acoustic_guitar_steel', label: 'Steel Guitar', category: 'Guitar' },
  { id: 'electric_guitar_clean', label: 'Electric Guitar', category: 'Guitar' },
  { id: 'acoustic_bass', label: 'Acoustic Bass', category: 'Bass' },
  { id: 'electric_bass_finger', label: 'Electric Bass', category: 'Bass' },
  { id: 'violin', label: 'Violin', category: 'Strings' },
  { id: 'cello', label: 'Cello', category: 'Strings' },
  { id: 'string_ensemble_1', label: 'String Ensemble', category: 'Strings' },
  { id: 'flute', label: 'Flute', category: 'Wind' },
  { id: 'clarinet', label: 'Clarinet', category: 'Wind' },
  { id: 'oboe', label: 'Oboe', category: 'Wind' },
  { id: 'trumpet', label: 'Trumpet', category: 'Brass' },
  { id: 'trombone', label: 'Trombone', category: 'Brass' },
  { id: 'french_horn', label: 'French Horn', category: 'Brass' },
  { id: 'alto_sax', label: 'Alto Sax', category: 'Brass' },
  { id: 'choir_aahs', label: 'Choir Aahs', category: 'Vocal' },
  { id: 'voice_oohs', label: 'Voice Oohs', category: 'Vocal' },
  { id: 'pad_1_new_age', label: 'New Age Pad', category: 'Pad' },
  { id: 'pad_2_warm', label: 'Warm Pad', category: 'Pad' },
  { id: 'pad_8_sweep', label: 'Sweep Pad', category: 'Pad' },
]

// ============================================================================
// Default project content
// ============================================================================

export const DEFAULT_CLIP = (trackId: string): Clip => ({
  id: `clip-${trackId}-1`,
  name: 'Clip 1',
  startBar: 0,
  lengthBars: 2,
  notes: [],
})

function makeDefaultDrumPattern(): boolean[][] {
  const p = Array.from({ length: DRUM_ROW_COUNT }, () => Array(16).fill(false) as boolean[])
  p[0][0] = true; p[0][8] = true
  p[1][4] = true; p[1][12] = true;
  [0, 2, 4, 6, 8, 10, 12, 14].forEach(s => { p[3][s] = true })
  p[4][6] = true
  return p
}

function makeDefaultMelody(): Note[] {
  const pitches = [60, 64, 67, 71, 67, 64]
  return pitches.map((midi, i) => ({
    id: `preset-note-${i}`,
    midi,
    step: i * 4,
    duration: 3,
    velocity: 0.7 + (i % 2) * 0.1,
  }))
}

export const NEW_PROJECT_TRACKS = (): Track[] => [
  {
    id: 'track-1',
    name: 'Lead',
    type: 'synth',
    clips: [{
      id: 'clip-track-1-starter',
      name: 'Intro',
      startBar: 0,
      lengthBars: 2,
      notes: makeDefaultMelody(),
    }],
    notes: [],
    volume: 0.85,
    pan: 0,
    muted: false,
    soloed: false,
    color: '#8b5cf6',
    instrument: { oscillator: 'triangle', filterFreq: 3200, filterRes: 1.2, attack: 0.02, decay: 0.12, sustain: 0.45, release: 0.8, soundfont: 'acoustic_grand_piano' },
  },
  {
    id: 'track-2',
    name: 'Drums',
    type: 'drums',
    drumClips: [{
      id: 'drumclip-track-2-1',
      name: 'Beat 1',
      startBar: 0,
      lengthBars: BARS,
      pattern: makeDefaultDrumPattern(),
    }],
    activeDrumClipId: 'drumclip-track-2-1',
    drumVolumes: Array.from({ length: DRUM_ROW_COUNT }, (_, i) => [1.0, 0.95, 0.8, 0.85, 0.85, 0.8, 0.75][i] ?? 1),
    drumVelocities: Array.from({ length: DRUM_ROW_COUNT }, () => Array(16).fill(DEFAULT_STEP_VELOCITY)),
    volume: 0.95,
    pan: 0,
    muted: false,
    soloed: false,
    color: '#06b6d4',
    instrument: { oscillator: 'square', filterFreq: 3000, filterRes: 1, attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
  },
]
