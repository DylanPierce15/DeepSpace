import React, { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Music2, Drum, Piano, Sliders, Share2, GitFork, Sparkles, Keyboard, ChevronRight, Play, Check, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '../components/ui'
import { useStudio } from '../hooks/useStudio'
import { GENRE_KITS, type GenreKit } from '../constants/genreKits'
import { cn } from '../components/ui'

// ── Feature grid ──────────────────────────────────────────────────────────────
const features = [
  { icon: <Piano className="w-4 h-4" />,    label: 'Piano Roll',       desc: 'Click, drag, and type notes with quantize + scale highlighting' },
  { icon: <Drum className="w-4 h-4" />,     label: '16-Step Drums',    desc: 'Bar-aligned drum grid synced to synth timeline' },
  { icon: <Sparkles className="w-4 h-4" />, label: 'AI Composer',      desc: 'Generate chord progressions, melodies, and drum patterns' },
  { icon: <Keyboard className="w-4 h-4" />, label: 'QWERTY Play',      desc: 'Play notes live from your keyboard, record into clips' },
  { icon: <Sliders className="w-4 h-4" />,  label: 'Synth + Mixer',    desc: 'Per-track oscillator, ADSR filter, volume, pan, M/S' },
  { icon: <Share2 className="w-4 h-4" />,   label: 'Publish & Remix',  desc: 'Export MP3, publish to the community, fork any track' },
]

// ── Interactive Build steps ───────────────────────────────────────────────────
const BUILD_STEPS = [
  {
    step: 1,
    title: 'Pick Your Sound',
    desc: 'Choose a genre kit below or click "Start Building" to load the Lo-fi starter. Each kit gives you a real drum pattern, a chord progression, and a synth preset — so you start with something that already sounds good.',
    action: 'Start Building →',
    tip: 'Lo-fi at 85 BPM feels chill. House at 128 BPM is energetic. Pick the BPM that matches how you want the track to feel.',
    shortcut: null,
    color: '#8b5cf6',
  },
  {
    step: 2,
    title: 'Nail the Drum Foundation',
    desc: 'Click the teal Drums clip to open the step sequencer. The kick and snare define the groove. Most genres follow this formula: Kick on steps 1 & 9 (beats 1 & 3), Snare on steps 5 & 13 (beats 2 & 4). Hi-hats fill in the gaps.',
    action: null,
    tip: 'Solid rule: if it sounds empty, add a hi-hat. If it sounds cluttered, mute the clap row. Start simple — 4 kicks, 2 snares, 8 hi-hats.',
    shortcut: 'Click any step to toggle it. Right-drag an active step to set its velocity (brightness = loudness).',
    color: '#06b6d4',
  },
  {
    step: 3,
    title: 'Build a Melody That Works',
    desc: 'Click the colored synth clip to open the Piano Roll. Click an empty cell to place a note. The safest starting notes are C4, E4, G4, and B4 (the Cmaj7 chord) — they always sound good together.',
    action: null,
    tip: 'Music theory shortcut: stick to white-key notes (C D E F G A B) and your melody will stay in key. Start notes on beat positions 1, 5, 9, 13 for a clean rhythm.',
    shortcut: 'Right-click a note to delete it. Select notes (Shift+click) then drag to move them together.',
    color: '#8b5cf6',
  },
  {
    step: 4,
    title: 'Use AI to Level Up',
    desc: 'Open any synth clip in the Piano Roll. Click the "AI" section in the toolbar. Choose Chords to get a full chord progression, or Melody to generate a melodic phrase over your existing notes. Accept what sounds good, reject what doesn\'t.',
    action: null,
    tip: 'Set the Scale dropdown (e.g. "Minor") before generating for more genre-appropriate results. Run it 2–3 times and pick the best version.',
    shortcut: 'The AI reads your current notes and BPM — the more you build first, the better its suggestions.',
    color: '#10b981',
  },
  {
    step: 5,
    title: 'Mix, Export & Share',
    desc: 'Each track header has a volume fader. Aim for: Drums ~80%, Bass/Chords ~55%, Lead melody ~65%. Hit Rec in the transport, let the loop play 2–3 times, then Stop. Click MP3 to download or Publish to share with the community.',
    action: null,
    tip: 'If it sounds muddy: lower the bass. If the melody gets lost: boost the lead track. If drums feel weak: turn them up and mute the clap on the off-beats.',
    shortcut: 'M = Mute a track. S = Solo to hear it alone. Ctrl+Z = Undo any mistake.',
    color: '#ec4899',
  },
]

// ── Genre kit card ────────────────────────────────────────────────────────────
function KitCard({ kit, onLoad }: { kit: GenreKit; onLoad: () => void }) {
  return (
    <motion.button
      onClick={onLoad}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 340, damping: 22 }}
      className="group text-left bg-card border border-border rounded-xl p-4 hover:border-primary/50 hover:bg-card/80 transition-colors hover:shadow-card"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <motion.span
          className="text-2xl"
          whileHover={{ rotate: [0, -8, 8, 0], transition: { duration: 0.4 } }}
        >
          {kit.emoji}
        </motion.span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: kit.color }}>
          {kit.bpm} BPM
        </span>
      </div>
      <p className="text-sm font-semibold text-foreground">{kit.name}</p>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{kit.description}</p>
      <p className="text-xs text-primary mt-2 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
        Load kit →
      </p>
    </motion.button>
  )
}

const buildStepVariants = {
  enter: (dir: number) => ({ x: dir * 36, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: -dir * 36, opacity: 0 }),
}

// ── Interactive Build tutorial card ──────────────────────────────────────────
function InteractiveBuildCard({ onStart }: { onStart: () => void }) {
  const [activeStep, setActiveStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const prevStepRef = useRef(0)

  const goTo = (i: number) => {
    setDirection(i > prevStepRef.current ? 1 : -1)
    prevStepRef.current = i
    setActiveStep(i)
  }

  const step = BUILD_STEPS[activeStep]
  const isLast = activeStep === BUILD_STEPS.length - 1

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Make Your First Track</p>
            <p className="text-xs text-muted-foreground">5 steps to a finished, quality loop</p>
          </div>
          {/* Step dots */}
          <div className="ml-auto flex items-center gap-1">
            {BUILD_STEPS.map((s, i) => (
              <motion.button
                key={i}
                onClick={() => goTo(i)}
                title={`Step ${i + 1}`}
                animate={{
                  width:           i === activeStep ? 16 : 6,
                  height:          6,
                  backgroundColor: i <= activeStep ? s.color : 'var(--color-border)',
                  opacity:         i < activeStep ? 0.6 : i === activeStep ? 1 : 0.25,
                }}
                transition={{ duration: 0.2 }}
                style={{ borderRadius: 9999, flexShrink: 0 }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Step content — animated */}
      <div className="px-4 py-4 overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={activeStep}
            custom={direction}
            variants={buildStepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex gap-3"
          >
            {/* Step number badge */}
            <motion.div
              key={`badge-${activeStep}`}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.05, type: 'spring', stiffness: 360, damping: 20 }}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5 shadow-sm"
              style={{ background: step.color }}
            >
              {isLast ? <Check className="w-3.5 h-3.5" /> : step.step}
            </motion.div>

            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-sm font-semibold text-foreground">{step.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>

              {/* Music theory tip */}
              {step.tip && (
                <div className="flex items-start gap-1.5 p-2.5 rounded-lg border" style={{ background: `${step.color}0d`, borderColor: `${step.color}25` }}>
                  <Zap className="w-3 h-3 shrink-0 mt-0.5" style={{ color: step.color }} />
                  <p className="text-xs leading-relaxed" style={{ color: step.color }}>{step.tip}</p>
                </div>
              )}

              {/* How-to shortcut note */}
              {step.shortcut && (
                <div className="flex items-start gap-1.5 p-2 rounded-lg bg-muted/30 border border-border/40">
                  <Keyboard className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.shortcut}</p>
                </div>
              )}

              {/* Step 1 action button */}
              {activeStep === 0 && (
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onStart}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ background: step.color }}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Start Building
                </motion.button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Step navigation */}
      <div className="px-4 pb-4 flex items-center justify-between border-t border-border/30 pt-3">
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => goTo(Math.max(0, activeStep - 1))}
          disabled={activeStep === 0}
          className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
        >
          ← Back
        </motion.button>
        <span className="text-xs text-muted-foreground font-medium">
          Step {activeStep + 1} of {BUILD_STEPS.length}
        </span>
        {!isLast ? (
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => goTo(activeStep + 1)}
            className="flex items-center gap-1 text-xs font-semibold hover:opacity-80 transition-opacity"
            style={{ color: BUILD_STEPS[activeStep + 1]?.color ?? 'var(--color-primary)' }}
          >
            Next <ChevronRight className="w-3 h-3" />
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={onStart}
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            Open Studio <ChevronRight className="w-3 h-3" />
          </motion.button>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate     = useNavigate()
  const { dispatch } = useStudio()

  const loadKit = (kit: GenreKit) => {
    dispatch({
      type:  'LOAD_PROJECT',
      state: {
        projectName:    kit.projectName,
        bpm:            kit.bpm,
        tracks:         kit.tracks,
        savedProjectId: null,
        isDirty:        true,
      },
    })
    navigate('/studio')
  }

  // Starter track — Lo-fi kit as a simple, clean starting point for the tutorial
  const handleStartBuild = () => {
    const starterKit = GENRE_KITS.find(k => k.id === 'lofi')!
    loadKit(starterKit)
  }

  return (
    <div className="h-full bg-background overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-10">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="space-y-3 text-center"
        >
          <motion.div
            initial={{ scale: 0.75, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 280, damping: 20 }}
            className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto"
          >
            <Music2 className="w-8 h-8 text-primary" />
          </motion.div>
          <h1 className="text-2xl font-bold text-foreground">DeepSpace Music Studio</h1>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            A browser-based DAW with AI composition, live keyboard play, and a community to share your music.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <Button onClick={() => { dispatch({ type: 'NEW_PROJECT' }); navigate('/studio') }}>Open Studio</Button>
            <Link to="/community">
              <Button variant="outline">Community</Button>
            </Link>
          </div>
        </motion.div>

        {/* Interactive Build Tutorial */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-foreground">New here? Start with a guided build</h2>
          </div>
          <InteractiveBuildCard onStart={handleStartBuild} />
        </motion.div>

        {/* Genre starter kits */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.4, ease: 'easeOut' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-foreground">Start with a genre kit</h2>
            <span className="text-xs text-muted-foreground">Loads instruments, patterns, and a progression</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {GENRE_KITS.map((kit, i) => (
              <motion.div
                key={kit.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 + i * 0.06, duration: 0.3, ease: 'easeOut' }}
              >
                <KitCard kit={kit} onLoad={() => loadKit(kit)} />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Feature grid */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4, ease: 'easeOut' }}
        >
          <h2 className="text-sm font-bold text-foreground mb-3">What's inside</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {features.map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.38 + i * 0.05, duration: 0.3, ease: 'easeOut' }}
                className="bg-card rounded-lg border border-border p-3 flex gap-2.5"
              >
                <div className="text-primary mt-0.5 shrink-0">{f.icon}</div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{f.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  )
}
