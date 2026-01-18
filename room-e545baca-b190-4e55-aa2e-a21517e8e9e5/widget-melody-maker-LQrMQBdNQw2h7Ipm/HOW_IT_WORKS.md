# Melody Maker Widget - Comprehensive Guide

## Overview

Melody Maker is a sophisticated music creation widget that combines interactive piano playing, AI-powered melody generation, drum accompaniment, and real-time visual art generation. It leverages Google's Magenta.js library for machine learning-based music generation and implements a custom audio synthesis system.

---

## Architecture

### Core Technologies

1. **React 18** - Component-based UI framework
2. **Magenta.js** - Google's machine learning library for music and art
3. **Web Audio API** - Real-time audio synthesis
4. **HTML5 Canvas** - Real-time visual art rendering
5. **Tailwind CSS** - Utility-first styling (CDN version)

### File Structure

```
widget-melody-maker-LQrMQBdNQw2h7Ipm/
├── template.jsx                 # Main widget component
├── components/
│   ├── Piano.jsx               # Virtual piano keyboard
│   ├── MelodyTimeline.jsx      # Visual note sequence display
│   ├── ControlPanel.jsx        # Playback & generation controls
│   ├── CurrentChord.jsx        # Real-time chord display
│   ├── SaveDialog.jsx          # Save melody interface
│   ├── Library.jsx             # Saved melodies browser
│   └── VisualCanvas.jsx        # Real-time art visualization
├── utils/
│   ├── audioSynth.js           # Audio synthesis engine
│   ├── constants.js            # Color themes & note mappings
│   └── magentaHelpers.js       # Magenta AI utilities
└── HOW_IT_WORKS.md            # This file
```

---

## Component Breakdown

### 1. Main Component (template.jsx)

**Purpose**: Orchestrates the entire widget, manages state, and coordinates between all sub-components.

**Key State Variables**:

- `userSequence` - Notes played by the user (stored in useStorage)
- `aiMelody` - AI-generated continuation notes
- `aiDrums` - AI-generated drum patterns
- `activeNotes` - Currently playing piano notes (Set)
- `activeDrums` - Currently playing drum hits (Set)
- `tempo` - Beats per minute (default: 120)
- `musicStyle` - Style selection (balanced, classical, jazz, pop, electronic, ambient)
- `prePolishBackup` - Backup before AI polishing for undo

**Core Hooks**:

- `useStorage` - Persistent widget-local data
- `useFiles` - File-based melody library storage
- `useRef` - Audio context, synths, Magenta models, playback timers

**Lifecycle**:

1. **Initialization Phase**:
   ```
   Load Tailwind CSS → Load Magenta.js → Initialize Audio Context → 
   Load MusicRNN Model → Load DrumRNN Model → Ready
   ```

2. **User Interaction Phase**:
   ```
   User plays keys → Create note events → Record to sequence → 
   Display in timeline → Update visual art
   ```

3. **AI Generation Phase**:
   ```
   User clicks "Generate" → Convert to Magenta format → 
   Run MusicRNN → Parse results → Add to aiMelody
   ```

4. **Playback Phase**:
   ```
   Schedule note events → Play with synth → 
   Update activeNotes → Trigger visual effects → 
   Loop drums to match duration
   ```

---

### 2. Audio System (utils/audioSynth.js)

#### PianoSynth Class

**Purpose**: Synthesize realistic piano sounds with style variations.

**How it works**:

1. **Oscillator Setup**:
   - Creates multiple oscillators per note (2-5 depending on style)
   - Uses sine/triangle waves for harmonics
   - Adds slight detuning for richness

2. **ADSR Envelope**:
   - **Attack**: How quickly the note reaches full volume
   - **Decay**: Initial volume drop
   - **Sustain**: Held note volume level
   - **Release**: Fade-out time after key release

3. **Style Variations**:
   ```javascript
   classical: {
     attack: 0.02,  // Slow attack for smooth sound
     harmonics: 4,  // Rich harmonic content
     reverb: high   // Long sustain
   }
   
   electronic: {
     attack: 0.001, // Fast attack for sharp sound
     harmonics: 1,  // Clean, simple waveform
     reverb: low    // Short sustain
   }
   ```

4. **Frequency Calculation**:
   ```javascript
   frequency = 440 * Math.pow(2, (noteNumber - 69) / 12)
   // A4 (note 69) = 440 Hz
   // Each semitone is 2^(1/12) ratio
   ```

#### DrumSynth Class

**Purpose**: Generate percussive drum sounds.

**Drum Types**:

1. **Kick** - Low frequency (60Hz) with pitch envelope
2. **Snare** - White noise with bandpass filter
3. **Hi-hat** - High frequency noise burst
4. **Open Hat** - Longer decay hi-hat

**Synthesis Method**:
- Uses noise generators for percussion
- Applies frequency shaping with filters
- Short envelopes (50-200ms) for punchy sounds

---

### 3. Piano Component

**Purpose**: Interactive 2-octave piano keyboard (C4-C5).

**Features**:

- **Mouse/Touch Input**: Click and drag to play multiple notes
- **Physical Keyboard**: QWERTY keys mapped to piano notes
  ```
  Lower octave: A S D F G H J K L ; '
  Upper octave: Q W E R T Y U I O P [ ]
  ```
- **Visual Feedback**: Pressed keys highlighted with color coding
- **Chord Support**: Hold multiple keys to play chords

**Implementation**:
```javascript
// Each key is a button element
<button
  onMouseDown={() => onKeyDown(note)}
  onMouseUp={() => onKeyUp(note)}
  onMouseEnter={(e) => e.buttons === 1 && onKeyDown(note)}
  // Visual state based on pressedKeys Set
  style={{ 
    background: pressedKeys.has(note) ? activeColor : defaultColor 
  }}
/>
```

---

### 4. Magenta Integration (utils/magentaHelpers.js)

#### MusicRNN Model

**Purpose**: Neural network trained to generate melodic continuations.

**How it works**:

1. **Input Format** - Quantized Note Sequence:
   ```javascript
   {
     notes: [
       {
         pitch: 60,              // Middle C
         quantizedStartStep: 0,  // When note starts
         quantizedEndStep: 4,    // When note ends
         velocity: 80            // How hard it's played
       }
     ],
     totalQuantizedSteps: 32,
     quantizationInfo: {
       stepsPerQuarter: 4        // 4 steps per quarter note
     }
   }
   ```

2. **Temperature Parameter**:
   - Low (0.5): Conservative, predictable melodies
   - Medium (1.0): Balanced creativity
   - High (1.5): Experimental, unexpected notes

3. **Generation Process**:
   ```
   User melody → Convert to quantized format → 
   Feed to MusicRNN → Generate continuation → 
   Parse back to our format → Add to timeline
   ```

#### DrumRNN Model

**Purpose**: Generate drum patterns that complement melodies.

**Process**:
1. Create seed pattern (basic kick-snare-hihat)
2. Feed to DrumRNN
3. Generate pattern matching melody duration
4. Map MIDI drum notes to our drum types:
   - 36 → kick
   - 38 → snare
   - 42 → hi-hat
   - 46 → open hat

#### Algorithmic Fallback

When Magenta models aren't available or fail:

**Melody Generation**:
- Analyzes user sequence for common intervals
- Generates notes within same key
- Uses weighted random selection
- Applies style-based probabilities for chords

**Drum Generation**:
- Creates basic 4/4 pattern
- Kick on beats 1 and 3
- Snare on beats 2 and 4
- Hi-hat on every beat

---

### 5. Visual Art System (VisualCanvas.jsx)

**Purpose**: Create real-time generative art that responds to music.

#### Particle System

**Note Particles**:

1. **Creation**:
   ```javascript
   {
     x, y: Center ± random offset
     size: 20-50 pixels
     hue: Mapped from note pitch (60 → 180° = cyan)
     life: 120 frames (2 seconds at 60fps)
     velocity: Random direction
   }
   ```

2. **Color Mapping**:
   ```
   Low notes (C3)  → Blue/Purple  (240°)
   Middle C (C4)   → Cyan         (180°)
   High notes (C6) → Red/Orange   (0°)
   ```

3. **Rendering**:
   - Outer glow (large, transparent)
   - Inner core (small, bright)
   - Pulse effect using sine wave
   - Physics-based movement with friction

#### Drum Effects

**Visual Patterns**:

1. **Kick** - Expanding red ring
2. **Snare** - Cyan radiating lines (12 spokes)
3. **Hi-hat** - Yellow scattered dots (20 particles)
4. **Open Hat** - Green wavy circle (50 segments)

**Animation**:
- Life: 30 frames (0.5 seconds)
- Alpha fades with life ratio
- Size increases as life decreases
- Rotation for dynamic effect

#### Canvas Rendering Loop

```javascript
1. Clear canvas with fade (trail effect)
2. Update particle physics:
   - Decrement life
   - Apply velocity
   - Apply friction
3. Draw particles:
   - Outer glow with gradient
   - Inner bright core
4. Update drum effects:
   - Grow and fade
   - Rotate
5. Remove dead particles/effects
6. Request next frame
```

---

### 6. Storage System

#### Widget-Local Storage (useStorage)

**Persisted Data**:
- `userSequence` - User-played notes
- `aiMelody` - AI-generated notes
- `aiDrums` - Drum patterns
- `tempo` - BPM setting
- `musicStyle` - Style selection
- `pianoVolume` - Piano volume (0-1)
- `drumVolume` - Drum volume (0-1)
- `prePolishBackup` - Undo data

**Format**:
```javascript
{
  notes: [60, 64, 67],  // C major chord
  time: timestamp,      // When recorded
  duration: 0.5,        // How long (seconds)
  isChord: true         // Single note or chord
}
```

#### File-Based Storage (useFiles)

**Melody Library** (`files/melodies/`):

Each saved melody:
```javascript
{
  name: "Jazz Improv #3",
  userSequence: [...],
  aiMelody: [...],
  aiDrums: [...],
  tempo: 120,
  createdAt: "2026-01-18T19:30:00Z",
  noteCount: 24,
  drumCount: 96,
  favorite: false
}
```

**File Operations**:
- `melodiesFiles.write(id, data)` - Save melody
- `melodiesFiles.read(id)` - Load melody
- `melodiesFiles.delete(id)` - Remove melody
- `melodiesFiles.list()` - Get all IDs

---

### 7. Playback System

#### Note Scheduling

**Process**:
```javascript
1. Combine userSequence + aiMelody
2. Calculate cumulative timing:
   t0 = 0
   t1 = t0 + duration[0]
   t2 = t1 + duration[1]
   ...
3. Schedule each note:
   setTimeout(() => playChord(notes), cumulativeTime * 1000)
4. Update visual feedback:
   setActiveNotes(new Set(notes))
```

#### Drum Looping

**Problem**: Drums shorter than melody need to loop.

**Solution**:
```javascript
1. Find drum pattern duration
2. Calculate loops needed: ceil(melodyDuration / drumDuration)
3. For each loop:
   Schedule drums with offset = loop * drumDuration
4. Only schedule if within melody duration
```

---

### 8. Music Styles

Each style affects:
- Synth parameters (attack, harmonics, reverb)
- Chord probability
- Melodic range
- Temperature for AI generation

**Style Configurations**:

| Style | Attack | Harmonics | Chord % | Temperature |
|-------|--------|-----------|---------|-------------|
| Classical | 0.02s | 4 | 40% | 0.8 |
| Jazz | 0.01s | 3 | 50% | 1.2 |
| Pop | 0.005s | 2 | 35% | 1.0 |
| Electronic | 0.001s | 1 | 15% | 1.1 |
| Ambient | 0.1s | 5 | 60% | 0.7 |
| Balanced | 0.01s | 2 | 25% | 1.0 |

---

### 9. Polish Feature

**Purpose**: Smooth out rough melodies using AI.

**How it works**:

1. **Backup** - Save current state for undo
2. **Try MusicRNN**:
   - Convert entire melody to quantized format
   - Ask model to continue with low temperature (0.8)
   - Use result if reasonable length
3. **Fallback to Algorithm**:
   - Remove awkward jumps (> 7 semitones)
   - Smooth stepwise motion
   - Adjust timing for better rhythm
4. **Split Result**:
   - Maintain ratio of user/AI notes
   - Replace userSequence and aiMelody
5. **Undo Available**: Restore from backup if needed

---

### 10. Keyboard Controls

**Piano Playing**:
- QWERTY row → Upper octave (C5-C6)
- ASDF row → Lower octave (C4-B4)
- Hold multiple keys → Play chords
- Space → Record current chord

**Modifiers**:
- Ctrl/Cmd + Click note → Select for editing
- Shift + arrows → Transpose selected
- Escape → Clear selection

---

## Data Flow

### 1. User Plays Note

```
Physical keyboard press
  ↓
handlePhysicalKeyDown()
  ↓
startNote(noteNumber)
  ↓
PianoSynth.startNote()
  ↓
Web Audio oscillators created
  ↓
setActiveNotes() → Visual feedback
  ↓
setCurrentChord() → Add to chord
  ↓
recordChord() on release
  ↓
Add to userSequence
  ↓
Timeline updates
```

### 2. AI Generation

```
User clicks "Generate AI Melody"
  ↓
generateMelody()
  ↓
Check userSequence.length >= 4
  ↓
Convert to Magenta quantized format
  ↓
musicRNN.continueSequence()
  ↓
Parse result notes
  ↓
Filter for new notes only
  ↓
Group simultaneous notes into chords
  ↓
Convert back to our format
  ↓
setAiMelody()
  ↓
Timeline shows new notes
```

### 3. Playback

```
User clicks "Play"
  ↓
playMelody()
  ↓
Combine userSequence + aiMelody
  ↓
Schedule note events:
  For each note:
    setTimeout(() => {
      playChord(notes)
      setActiveNotes(notes) → Visual art
    }, timing)
  ↓
Schedule drum loops:
  For each loop iteration:
    For each drum hit:
      setTimeout(() => {
        drumSynth.play()
        setActiveDrums() → Visual art
      }, timing)
  ↓
All notes/drums play
  ↓
setIsPlaying(false) when done
```

---

## Performance Optimizations

1. **useCallback** - Memoize event handlers
2. **useMemo** - Cache computed values (savedMelodies, etc.)
3. **useRef** - Avoid re-renders for audio/animation refs
4. **Particle culling** - Remove particles when life <= 0
5. **Throttled debug updates** - Only update UI every 60 frames
6. **Canvas double buffering** - Automatic via requestAnimationFrame

---

## Debugging

The visual canvas now includes debug output:
- **P**: Particle count
- **D**: Drum effects count
- **N**: Active notes count

Console logs show:
- Canvas initialization and sizing
- Particle creation events
- Drum effect creation
- Frame count every 60 frames

---

## Common Issues & Solutions

**Issue**: Notes not playing
- Check: Audio context created? (needs user interaction)
- Check: Volume sliders not at 0
- Check: Browser autoplay policy

**Issue**: AI generation fails
- Fallback algorithm automatically used
- Check: Minimum 4 notes required
- Check: Magenta.js loaded successfully

**Issue**: Visual art not showing
- Check: Canvas properly sized (debug output)
- Check: activeNotes/activeDrums passed correctly
- Check: Console for initialization messages
- Check: Animation loop started

**Issue**: Storage not persisting
- Check: useStorage keys are consistent
- Check: useFiles namespace correct
- Check: Data format JSON-serializable

---

## Future Enhancements

Potential additions:
1. More Magenta models (PerformanceRNN, MusicVAE)
2. MIDI file import/export
3. Custom instrument samples
4. Effects (reverb, delay, distortion)
5. More complex drum patterns
6. Collaboration features
7. Visual style customization
8. BPM tempo control (currently fixed)

---

## Technical Constraints

1. **No external libraries** beyond React, Magenta.js
2. **iframe isolation** - Each widget runs independently
3. **JSON serialization** - All stored data must be JSON-safe
4. **Browser APIs only** - Web Audio, Canvas, Storage
5. **CDN Tailwind** - Not production-recommended but works

---

This widget demonstrates:
- Complex state management
- Real-time audio synthesis
- Machine learning integration
- Canvas-based visualization
- File-based storage patterns
- Accessibility best practices
