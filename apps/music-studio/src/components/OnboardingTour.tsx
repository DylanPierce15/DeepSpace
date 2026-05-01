/**
 * OnboardingTour — spotlight-style first-time walkthrough.
 *
 * Renders via a portal over the entire app. Each step either:
 *   - Centers a modal (targetId = null) — for welcome / done screens
 *   - Spotlights a specific DOM element (targetId = string) — for feature callouts
 *
 * The spotlight is created with a large inset box-shadow that dims everything
 * outside the highlighted element. The tooltip card is positioned
 * above or below the target depending on available screen space.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronRight, ChevronLeft, Music2, Zap, MousePointerClick, GripHorizontal, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from './ui'

// ── Step definitions ──────────────────────────────────────────────────────────

interface TourStep {
  targetId:    string | null
  title:       string
  body:        string
  emoji:       string
  hint?:       string   // small tip shown below body
  tryIt?:      string   // specific action to take right now
}

const STEPS: TourStep[] = [
  {
    targetId: null,
    emoji: '🎛️',
    title: 'Welcome to DeepSpace Music Studio',
    body: 'A full browser-based DAW — multi-track sequencing, AI composition, live keyboard play, real-time visualizer, and a community to share your music. No downloads, no installs.',
    hint: 'You can skip or replay this tour any time with the ? button in the bottom-right corner.',
    tryIt: 'Click Next and we\'ll walk through every section — we\'ll spotlight exactly what to look at each step.',
  },
  {
    targetId: null,
    emoji: '🎸',
    title: 'Home page — genre starter kits',
    body: 'The Home page has genre starter kits: Lo-fi, House, Trap, R&B, Jazz, and more. Each one loads a matching BPM, drum pattern, chord progression, and synth preset — so you start with something that already sounds good.',
    hint: 'You can always clear a kit and start fresh with New Project in the transport bar.',
    tryIt: 'Click the house icon in the sidebar → pick any genre kit card → it loads straight into the Studio, ready to play.',
  },
  {
    targetId: 'tour-transport',
    emoji: '▶️',
    title: 'Transport bar — playback & tempo',
    body: 'The top bar controls your entire session. Play/Stop runs the loop. The BPM field sets tempo (range 40–200) — click +/− or type directly. TAP lets you tap a tempo by clicking it 4+ times in rhythm.',
    hint: 'Undo/Redo (Ctrl+Z / Ctrl+Shift+Z) are also here — every track edit, note placement, and volume change is undoable.',
    tryIt: 'Click ▶ Play to hear the loop. Then click TAP four times in beat with the music to lock in a new BPM. Press Stop or Spacebar when done.',
  },
  {
    targetId: 'tour-add-tracks',
    emoji: '➕',
    title: 'Adding tracks — synth vs. drums',
    body: 'Click "+ Add Synth" to add a melodic track powered by a synthesizer or soundfont instrument (piano, guitar, strings, brass, and more). Click "+ Add Drums" to add a drum machine track with a 16-step pattern sequencer.',
    hint: 'You can have as many tracks as you like. Each track is fully independent with its own instrument, volume, and pattern.',
    tryIt: 'Click "+ Add Synth" to see a new track appear. Then click "+ Add Drums" to add a drum track below it.',
  },
  {
    targetId: 'tour-track-ruler',
    emoji: '🎚️',
    title: 'Timeline & track controls',
    body: 'The numbered ruler marks each bar — all tracks play in sync on this grid. In every track header you\'ll find a volume fader, M (Mute), and S (Solo) buttons. Double-click the track name to rename it.',
    hint: 'Muting a track silences it without deleting it. Solo isolates just that track so you can hear it alone.',
    tryIt: 'Drag the volume fader on any track left and right while playing to hear the level change. Then click M to mute it and S to solo it.',
  },
  {
    targetId: 'tour-clip-lane',
    emoji: '🎹',
    title: 'Synth clips — the building blocks',
    body: 'Synth tracks show colored clip blocks on the timeline. Click the + button at the end of the lane to add a new clip. Click a clip to open it in the Piano Roll editor. Drag the right edge of a clip to resize it. Right-click for Rename / Duplicate / Delete.',
    hint: 'Each clip is an independent loop — you can have different chords in bar 1 and different notes in bar 5.',
    tryIt: 'Click the colored clip in a synth track to open the Piano Roll. Then click any empty cell in the grid to place a note — you\'ll hear it play.',
  },
  {
    targetId: null,
    emoji: '🎼',
    title: 'Piano Roll — editing notes',
    body: 'Inside the Piano Roll: click empty cells to add notes, drag notes to move them, drag the right edge to resize, right-click to delete. The Quantize dropdown snaps notes to a grid (1/4, 1/8, 1/16). The Scale picker highlights in-key notes — Major, Minor, Dorian, Pentatonic, Blues.',
    hint: 'Hold Shift and click to multi-select notes — then drag or delete them all at once.',
    tryIt: 'Open any clip → change Quantize to 1/16 for finer note placement. Pick a Scale (try Pentatonic) — the highlighted rows are guaranteed to sound good together.',
  },
  {
    targetId: null,
    emoji: '✨',
    title: 'AI Composer — generate melodies & chords',
    body: 'In the Piano Roll, click the AI wand button to open the AI Composer panel. Choose whether to generate a chord progression, melody, or drum pattern. The AI respects the active scale so the result fits your key automatically.',
    hint: 'You can generate multiple times and choose the one you like — each generation is independent.',
    tryIt: 'Open the Piano Roll → click the AI button → select "Chord Progression" → click Generate. Accept or regenerate until you like it.',
  },
  {
    targetId: 'tour-bottom-panel',
    emoji: '🥁',
    title: 'Drum Sequencer — 16-step patterns',
    body: 'Click any drum track to open its step sequencer in the bottom panel. Each row is a drum sound (kick, snare, hi-hat, etc.). Click a step to toggle it on/off. Right-drag a lit step up/down to adjust its velocity — harder hits are brighter.',
    hint: 'Steps are grouped in 4×4 blocks matching a standard 4/4 beat — the first beat of each bar is the leftmost step in each group.',
    tryIt: 'Click a Drums track → look at the bottom panel → toggle steps on and off. Try dragging a step upward to boost its velocity.',
  },
  {
    targetId: 'tour-bottom-panel',
    emoji: '🎛️',
    title: 'Instrument Panel — shape your sound',
    body: 'Click a Synth track to see its instrument editor here. Choose the oscillator waveform (Sine is smooth, Sawtooth is buzzy, Square is punchy). ADSR controls the note envelope: Attack (fade in), Decay, Sustain level, Release (fade out). Filter Freq darkens the tone as you lower it.',
    hint: 'Reverb and Delay wet knobs add space and echo. Keep them subtle (under 0.3) for a cleaner mix.',
    tryIt: 'Click a Synth track → in the panel below, change Oscillator from Triangle to Sawtooth → click Play to hear the difference. Then drag Filter Freq down to 400 Hz.',
  },
  {
    targetId: 'tour-bottom-panel',
    emoji: '🎚️',
    title: 'Mixer — balance your tracks',
    body: 'Click the Mixer tab in the bottom panel to see vertical faders for every track. Drag a fader up/down to set volume. The Pan knob shifts a track left or right in the stereo field. Use Mute and Solo here too for the full mix view.',
    hint: 'A good starting mix: kick and bass slightly louder, hi-hats and pads lower. Leave headroom — don\'t push everything to 100%.',
    tryIt: 'Click the Mixer tab → drag the drum track fader up a bit → drag a synth track fader down to balance them. Try panning two synth tracks slightly left and right.',
  },
  {
    targetId: 'tour-transport',
    emoji: '⌨️',
    title: 'QWERTY keyboard — play live',
    body: 'Click the "Keys" button in the transport bar to turn your keyboard into a playable instrument. A S D F G H J map to white keys C4–B4. W E T Y U are the sharps. Z shifts an octave down, X shifts an octave up.',
    hint: 'With a synth track selected and Rec active, your live playing gets captured directly into the clip as notes.',
    tryIt: 'Click "Keys" in the transport bar → press A, S, D to play notes. Try Z then A to hear the lower octave. Press X then J for the high end.',
  },
  {
    targetId: 'tour-export',
    emoji: '🎙️',
    title: 'Recording & exporting to MP3',
    body: 'Click Rec to start capturing your loop\'s audio output. Let it play through 2–3 loops, then click Stop. An MP3 download button appears next to the export icon — click it to save your mix as a file.',
    hint: 'The mic button lets you record live vocals or instruments through your microphone — they\'re added as sample tracks.',
    tryIt: 'Click Rec → wait for 2 loops → click Stop → click the download button that appears to save your MP3.',
  },
  {
    targetId: null,
    emoji: '📤',
    title: 'Publishing to the Community',
    body: 'Click Publish in the transport bar to share your track publicly. You\'ll add a name, pick a genre, add tags, and the system auto-generates cover art. Once published, your track appears in the Community feed for anyone to discover.',
    hint: 'Published tracks stay editable as drafts — publishing creates a public snapshot while you keep working on the original.',
    tryIt: 'Click Publish → fill in the track name and genre → hit Publish. Then navigate to the Community page to see it live in the feed.',
  },
  {
    targetId: null,
    emoji: '❤️',
    title: 'Social features — likes, comments & follows',
    body: 'In the Community feed, scroll through tracks in a TikTok-style layout. Like a track with the heart button. Open comments with the chat bubble — leave feedback or read what others said. Click a producer\'s name to visit their profile and follow them.',
    hint: 'The Following tab in the Community page shows only tracks from producers you follow — great for curating your feed.',
    tryIt: 'Go to Community → scroll to a track you like → click the heart to like it → click the chat bubble to leave a comment.',
  },
  {
    targetId: null,
    emoji: '🔀',
    title: 'Remixing — fork any track',
    body: 'On any track in the Community feed, click the Remix button to fork it into your library as a new draft. You get all the original tracks, patterns, and settings — fully editable. Your remix is linked back to the original so listeners can see the lineage.',
    hint: 'Remixing is the fastest way to learn — load someone\'s track, see how they built it, then make it your own.',
    tryIt: 'Go to Community → find any track → click Remix → it appears in your Library as a new draft. Open it in the Studio and change something.',
  },
  {
    targetId: null,
    emoji: '🎉',
    title: 'You\'re ready to make music!',
    body: 'You now know the full studio: transport controls, tracks, Piano Roll, AI Composer, Drum Sequencer, Instrument Panel, Mixer, recording, publishing, and the community. Best first move: load a genre kit, hit Play, edit the beat, then remix something you love.',
    hint: 'Hit the ? button any time to replay this tour.',
    tryIt: 'Go to Home → load the Lo-fi or House kit → click Play → open a drum track → tweak the pattern. You\'re making music.',
  },
]

// ── Hook for spotlight rect tracking ─────────────────────────────────────────

function useTargetRect(targetId: string | null, stepIdx: number, layoutKey?: string | number) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  // Scroll into view only on step change, not on every layout update
  useEffect(() => {
    if (!targetId) return
    const el = document.getElementById(targetId)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [targetId, stepIdx])

  // Re-measure on step change, resize, or layout shifts (e.g. bottom panel growing)
  useEffect(() => {
    if (!targetId) { setRect(null); return }

    const measure = () => {
      const el = document.getElementById(targetId)
      if (!el) { setRect(null); return }
      setRect(el.getBoundingClientRect())
    }

    const delayed = setTimeout(measure, 150)
    window.addEventListener('resize', measure)
    return () => {
      clearTimeout(delayed)
      window.removeEventListener('resize', measure)
    }
  }, [targetId, stepIdx, layoutKey])

  return rect
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  stepIdx:        number
  onNext:         () => void
  onBack:         () => void
  onComplete:     () => void
  onJumpToStep?:  (idx: number) => void
  onStepEnter?:   (stepIdx: number) => void
  layoutKey?:     string | number
}

const cardContentVariants = {
  enter: (dir: number) => ({ x: dir * 48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: -dir * 48, opacity: 0 }),
}

export function OnboardingTour({ stepIdx, onNext, onBack, onComplete, onJumpToStep, onStepEnter, layoutKey }: Props) {
  const step    = STEPS[stepIdx]
  const total   = STEPS.length
  const isFirst = stepIdx === 0
  const isLast  = stepIdx === total - 1
  const targetRect = useTargetRect(step.targetId, stepIdx, layoutKey)

  // Track slide direction for content animation
  const prevStepRef = useRef(stepIdx)
  const [direction, setDirection] = useState(1)
  useEffect(() => {
    setDirection(stepIdx > prevStepRef.current ? 1 : -1)
    prevStepRef.current = stepIdx
  }, [stepIdx])

  // "Try it" done state — resets on step change
  const [tryItDone, setTryItDone] = useState(false)
  useEffect(() => { setTryItDone(false) }, [stepIdx])
  const handleTryItDone = useCallback(() => {
    setTryItDone(true)
    setTimeout(() => { onNext() }, 900)
  }, [onNext])

  // Fire onStepEnter whenever the step changes
  useEffect(() => {
    onStepEnter?.(stepIdx)
  }, [stepIdx, onStepEnter])

  // ── Drag state ────────────────────────────────────────────────────────────
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const cardRef     = useRef<HTMLDivElement>(null)
  const isDragging  = useRef(false)
  const dragStart   = useRef({ mouseX: 0, mouseY: 0, cardX: 0, cardY: 0 })

  // Reset drag position when step changes so tooltip snaps back to target
  useEffect(() => { setDragPos(null) }, [stepIdx])

  const handleDragMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const card = cardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    isDragging.current = true
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, cardX: rect.left, cardY: rect.top }

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return
      const dx = ev.clientX - dragStart.current.mouseX
      const dy = ev.clientY - dragStart.current.mouseY
      setDragPos({ x: dragStart.current.cardX + dx, y: dragStart.current.cardY + dy })
    }
    const onUp = () => {
      isDragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  // Tooltip positioning — uses dragPos when manually dragged, otherwise auto-positions
  const tooltipStyle = useCallback((): React.CSSProperties => {
    const W = step.targetId ? 380 : 440
    if (dragPos) {
      return { position: 'fixed', left: dragPos.x, top: dragPos.y, width: W, zIndex: 10001 }
    }
    if (!step.targetId || !targetRect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: W,
        zIndex: 10001,
      }
    }

    const PAD    = 12
    const H_EST  = 300   // conservative estimate of tooltip height
    const vw     = window.innerWidth
    const vh     = window.innerHeight

    // Horizontal: center on element, but clamp within viewport
    let left = targetRect.left + targetRect.width / 2 - W / 2
    left = Math.max(PAD, Math.min(vw - W - PAD, left))

    const spaceBelow = vh - targetRect.bottom - PAD
    const spaceAbove = targetRect.top - PAD

    let top: number

    if (spaceBelow >= H_EST) {
      top = targetRect.bottom + PAD
    } else if (spaceAbove >= H_EST) {
      top = targetRect.top - H_EST - PAD
    } else {
      if (spaceBelow >= spaceAbove) {
        top = Math.min(vh - H_EST - PAD, targetRect.bottom + PAD)
      } else {
        top = Math.max(PAD, targetRect.top - H_EST - PAD)
      }
      top = Math.max(PAD, Math.min(vh - H_EST - PAD, top))
    }

    return { position: 'fixed', left, top, width: W, zIndex: 10001 }
  }, [step.targetId, targetRect, dragPos])

  // Arrow direction — points toward the target from the tooltip card
  const arrowDir = useCallback((): 'up' | 'down' | null => {
    if (!step.targetId || !targetRect) return null
    const H_EST      = 260
    const PAD        = 12
    const spaceBelow = window.innerHeight - targetRect.bottom - PAD
    const spaceAbove = targetRect.top - PAD
    if (spaceBelow >= H_EST) return 'up'
    if (spaceAbove >= H_EST) return 'down'
    return null
  }, [step.targetId, targetRect])

  const PADDING = 6

  return createPortal(
    <>
      {/* ── Dark overlay ─────────────────────────────────────────────────── */}
      {targetRect && step.targetId ? (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
            className="fixed left-0 right-0 top-0 pointer-events-none"
            style={{ height: Math.max(0, targetRect.top - PADDING), zIndex: 10000, backgroundColor: 'rgba(0,0,0,0.72)' }}
          />
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
            className="fixed left-0 right-0 pointer-events-none"
            style={{ top: targetRect.bottom + PADDING, bottom: 0, zIndex: 10000, backgroundColor: 'rgba(0,0,0,0.72)' }}
          />
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
            className="fixed left-0 pointer-events-none"
            style={{ top: targetRect.top - PADDING, width: Math.max(0, targetRect.left - PADDING), height: targetRect.height + PADDING * 2, zIndex: 10000, backgroundColor: 'rgba(0,0,0,0.72)' }}
          />
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
            className="fixed right-0 pointer-events-none"
            style={{ top: targetRect.top - PADDING, left: targetRect.right + PADDING, height: targetRect.height + PADDING * 2, zIndex: 10000, backgroundColor: 'rgba(0,0,0,0.72)' }}
          />
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}
          className="fixed inset-0 pointer-events-none"
          style={{ zIndex: 10000, backgroundColor: 'rgba(0,0,0,0.72)' }}
        />
      )}

      {/* ── Spotlight glow ring ──────────────────────────────────────────── */}
      <AnimatePresence>
        {targetRect && step.targetId && (
          <motion.div
            key={`${step.targetId}-${stepIdx}`}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed pointer-events-none rounded-lg"
            style={{
              zIndex:    10000,
              top:       targetRect.top    - PADDING,
              left:      targetRect.left   - PADDING,
              width:     targetRect.width  + PADDING * 2,
              height:    targetRect.height + PADDING * 2,
              boxShadow: '0 0 0 2px var(--color-primary), 0 0 28px rgba(139,92,246,0.5)',
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Tooltip card ────────────────────────────────────────────────── */}
      <div
        ref={cardRef}
        className="relative bg-card border border-border/80 rounded-2xl shadow-[0_24px_48px_rgba(0,0,0,0.5)] overflow-hidden"
        style={tooltipStyle()}
      >
        {/* Arrows (hidden when dragged) */}
        {!dragPos && arrowDir() === 'up' && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-card border-l border-t border-border/80 rotate-45 -z-10" />
        )}
        {!dragPos && arrowDir() === 'down' && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-card border-r border-b border-border/80 rotate-45 -z-10" />
        )}

        {/* Drag handle + animated progress bar */}
        <div
          className="h-5 bg-muted/20 flex items-center justify-center cursor-grab active:cursor-grabbing select-none border-b border-border/20 relative"
          onMouseDown={handleDragMouseDown}
          title="Drag to reposition"
        >
          <GripHorizontal className="w-4 h-4 text-muted-foreground/40" />
          <div className="absolute left-0 bottom-0 right-0 h-0.5 bg-muted/40">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ width: `${((stepIdx + 1) / total) * 100}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Animated step content */}
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={stepIdx}
            custom={direction}
            variants={cardContentVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="p-5"
          >
            {/* Step dots (clickable) + close */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                {Array.from({ length: total }, (_, i) => (
                  <motion.button
                    key={i}
                    title={`Jump to step ${i + 1}`}
                    onClick={() => onJumpToStep?.(i)}
                    animate={{
                      width:           i === stepIdx ? 16 : 6,
                      height:          6,
                      backgroundColor: i <= stepIdx ? 'var(--color-primary)' : 'var(--color-muted)',
                      opacity:         i < stepIdx ? 0.5 : i === stepIdx ? 1 : 0.3,
                    }}
                    transition={{ duration: 0.2 }}
                    style={{ borderRadius: 9999, cursor: onJumpToStep ? 'pointer' : 'default' }}
                  />
                ))}
              </div>
              <button
                onClick={onComplete}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                title="Skip tour"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex gap-3 mb-4">
              <motion.span
                key={`emoji-${stepIdx}`}
                initial={{ scale: 0.5, rotate: -15, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ delay: 0.08, type: 'spring', stiffness: 320, damping: 18 }}
                className="text-2xl shrink-0 leading-none mt-0.5 block"
              >
                {step.emoji}
              </motion.span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-foreground mb-1.5">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.body}</p>
                {step.hint && (
                  <p className="text-xs text-primary/70 mt-2 flex items-center gap-1">
                    <Zap className="w-3 h-3 shrink-0" />
                    {step.hint}
                  </p>
                )}
                {step.tryIt && (
                  <AnimatePresence mode="wait">
                    {tryItDone ? (
                      <motion.div
                        key="done"
                        initial={{ scale: 0.85, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                        className="mt-2.5 p-2.5 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2"
                      >
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.05, type: 'spring', stiffness: 450 }}
                          className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0"
                        >
                          <Check className="w-3 h-3 text-white" />
                        </motion.div>
                        <p className="text-xs font-semibold text-green-400">Nice work — moving on…</p>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="tryit"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: 0.1 }}
                        className="mt-2.5 p-2.5 rounded-lg bg-primary/10 border border-primary/20"
                      >
                        <p className="text-xs font-semibold text-primary mb-0.5 flex items-center gap-1">
                          <MousePointerClick className="w-3 h-3 shrink-0" />
                          Try it now
                        </p>
                        <p className="text-xs text-foreground/80 leading-relaxed mb-2">{step.tryIt}</p>
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={handleTryItDone}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-primary/20 text-primary hover:bg-primary/30 transition-colors border border-primary/30"
                        >
                          <Check className="w-3 h-3" /> Mark done
                        </motion.button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onBack}
                disabled={isFirst}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  isFirst
                    ? 'text-muted-foreground/30 cursor-not-allowed'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                )}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Back
              </motion.button>

              <span className="text-xs text-muted-foreground tabular-nums">
                {stepIdx + 1} / {total}
              </span>

              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={isLast ? onComplete : onNext}
                className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary/80 transition-colors"
              >
                {isLast ? (
                  <><Music2 className="w-3.5 h-3.5" /> Let's go!</>
                ) : (
                  <>Next <ChevronRight className="w-3.5 h-3.5" /></>
                )}
              </motion.button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </>,
    document.body,
  )
}

// Export step count for consumers
export const TOUR_STEP_COUNT = STEPS.length
