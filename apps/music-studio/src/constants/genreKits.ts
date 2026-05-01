/**
 * Genre Starter Kits — pre-built musical templates.
 *
 * Each kit contains a complete project snapshot (BPM, tracks, clips, notes,
 * drum clips, instrument settings) so new users can start making music
 * immediately instead of facing a blank canvas.
 *
 * All synth clips span BARS (8 bars) so music plays across the full timeline.
 * Drums use the DrumClip system (not legacy `pattern`).
 */

import type { Track, Note, Clip, DrumClip } from '../constants'
import { DRUM_ROW_COUNT, BARS, DEFAULT_STEP_VELOCITY } from '../constants'

function note(midi: number, step: number, duration: number, velocity = 0.75): Note {
  return { id: `n-${midi}-${step}`, midi, step, duration, velocity }
}

function clip(id: string, name: string, startBar: number, lengthBars: number, notes: Note[]): Clip {
  return { id, name, startBar, lengthBars, notes }
}

/** Build a DrumClip from sparse row arrays (step indices per row).
 *  Row order matches DRUM_ROWS: kick, snare, clap, hihat, openhat, perc, tom, shaker */
function drumClip(
  id: string,
  name: string,
  startBar: number,
  lengthBars: number,
  kick: number[], snare: number[], hihat: number[], openhat: number[],
  clap: number[] = [], perc: number[] = [], tom: number[] = [], shaker: number[] = [],
): DrumClip {
  // DRUM_ROWS order: kick(0) snare(1) clap(2) hihat(3) openhat(4) perc(5) tom(6) shaker(7)
  const rows = [kick, snare, clap, hihat, openhat, perc, tom, shaker]
  const pattern = rows.map(row =>
    Array.from({ length: 16 }, (_, i) => row.includes(i)) as boolean[]
  )
  return { id, name, startBar, lengthBars, pattern }
}

const DEFAULT_DRUM_VOLUMES    = [1.0, 0.85, 0.75, 0.7, 0.7, 0.7, 0.65, 0.6]
const DEFAULT_DRUM_VELOCITIES = Array.from({ length: DRUM_ROW_COUNT }, () =>
  Array(16).fill(DEFAULT_STEP_VELOCITY) as number[]
)

// ── MIDI note constants ───────────────────────────────────────────────────────
const E2=40, F2=41, G2=43, A2=45
const C3=48, D3=50, E3=52, F3=53, Fs3=54, G3=55, A3=57, Bb3=58, B3=59
const C4=60, Cs4=61, D4=62, E4=64, F4=65, G4=67, A4=69, Bb4=70, B4=71
const C5=72, D5=74

// ── Kit definitions ───────────────────────────────────────────────────────────

export interface GenreKit {
  id:          string
  name:        string
  emoji:       string
  description: string
  color:       string
  bpm:         number
  projectName: string
  tracks:      Track[]
}

// ── 1. Lo-fi Hip-hop ─────────────────────────────────────────────────────────
// Complete 8-bar production: electric piano chords, vibraphone melody, bass, swung drums
const LOFI: GenreKit = {
  id: 'lofi',
  name: 'Lo-fi Hip-hop',
  emoji: '🌙',
  description: 'Warm Am7 chords, a pentatonic melody, walking bass, and a swung shuffle. Perfect for studying.',
  color: '#8b5cf6',
  bpm: 85,
  projectName: 'Lo-fi Night',
  tracks: [
    {
      id: 'kit-lofi-chords', name: 'Chords', type: 'synth',
      clips: [
        // Single 8-bar clip: Am7 - Fmaj7 repeating (2-bar units, arpeggiated)
        clip('kit-lofi-c1', 'Am - F', 0, BARS, [
          // Bar 0-1: Am7 (A3 C4 E4 G4)
          note(A3,  0, 28, 0.62), note(C4,  1, 27, 0.52), note(E4,  2, 26, 0.47), note(G4,  3, 25, 0.42),
          // Bar 2-3: Fmaj7 (F3 A3 C4 E4)
          note(F3, 32, 28, 0.62), note(A3, 33, 27, 0.52), note(C4, 34, 26, 0.47), note(E4, 35, 25, 0.42),
          // Bar 4-5: Am7 again
          note(A3, 64, 28, 0.62), note(C4, 65, 27, 0.52), note(E4, 66, 26, 0.47), note(G4, 67, 25, 0.42),
          // Bar 6-7: Fmaj7 again
          note(F3, 96, 28, 0.62), note(A3, 97, 27, 0.52), note(C4, 98, 26, 0.47), note(E4, 99, 25, 0.42),
        ]),
      ],
      notes: [], volume: 0.75, pan: -0.1, muted: false, soloed: false, color: '#8b5cf6',
      instrument: {
        oscillator: 'triangle', filterFreq: 900, filterRes: 0.5,
        attack: 0.06, decay: 0.3, sustain: 0.85, release: 2.5,
        fxReverb: 0.14, soundfont: 'electric_piano_1',
      },
    },
    {
      id: 'kit-lofi-melody', name: 'Melody', type: 'synth',
      clips: [
        // Full 8-bar melody in A minor pentatonic
        clip('kit-lofi-m1', 'Hook', 0, BARS, [
          // Bar 0 — opening phrase descending to A root
          note(A4,  0, 3, 0.80), note(G4,  4, 2, 0.70), note(E4,  7, 3, 0.75),
          note(C4, 12, 4, 0.75),
          // Bar 1 — rising answer
          note(D4, 18, 2, 0.70), note(E4, 21, 3, 0.75), note(G4, 26, 6, 0.80),
          // Bar 2 — climb to A4
          note(A4, 34, 3, 0.80), note(E4, 38, 2, 0.65), note(C4, 42, 4, 0.70),
          // Bar 3 — settle and rise again
          note(D4, 48, 3, 0.75), note(E4, 52, 2, 0.70), note(A4, 58, 6, 0.85),
          // Bar 4 — peak with C5
          note(C5, 64, 3, 0.85), note(A4, 67, 3, 0.78), note(G4, 70, 4, 0.82), note(E4, 74, 5, 0.78),
          // Bar 5 — build back up
          note(D4, 80, 3, 0.78), note(E4, 83, 3, 0.82), note(G4, 86, 4, 0.88), note(A4, 90, 5, 0.85),
          // Bar 6 — lyrical phrase
          note(G4, 96, 3, 0.82), note(E4, 99, 2, 0.75), note(D4,101, 3, 0.78), note(C4,104, 7, 0.85),
          // Bar 7 — resolution, reach up for the loop
          note(A3,112, 3, 0.82), note(C4,115, 2, 0.75), note(E4,117, 3, 0.80), note(A4,120, 8, 0.92),
        ]),
      ],
      notes: [], volume: 0.72, pan: 0.1, muted: false, soloed: false, color: '#a78bfa',
      instrument: {
        oscillator: 'sine', filterFreq: 2000, filterRes: 0.3,
        attack: 0.03, decay: 0.2, sustain: 0.6, release: 1.5,
        fxReverb: 0.10, soundfont: 'vibraphone',
      },
    },
    {
      id: 'kit-lofi-bass', name: 'Bass', type: 'synth',
      clips: [
        // Walking electric bass following Am - F (8 bars)
        clip('kit-lofi-b1', 'Am - F Bass', 0, BARS, [
          // Bar 0 (Am root A2):
          note(A2,  0, 3, 0.90), note(C3,  4, 2, 0.75), note(E3,  6, 2, 0.78),
          note(A2,  8, 4, 0.82), note(G2, 12, 4, 0.75),
          // Bar 1 (Am cont):
          note(A2, 16, 4, 0.88), note(C3, 21, 3, 0.75), note(E3, 25, 3, 0.78), note(G2, 29, 3, 0.70),
          // Bar 2 (F root F2):
          note(F2, 32, 3, 0.90), note(A2, 36, 2, 0.75), note(C3, 38, 2, 0.78),
          note(F2, 40, 4, 0.82), note(E2, 44, 4, 0.72),
          // Bar 3 (F cont):
          note(F2, 48, 4, 0.88), note(A2, 53, 3, 0.75), note(C3, 57, 3, 0.78), note(E2, 61, 3, 0.70),
          // Bar 4 (Am):
          note(A2, 64, 3, 0.90), note(C3, 68, 2, 0.75), note(E3, 70, 2, 0.78),
          note(A2, 72, 4, 0.82), note(G2, 76, 4, 0.75),
          // Bar 5 (Am cont):
          note(A2, 80, 4, 0.88), note(C3, 85, 3, 0.75), note(E3, 89, 3, 0.78), note(G2, 93, 3, 0.70),
          // Bar 6 (F):
          note(F2, 96, 3, 0.90), note(A2,100, 2, 0.75), note(C3,102, 2, 0.78),
          note(F2,104, 4, 0.82), note(E2,108, 4, 0.72),
          // Bar 7 (F → Am anticipation):
          note(F2,112, 4, 0.88), note(A2,117, 3, 0.78), note(E3,121, 3, 0.80), note(A2,125, 3, 0.82),
        ]),
      ],
      notes: [], volume: 0.88, pan: -0.05, muted: false, soloed: false, color: '#22d3ee',
      instrument: {
        oscillator: 'triangle', filterFreq: 1000, filterRes: 0.5,
        attack: 0.01, decay: 0.12, sustain: 0.70, release: 0.40,
        soundfont: 'electric_bass_finger',
      },
    },
    {
      id: 'kit-lofi-drums', name: 'Drums', type: 'drums',
      drumClips: [
        drumClip(
          'kit-lofi-d1', 'Shuffle', 0, BARS,
          [0, 10],                    // kick: beat 1 and "3and" (swung anticipation)
          [4, 12],                    // snare: beats 2 and 4
          [0, 3, 6, 9, 12, 15],       // hihat: swung 8th feel
          [6],                        // open hat: off-beat lift
          [],                         // clap
          [],                         // perc
          [],                         // tom
          [2, 6, 10, 14],             // shaker: 8th upbeats
        ),
      ],
      activeDrumClipId: 'kit-lofi-d1',
      drumVolumes:      [1.0, 0.9, 0.75, 0.75, 0.7, 0.65, 0.65, 0.6],
      drumVelocities:   DEFAULT_DRUM_VELOCITIES,
      notes: [], clips: [], volume: 0.85, pan: 0, muted: false, soloed: false, color: '#06b6d4',
      instrument: { oscillator: 'square', filterFreq: 3000, filterRes: 1, attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
    },
  ],
}

// ── 2. House ──────────────────────────────────────────────────────────────────
const HOUSE: GenreKit = {
  id: 'house',
  name: 'House',
  emoji: '🔊',
  description: '4-on-the-floor kick, punchy Gm chord stabs, and a driving bass line across 8 bars.',
  color: '#f59e0b',
  bpm: 128,
  projectName: 'House Party',
  tracks: [
    {
      id: 'kit-house-stab', name: 'Chord Stab', type: 'synth',
      clips: [
        // 8-bar clip: Gm stabs repeating every 2 bars
        clip('kit-house-c1', 'Gm Stab', 0, BARS, [
          // Bar 0: 4 stabs
          note(G4,  2, 2, 0.85), note(Bb4,  2, 2, 0.75), note(D5,  2, 2, 0.70),
          note(G4, 10, 2, 0.80), note(Bb4, 10, 2, 0.70), note(D5, 10, 2, 0.65),
          note(G4, 18, 2, 0.85), note(Bb4, 18, 2, 0.75), note(D5, 18, 2, 0.70),
          note(G4, 26, 2, 0.80), note(Bb4, 26, 2, 0.70), note(D5, 26, 2, 0.65),
          // Bar 2:
          note(G4, 34, 2, 0.85), note(Bb4, 34, 2, 0.75), note(D5, 34, 2, 0.70),
          note(G4, 42, 2, 0.80), note(Bb4, 42, 2, 0.70), note(D5, 42, 2, 0.65),
          note(G4, 50, 2, 0.85), note(Bb4, 50, 2, 0.75), note(D5, 50, 2, 0.70),
          note(G4, 58, 2, 0.80), note(Bb4, 58, 2, 0.70), note(D5, 58, 2, 0.65),
          // Bar 4:
          note(G4, 66, 2, 0.85), note(Bb4, 66, 2, 0.75), note(D5, 66, 2, 0.70),
          note(G4, 74, 2, 0.80), note(Bb4, 74, 2, 0.70), note(D5, 74, 2, 0.65),
          note(G4, 82, 2, 0.85), note(Bb4, 82, 2, 0.75), note(D5, 82, 2, 0.70),
          note(G4, 90, 2, 0.80), note(Bb4, 90, 2, 0.70), note(D5, 90, 2, 0.65),
          // Bar 6:
          note(G4, 98, 2, 0.85), note(Bb4, 98, 2, 0.75), note(D5, 98, 2, 0.70),
          note(G4,106, 2, 0.80), note(Bb4,106, 2, 0.70), note(D5,106, 2, 0.65),
          note(G4,114, 2, 0.85), note(Bb4,114, 2, 0.75), note(D5,114, 2, 0.70),
          note(G4,122, 2, 0.80), note(Bb4,122, 2, 0.70), note(D5,122, 2, 0.65),
        ]),
      ],
      notes: [], volume: 0.75, pan: 0.15, muted: false, soloed: false, color: '#f59e0b',
      instrument: {
        oscillator: 'sawtooth', filterFreq: 3500, filterRes: 2.5,
        attack: 0.003, decay: 0.09, sustain: 0.2, release: 0.12,
      },
    },
    {
      id: 'kit-house-bass', name: 'Bass', type: 'synth',
      clips: [
        // 8-bar clip: G bass pattern repeating every 2 bars
        clip('kit-house-b1', 'G Bass', 0, BARS, [
          // Bar 0:
          note(G3,  0, 2, 0.90), note(G3,  4, 1, 0.70), note(Bb3, 6, 1, 0.65),
          note(G3,  8, 2, 0.85), note(A3, 11, 1, 0.70),  note(G3, 14, 1, 0.65),
          note(G3, 16, 2, 0.90), note(G3, 20, 1, 0.70), note(Fs3,22, 1, 0.65),
          note(F3, 24, 3, 0.80), note(D3, 28, 3, 0.75),
          // Bar 2:
          note(G3, 32, 2, 0.90), note(G3, 36, 1, 0.70), note(Bb3,38, 1, 0.65),
          note(G3, 40, 2, 0.85), note(A3, 43, 1, 0.70),  note(G3, 46, 1, 0.65),
          note(G3, 48, 2, 0.90), note(G3, 52, 1, 0.70), note(Fs3,54, 1, 0.65),
          note(F3, 56, 3, 0.80), note(D3, 60, 3, 0.75),
          // Bar 4:
          note(G3, 64, 2, 0.90), note(G3, 68, 1, 0.70), note(Bb3,70, 1, 0.65),
          note(G3, 72, 2, 0.85), note(A3, 75, 1, 0.70),  note(G3, 78, 1, 0.65),
          note(G3, 80, 2, 0.90), note(G3, 84, 1, 0.70), note(Fs3,86, 1, 0.65),
          note(F3, 88, 3, 0.80), note(D3, 92, 3, 0.75),
          // Bar 6:
          note(G3, 96, 2, 0.90), note(G3,100, 1, 0.70), note(Bb3,102,1, 0.65),
          note(G3,104, 2, 0.85), note(A3,107, 1, 0.70),  note(G3,110, 1, 0.65),
          note(G3,112, 2, 0.90), note(G3,116, 1, 0.70), note(Fs3,118,1, 0.65),
          note(F3,120, 3, 0.80), note(D3,124, 3, 0.75),
        ]),
      ],
      notes: [], volume: 0.85, pan: 0, muted: false, soloed: false, color: '#10b981',
      instrument: {
        oscillator: 'square', filterFreq: 700, filterRes: 2.5,
        attack: 0.004, decay: 0.15, sustain: 0.65, release: 0.12,
      },
    },
    {
      id: 'kit-house-drums', name: 'Drums', type: 'drums',
      drumClips: [
        drumClip(
          'kit-house-d1', 'Four-on-Floor', 0, BARS,
          [0, 4, 8, 12],              // kick: every beat
          [4, 12],                    // snare: beats 2 and 4
          [0,2,4,6,8,10,12,14],       // hihat: every 8th
          [2, 6, 10, 14],             // open hat: off-8ths
          [4, 12],                    // clap: 2 and 4
          [],
          [],
          [1, 5, 9, 13],              // shaker: upbeats
        ),
      ],
      activeDrumClipId: 'kit-house-d1',
      drumVolumes:      [1.0, 0.95, 0.8, 0.8, 0.75, 0.65, 0.65, 0.6],
      drumVelocities:   DEFAULT_DRUM_VELOCITIES,
      notes: [], clips: [], volume: 0.95, pan: 0, muted: false, soloed: false, color: '#06b6d4',
      instrument: { oscillator: 'square', filterFreq: 3000, filterRes: 1, attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
    },
  ],
}

// ── 3. Trap ───────────────────────────────────────────────────────────────────
const TRAP_VELOCITIES = Array.from({ length: DRUM_ROW_COUNT }, (_, rowIdx) => {
  if (rowIdx === 3) { // hihat row — velocity variation for rolling feel
    return [0.9, 0.35, 0.8, 0.35, 0.9, 0.35, 0.8, 0.35, 0.9, 0.35, 0.8, 0.35, 0.9, 0.35, 0.8, 0.35]
  }
  return Array(16).fill(DEFAULT_STEP_VELOCITY) as number[]
})

const TRAP: GenreKit = {
  id: 'trap',
  name: 'Trap',
  emoji: '🎤',
  description: 'Dark Dm melody, rolling hi-hats, 808 bass, and a hard snare — full 8 bars.',
  color: '#ef4444',
  bpm: 140,
  projectName: 'Trap Session',
  tracks: [
    {
      id: 'kit-trap-melody', name: 'Melody', type: 'synth',
      clips: [
        clip('kit-trap-m1', 'Hook', 0, BARS, [
          // Bars 0-3 (original phrase):
          note(D4,  0, 3, 0.90), note(C4,  4, 2, 0.75), note(A3,  7, 4, 0.80),
          note(F4, 12, 2, 0.75), note(E4, 14, 2, 0.70),
          note(D4, 16, 6, 0.85),
          note(A3, 24, 3, 0.75), note(Bb3,28, 4, 0.80),
          note(A3, 33, 2, 0.70), note(G3, 36, 2, 0.70), note(F3, 39, 5, 0.80),
          note(D4, 45, 2, 0.75), note(Bb3,48, 6, 0.80),
          note(A3, 56, 8, 0.85),
          // Bars 4-7 (development — climbs higher):
          note(D4, 64, 3, 0.90), note(F4, 68, 2, 0.80), note(A4, 71, 4, 0.85),
          note(G4, 76, 4, 0.80),
          note(F4, 80, 3, 0.80), note(E4, 84, 2, 0.75), note(D4, 87, 4, 0.82),
          note(A3, 92, 3, 0.75),
          note(Bb3,96, 4, 0.82), note(A3,101, 3, 0.78), note(G3,105, 2, 0.72),
          note(F3,108, 5, 0.82),
          note(D4,114, 3, 0.88), note(A3,118, 3, 0.80), note(D3,122, 6, 0.85),
        ]),
      ],
      notes: [], volume: 0.82, pan: 0, muted: false, soloed: false, color: '#ef4444',
      instrument: {
        oscillator: 'sawtooth', filterFreq: 2200, filterRes: 1.5,
        attack: 0.005, decay: 0.18, sustain: 0.45, release: 0.35,
      },
    },
    {
      id: 'kit-trap-bass', name: '808 Bass', type: 'synth',
      clips: [
        // 8-bar 808 bass: 2-bar pattern repeating x4
        clip('kit-trap-b1', '808', 0, BARS, [
          note(D3,  0, 10, 0.95), note(A3, 12,  3, 0.80),
          note(D3, 16, 10, 0.95), note(G3, 28,  4, 0.80),
          note(D3, 32, 10, 0.95), note(A3, 44,  3, 0.80),
          note(D3, 48, 10, 0.95), note(G3, 60,  4, 0.80),
          note(D3, 64, 10, 0.95), note(A3, 76,  3, 0.80),
          note(D3, 80, 10, 0.95), note(G3, 92,  4, 0.80),
          note(D3, 96, 10, 0.95), note(A3,108,  3, 0.80),
          note(D3,112, 10, 0.95), note(G3,124,  4, 0.80),
        ]),
      ],
      notes: [], volume: 0.9, pan: 0, muted: false, soloed: false, color: '#f87171',
      instrument: {
        oscillator: 'sine', filterFreq: 350, filterRes: 1,
        attack: 0.01, decay: 1.2, sustain: 0.3, release: 1.5,
      },
    },
    {
      id: 'kit-trap-drums', name: 'Drums', type: 'drums',
      drumClips: [
        drumClip(
          'kit-trap-d1', 'Trap Beat', 0, BARS,
          [0, 3, 9, 13],                               // kick: syncopated trap
          [8],                                         // snare: hard on beat 3
          [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],    // hihat: 16th rolls
          [6, 15],                                     // open hat: accent hits
          [8],                                         // clap: doubles snare
          [],
          [3, 9],                                      // tom: mirrors kick
          [],
        ),
      ],
      activeDrumClipId: 'kit-trap-d1',
      drumVolumes:      [1.0, 0.95, 0.8, 0.7, 0.72, 0.65, 0.75, 0.55],
      drumVelocities:   TRAP_VELOCITIES,
      notes: [], clips: [], volume: 0.95, pan: 0, muted: false, soloed: false, color: '#06b6d4',
      instrument: { oscillator: 'square', filterFreq: 3000, filterRes: 1, attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
    },
  ],
}

// ── 4. Chill R&B ──────────────────────────────────────────────────────────────
const RNB: GenreKit = {
  id: 'rnb',
  name: 'Chill R&B',
  emoji: '🎷',
  description: 'Silky Fmaj7 pad cycling with Dm7, a smooth melodic phrase across all 8 bars.',
  color: '#ec4899',
  bpm: 90,
  projectName: 'Golden Hour',
  tracks: [
    {
      id: 'kit-rnb-pad', name: 'Soul Pad', type: 'synth',
      clips: [
        // Single 8-bar clip: Fmaj7 - Dm7 cycling (2-bar units)
        clip('kit-rnb-c1', 'F - Dm', 0, BARS, [
          // Bar 0-1: Fmaj7 (F3 A3 C4 E4)
          note(F3,  0, 30, 0.55), note(A3,  0, 30, 0.50), note(C4,  0, 30, 0.45), note(E4,  0, 30, 0.40),
          // Bar 2-3: Dm7 (D4 F4 A4 C5)
          note(D4, 32, 30, 0.55), note(F4, 32, 30, 0.50), note(A4, 32, 30, 0.45), note(C5, 32, 30, 0.40),
          // Bar 4-5: Fmaj7
          note(F3, 64, 30, 0.55), note(A3, 64, 30, 0.50), note(C4, 64, 30, 0.45), note(E4, 64, 30, 0.40),
          // Bar 6-7: Dm7
          note(D4, 96, 30, 0.55), note(F4, 96, 30, 0.50), note(A4, 96, 30, 0.45), note(C5, 96, 30, 0.40),
        ]),
      ],
      notes: [], volume: 0.75, pan: 0.1, muted: false, soloed: false, color: '#ec4899',
      instrument: {
        oscillator: 'sine', filterFreq: 1600, filterRes: 0.4,
        attack: 0.1, decay: 0.3, sustain: 0.85, release: 2.5,
        fxReverb: 0.2, soundfont: 'electric_piano_1',
      },
    },
    {
      id: 'kit-rnb-melody', name: 'Melody', type: 'synth',
      clips: [
        clip('kit-rnb-m1', 'Phrase', 0, BARS, [
          // Bars 0-3 (original smooth phrase):
          note(F4,  0, 2, 0.80), note(G4,  3, 1, 0.70), note(A4,  5, 3, 0.75),
          note(G4,  9, 2, 0.65), note(F4, 12, 4, 0.80),
          note(E4, 18, 2, 0.70), note(F4, 21, 2, 0.75), note(A4, 24, 4, 0.80),
          note(G4, 30, 2, 0.70),
          note(D5, 34, 3, 0.80), note(C5, 38, 2, 0.75), note(A4, 41, 3, 0.70),
          note(G4, 46, 2, 0.65), note(F4, 50, 3, 0.75), note(E4, 55, 4, 0.70),
          note(D4, 60, 4, 0.80),
          // Bars 4-7 (deeper, more emotional):
          note(F4, 64, 3, 0.82), note(A4, 68, 3, 0.78), note(C5, 72, 4, 0.85),
          note(A4, 77, 3, 0.80), note(G4, 81, 3, 0.75),
          note(F4, 85, 3, 0.80), note(E4, 89, 7, 0.85),
          note(D5, 96, 3, 0.85), note(C5,100, 2, 0.80), note(A4,103, 4, 0.82),
          note(G4,108, 3, 0.75),
          note(A4,112, 3, 0.85), note(C5,116, 3, 0.88), note(D5,119, 2, 0.90),
          note(C5,122, 6, 0.88),
        ]),
      ],
      notes: [], volume: 0.8, pan: -0.1, muted: false, soloed: false, color: '#f9a8d4',
      instrument: {
        oscillator: 'triangle', filterFreq: 2800, filterRes: 0.5,
        attack: 0.02, decay: 0.18, sustain: 0.65, release: 1.2,
        fxReverb: 0.12, soundfont: 'vibraphone',
      },
    },
    {
      id: 'kit-rnb-drums', name: 'Groove', type: 'drums',
      drumClips: [
        drumClip(
          'kit-rnb-d1', 'R&B Groove', 0, BARS,
          [0, 10],                    // kick: beat 1 and "3and" (laid-back)
          [4, 12],                    // snare: beats 2 and 4
          [0, 4, 6, 8, 12, 14],       // hihat: loose pocket groove
          [6],                        // open hat: breath before beat 3
          [12],                       // clap: beat 4
          [4, 14],                    // perc: accents
          [],
          [2, 6, 10, 14],             // shaker: off-beats
        ),
      ],
      activeDrumClipId: 'kit-rnb-d1',
      drumVolumes:      [1.0, 0.9, 0.78, 0.75, 0.72, 0.65, 0.6, 0.62],
      drumVelocities:   DEFAULT_DRUM_VELOCITIES,
      notes: [], clips: [], volume: 0.82, pan: 0, muted: false, soloed: false, color: '#06b6d4',
      instrument: { oscillator: 'square', filterFreq: 3000, filterRes: 1, attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
    },
  ],
}

// ── 5. Jazz ───────────────────────────────────────────────────────────────────
const JAZZ: GenreKit = {
  id: 'jazz',
  name: 'Jazz',
  emoji: '🎺',
  description: 'ii-V-i voicings in D minor: grand piano chords, alto sax melody, walking acoustic bass, and a swung ride.',
  color: '#06b6d4',
  bpm: 120,
  projectName: 'Late Night Jazz',
  tracks: [
    {
      id: 'kit-jazz-chords', name: 'Piano', type: 'synth',
      clips: [
        // 8-bar clip: two full ii-V-i cycles
        clip('kit-jazz-c1', 'ii-V-i × 2', 0, BARS, [
          // First cycle — bars 0-3:
          note(E3,  0, 30, 0.65), note(G3,  0, 30, 0.55), note(Bb3, 0, 30, 0.50), note(D4,  0, 30, 0.50),
          note(A3, 16, 14, 0.65), note(Cs4,16, 14, 0.55), note(E4, 16, 14, 0.50), note(G4, 16, 14, 0.50),
          note(D4, 32, 28, 0.70), note(F4, 32, 28, 0.55), note(A4, 32, 28, 0.50), note(C5, 32, 28, 0.45),
          // Second cycle — bars 4-7:
          note(E3, 64, 30, 0.65), note(G3, 64, 30, 0.55), note(Bb3,64, 30, 0.50), note(D4, 64, 30, 0.50),
          note(A3, 80, 14, 0.65), note(Cs4,80, 14, 0.55), note(E4, 80, 14, 0.50), note(G4, 80, 14, 0.50),
          note(D4, 96, 28, 0.70), note(F4, 96, 28, 0.55), note(A4, 96, 28, 0.50), note(C5, 96, 28, 0.45),
        ]),
      ],
      notes: [], volume: 0.75, pan: 0.2, muted: false, soloed: false, color: '#06b6d4',
      instrument: {
        oscillator: 'triangle', filterFreq: 2200, filterRes: 0.5,
        attack: 0.02, decay: 0.15, sustain: 0.75, release: 0.9,
        fxReverb: 0.1, soundfont: 'acoustic_grand_piano',
      },
    },
    {
      id: 'kit-jazz-sax', name: 'Alto Sax', type: 'synth',
      clips: [
        // 8-bar alto sax melody over ii-V-i in D minor
        clip('kit-jazz-s1', 'Sax Solo', 0, BARS, [
          // Bars 0-1 (Em7b5 — use E G Bb D):
          note(D4,  1, 2, 0.72), note(E4,  3, 2, 0.78), note(G4,  5, 4, 0.85),
          note(Bb4,10, 3, 0.80), note(A4, 14, 2, 0.75),
          note(G4, 16, 4, 0.82), note(E4, 21, 3, 0.78), note(D4, 25, 3, 0.75), note(Bb3,29, 3, 0.70),
          // Bar 2 (A7 — target Cs E G):
          note(Cs4,32, 3, 0.85), note(E4, 36, 2, 0.80), note(G4, 39, 4, 0.82), note(A4, 44, 4, 0.88),
          // Bar 3 (Dm — resolve):
          note(D4, 48, 4, 0.85), note(F4, 53, 3, 0.80), note(A4, 57, 5, 0.85), note(D4, 63, 1, 0.75),
          // Bars 4-5 (second cycle Em7b5 — higher energy):
          note(Bb4,64, 3, 0.88), note(G4, 68, 2, 0.82), note(E4, 71, 3, 0.80),
          note(D4, 75, 2, 0.75), note(G4, 78, 2, 0.78),
          note(Bb4,80, 2, 0.85), note(A4, 83, 3, 0.82), note(G4, 87, 2, 0.78),
          note(E4, 90, 3, 0.75), note(D4, 94, 2, 0.72),
          // Bar 6 (A7):
          note(E4, 96, 2, 0.82), note(Cs4,99, 3, 0.85), note(A3,103, 3, 0.80), note(Cs4,107, 4, 0.88),
          // Bar 7 (Dm — big resolve):
          note(D4,112, 4, 0.90), note(A4,117, 3, 0.85), note(F4,121, 4, 0.80), note(D4,126, 2, 0.88),
        ]),
      ],
      notes: [], volume: 0.78, pan: -0.1, muted: false, soloed: false, color: '#f59e0b',
      instrument: {
        oscillator: 'sawtooth', filterFreq: 3000, filterRes: 1,
        attack: 0.03, decay: 0.1, sustain: 0.8, release: 0.4,
        fxReverb: 0.08, soundfont: 'alto_sax',
      },
    },
    {
      id: 'kit-jazz-bass', name: 'Walk Bass', type: 'synth',
      clips: [
        // 8-bar walking bass: original 4-bar pattern repeated
        clip('kit-jazz-b1', 'Walking', 0, BARS, [
          // First 4 bars:
          note(D3,  0, 3, 0.80), note(E3,  4, 3, 0.75), note(G3,  8, 3, 0.75), note(Bb3,12, 3, 0.70),
          note(A3, 16, 3, 0.80), note(E3, 20, 3, 0.75), note(Cs4,24, 3, 0.70), note(G3, 28, 3, 0.65),
          note(D3, 32, 3, 0.85), note(F3, 36, 3, 0.75), note(A3, 40, 3, 0.75), note(C4, 44, 3, 0.70),
          note(D3, 48, 3, 0.85), note(F3, 52, 3, 0.75), note(Bb3,56, 3, 0.70), note(A3, 60, 4, 0.75),
          // Second 4 bars (repeat with slight intensity variation):
          note(D3, 64, 3, 0.82), note(E3, 68, 3, 0.76), note(G3, 72, 3, 0.76), note(Bb3,76, 3, 0.72),
          note(A3, 80, 3, 0.82), note(E3, 84, 3, 0.76), note(Cs4,88, 3, 0.72), note(G3, 92, 3, 0.67),
          note(D3, 96, 3, 0.87), note(F3,100, 3, 0.77), note(A3,104, 3, 0.77), note(C4,108, 3, 0.72),
          note(D3,112, 3, 0.87), note(F3,116, 3, 0.77), note(Bb3,120,3, 0.72), note(A3,124, 4, 0.77),
        ]),
      ],
      notes: [], volume: 0.88, pan: -0.15, muted: false, soloed: false, color: '#22d3ee',
      instrument: {
        oscillator: 'triangle', filterFreq: 1400, filterRes: 0.5,
        attack: 0.01, decay: 0.12, sustain: 0.6, release: 0.5,
        soundfont: 'acoustic_bass',
      },
    },
    {
      id: 'kit-jazz-drums', name: 'Ride', type: 'drums',
      drumClips: [
        drumClip(
          'kit-jazz-d1', 'Jazz Swing', 0, BARS,
          [0, 9],                       // kick: 1 and "2a" (walking feel)
          [4, 12],                      // snare: brushed 2 and 4
          [0, 3, 4, 7, 8, 11, 12, 15],  // hihat: swung ride pattern
          [3, 11],                      // open hat: swing anticipation
          [],
          [2, 10],                      // perc: ghost notes
          [],
          [6, 14],                      // shaker: swing texture
        ),
      ],
      activeDrumClipId: 'kit-jazz-d1',
      drumVolumes:      [0.9, 0.78, 0.65, 0.72, 0.72, 0.55, 0.55, 0.5],
      drumVelocities:   DEFAULT_DRUM_VELOCITIES,
      notes: [], clips: [], volume: 0.72, pan: 0, muted: false, soloed: false, color: '#06b6d4',
      instrument: { oscillator: 'square', filterFreq: 3000, filterRes: 1, attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
    },
  ],
}

// ── 6. Synthwave ──────────────────────────────────────────────────────────────
const SYNTHWAVE: GenreKit = {
  id: 'synthwave',
  name: 'Synthwave',
  emoji: '🌆',
  description: 'Soaring sawtooth lead, driving Am arpeggios across all 8 bars, and a punchy groove.',
  color: '#a855f7',
  bpm: 110,
  projectName: 'Neon Drive',
  tracks: [
    {
      id: 'kit-sw-lead', name: 'Lead', type: 'synth',
      clips: [
        clip('kit-sw-l1', 'Lead', 0, BARS, [
          // Bars 0-3 (original phrase):
          note(A4,  0, 3, 0.85), note(G4,  4, 2, 0.75), note(F4,  7, 2, 0.75),
          note(E4, 10, 4, 0.80),
          note(A4, 16, 3, 0.85), note(C5, 20, 2, 0.80), note(B4, 23, 2, 0.75),
          note(A4, 26, 6, 0.80),
          note(G4, 34, 4, 0.75), note(F4, 40, 2, 0.70), note(E4, 43, 3, 0.75),
          note(D4, 48, 4, 0.80), note(E4, 54, 3, 0.75), note(A4, 58, 6, 0.90),
          // Bars 4-7 (darker build then climax):
          note(E4, 64, 3, 0.85), note(D4, 68, 2, 0.75), note(C4, 71, 2, 0.75),
          note(A3, 74, 6, 0.80),
          note(E4, 80, 3, 0.85), note(G4, 84, 2, 0.80), note(A4, 87, 5, 0.85),
          note(C5, 93, 3, 0.80),
          note(B4, 96, 4, 0.88), note(A4,101, 3, 0.82), note(G4,105, 2, 0.78),
          note(F4,108, 4, 0.82),
          note(E4,112, 4, 0.88), note(D4,117, 3, 0.80), note(A4,121, 7, 0.92),
        ]),
      ],
      notes: [], volume: 0.80, pan: 0, muted: false, soloed: false, color: '#a855f7',
      instrument: {
        oscillator: 'sawtooth', filterFreq: 3200, filterRes: 2,
        attack: 0.01, decay: 0.15, sustain: 0.7, release: 0.5,
        fxReverb: 0.15, fxDelay: 0.2,
      },
    },
    {
      id: 'kit-sw-arp', name: 'Arpeggio', type: 'synth',
      clips: [
        // 8-bar clip: Am→F arpeggio repeating every 2 bars
        clip('kit-sw-a1', 'Am→F Arp', 0, BARS, [
          // Bar 0 (Am):
          note(A3,  0, 2, 0.75), note(E4,  2, 2, 0.60), note(A3,  4, 2, 0.70),
          note(C4,  6, 2, 0.60), note(E4,  8, 2, 0.70), note(A3, 10, 2, 0.60),
          note(C4, 12, 2, 0.70), note(E4, 14, 2, 0.60),
          // Bar 1 (F):
          note(F3, 16, 2, 0.75), note(A3, 18, 2, 0.60), note(C4, 20, 2, 0.70),
          note(F3, 22, 2, 0.60), note(A3, 24, 2, 0.70), note(C4, 26, 2, 0.60),
          note(E4, 28, 2, 0.70), note(G4, 30, 2, 0.65),
          // Bar 2 (Am):
          note(A3, 32, 2, 0.75), note(E4, 34, 2, 0.60), note(A3, 36, 2, 0.70),
          note(C4, 38, 2, 0.60), note(E4, 40, 2, 0.70), note(A3, 42, 2, 0.60),
          note(C4, 44, 2, 0.70), note(E4, 46, 2, 0.60),
          // Bar 3 (F):
          note(F3, 48, 2, 0.75), note(A3, 50, 2, 0.60), note(C4, 52, 2, 0.70),
          note(F3, 54, 2, 0.60), note(A3, 56, 2, 0.70), note(C4, 58, 2, 0.60),
          note(E4, 60, 2, 0.70), note(G4, 62, 2, 0.65),
          // Bar 4 (Am):
          note(A3, 64, 2, 0.75), note(E4, 66, 2, 0.60), note(A3, 68, 2, 0.70),
          note(C4, 70, 2, 0.60), note(E4, 72, 2, 0.70), note(A3, 74, 2, 0.60),
          note(C4, 76, 2, 0.70), note(E4, 78, 2, 0.60),
          // Bar 5 (F):
          note(F3, 80, 2, 0.75), note(A3, 82, 2, 0.60), note(C4, 84, 2, 0.70),
          note(F3, 86, 2, 0.60), note(A3, 88, 2, 0.70), note(C4, 90, 2, 0.60),
          note(E4, 92, 2, 0.70), note(G4, 94, 2, 0.65),
          // Bar 6 (Am):
          note(A3, 96, 2, 0.75), note(E4, 98, 2, 0.60), note(A3,100, 2, 0.70),
          note(C4,102, 2, 0.60), note(E4,104, 2, 0.70), note(A3,106, 2, 0.60),
          note(C4,108, 2, 0.70), note(E4,110, 2, 0.60),
          // Bar 7 (F):
          note(F3,112, 2, 0.75), note(A3,114, 2, 0.60), note(C4,116, 2, 0.70),
          note(F3,118, 2, 0.60), note(A3,120, 2, 0.70), note(C4,122, 2, 0.60),
          note(E4,124, 2, 0.70), note(G4,126, 2, 0.65),
        ]),
      ],
      notes: [], volume: 0.72, pan: -0.2, muted: false, soloed: false, color: '#c084fc',
      instrument: {
        oscillator: 'sawtooth', filterFreq: 1200, filterRes: 2.5,
        attack: 0.001, decay: 0.12, sustain: 0.3, release: 0.15,
      },
    },
    {
      id: 'kit-sw-drums', name: 'Drums', type: 'drums',
      drumClips: [
        drumClip(
          'kit-sw-d1', 'Electronic', 0, BARS,
          [0, 4, 8, 12],                        // kick: 4-on-floor
          [4, 12],                              // snare: 2 and 4
          [0,2,4,6,8,10,12,14],                 // hihat: every 8th
          [2, 10],                              // open hat: 80s gated feel
          [4, 12],                              // clap: 2 and 4
          [],
          [],
          [1, 3, 5, 7, 9, 11, 13, 15],          // shaker: 16th pulse
        ),
      ],
      activeDrumClipId: 'kit-sw-d1',
      drumVolumes:      [1.0, 0.95, 0.85, 0.75, 0.72, 0.65, 0.65, 0.55],
      drumVelocities:   DEFAULT_DRUM_VELOCITIES,
      notes: [], clips: [], volume: 0.95, pan: 0, muted: false, soloed: false, color: '#06b6d4',
      instrument: { oscillator: 'square', filterFreq: 3000, filterRes: 1, attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
    },
  ],
}

export const GENRE_KITS: GenreKit[] = [LOFI, JAZZ, SYNTHWAVE]
