/**
 * Studio Page — main DAW layout
 *
 * Track headers have inline volume fader + M/S controls per lane.
 * All track types share the same bar-aligned timeline coordinate space.
 * Bottom panel is context-sensitive: Synth → InstrumentPanel, Drums → DrumSequencer.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, Trash2, Sliders, Mic, HelpCircle, GripVertical, Copy, Loader2, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStudio } from '../hooks/useStudio'
import { useToneEngine } from '../hooks/useToneEngine'
import { useOnboarding } from '../hooks/useOnboarding'
import { TransportBar }    from '../components/TransportBar'
import { DrumSequencer }   from '../components/DrumSequencer'
import { DrumLane }        from '../components/DrumLane'
import { PianoRoll }       from '../components/PianoRoll'
import { Mixer }           from '../components/Mixer'
import { ClipLane }        from '../components/ClipLane'
import { InstrumentPanel } from '../components/InstrumentPanel'
import { DrumEditor }      from '../components/DrumEditor'
import { OnboardingTour, TOUR_STEP_COUNT } from '../components/OnboardingTour'
import { Track, Clip, Note, BARS, DRUM_ROWS, DEFAULT_STEP_VELOCITY, SOUNDFONT_INSTRUMENTS } from '../constants'
import { cn } from '../components/ui'

function AudioEngine() { useToneEngine(); return null }

type Panel = 'edit' | 'mixer'

const TRACK_COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899']
const BASE_BAR_W   = 48
const HEADER_W     = 192   // px — wide enough for name + fader + M/S

function makeDefaultBeat(): boolean[][] {
  const p = Array.from({ length: DRUM_ROWS.length }, () => Array(16).fill(false) as boolean[])
  p[0][0] = true; p[0][8] = true                           // kick: beats 1 & 3
  p[1][4] = true; p[1][12] = true                          // snare: beats 2 & 4
  ;[0,2,4,6,8,10,12,14].forEach(s => { p[3][s] = true })   // hi-hat: every 8th
  p[4][6] = true                                            // open hat: lift before snare
  return p
}

function newSynthTrack(n: number): Track {
  const color = TRACK_COLORS[n % TRACK_COLORS.length]
  const id    = `track-${Date.now()}`
  const clip: Clip = {
    id: `clip-${id}-1`,
    name: 'Melody',
    startBar: 0,
    lengthBars: 2,
    notes: [] as Note[],
  }
  return {
    id, name: `Synth ${n}`, type: 'synth',
    clips: [clip],
    notes: [], volume: 0.8, pan: 0, muted: false, soloed: false, color,
    instrument: { oscillator: 'sawtooth', filterFreq: 2000, filterRes: 1, attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.5 },
  }
}

function newDrumTrack(n: number): Track {
  const id     = `track-${Date.now()}`
  const clipId = `drumclip-${id}-1`
  return {
    id,
    name:   `Drums ${n}`,
    type:   'drums',
    drumClips: [{
      id:         clipId,
      name:       'Beat 1',
      startBar:   0,
      lengthBars: BARS,
      pattern:    Array.from({ length: DRUM_ROWS.length }, () => Array(16).fill(false) as boolean[]),
    }],
    activeDrumClipId: clipId,
    drumVolumes:    Array.from({ length: DRUM_ROWS.length }, () => 1),
    drumVelocities: Array.from({ length: DRUM_ROWS.length }, () => Array(16).fill(DEFAULT_STEP_VELOCITY)),
    volume:         0.9,
    pan:            0,
    muted:          false,
    soloed:         false,
    color:          '#06b6d4',
    instrument:     { oscillator: 'square', filterFreq: 3000, filterRes: 1, attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
  }
}

// ── Track header — name (double-click to rename), M/S, volume, delete ────────

interface TrackHeaderProps {
  track:       Track
  isActive:    boolean
  hasSolo:     boolean
  onSelect:    () => void
  onDelete:    () => void
  onRename:    (name: string) => void
  onVolumeChange: (v: number) => void
  onMute:      () => void
  onSolo:      () => void
  onDuplicate: () => void
  onDragHandleMouseDown: () => void
}

function TrackHeader({
  track, isActive, hasSolo,
  onSelect, onDelete, onRename, onVolumeChange,
  onMute, onSolo, onDuplicate, onDragHandleMouseDown,
}: TrackHeaderProps) {
  const [editing,  setEditing]  = useState(false)
  const [nameVal,  setNameVal]  = useState(track.name)
  const [sfStatus, setSfStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(() =>
    track.type === 'synth' && track.instrument.soundfont ? 'loading' : 'idle'
  )
  const inputRef = useRef<HTMLInputElement>(null)
  const isAudible = !track.muted && (!hasSolo || track.soloed)

  useEffect(() => {
    if (track.type !== 'synth') return
    const handler = (e: Event) => {
      const { trackId, status } = (e as CustomEvent).detail
      if (trackId === track.id) setSfStatus(status)
    }
    window.addEventListener('soundfont-status', handler)
    return () => window.removeEventListener('soundfont-status', handler)
  }, [track.id, track.type])

  useEffect(() => {
    if (track.type !== 'synth') return
    setSfStatus(track.instrument.soundfont ? 'loading' : 'idle')
  }, [track.type, track.instrument.soundfont])

  const commitRename = () => {
    const trimmed = nameVal.trim()
    if (trimmed && trimmed !== track.name) onRename(trimmed)
    else setNameVal(track.name)
    setEditing(false)
  }

  return (
    <div
      className={cn(
        'flex flex-col justify-center gap-1 px-2 py-1.5 border-r border-border/30 select-none cursor-pointer',
        isActive ? 'bg-primary/5' : ''
      )}
      style={{ width: HEADER_W, minWidth: HEADER_W }}
      onClick={onSelect}
    >
      {/* Row 1: drag handle + color strip + name + action buttons */}
      <div className="flex items-center gap-1.5">
        <div
          className="shrink-0 text-muted-foreground/30 hover:text-muted-foreground/60 cursor-grab active:cursor-grabbing transition-colors"
          onMouseDown={e => { e.stopPropagation(); onDragHandleMouseDown() }}
          title="Drag to reorder"
        >
          <GripVertical className="w-3 h-3" />
        </div>
        <div
          className="w-1.5 h-7 rounded-full shrink-0"
          style={{ background: isAudible ? track.color : 'var(--color-muted-foreground)', opacity: isAudible ? 1 : 0.5 }}
        />

        {/* Editable name */}
        <div className="flex-1 min-w-0" onClick={e => e.stopPropagation()}>
          {editing ? (
            <input
              ref={inputRef}
              autoFocus
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') { setNameVal(track.name); setEditing(false) }
              }}
              className="w-full bg-muted/50 border border-primary/50 rounded px-1 text-xs font-semibold text-foreground outline-none"
            />
          ) : (
            <p
              className="text-xs font-semibold text-foreground truncate leading-tight cursor-text"
              title="Double-click to rename"
              onDoubleClick={e => { e.stopPropagation(); setNameVal(track.name); setEditing(true) }}
            >
              {track.name}
            </p>
          )}
          <div className="flex items-center gap-1">
            <p className="text-xs text-muted-foreground capitalize leading-tight">
              {track.type === 'synth' && track.instrument.soundfont
                ? (SOUNDFONT_INSTRUMENTS.find(i => i.id === track.instrument.soundfont)?.label ?? 'Synth')
                : track.type}
            </p>
            {sfStatus === 'loading' && (
              <Loader2 className="w-2.5 h-2.5 animate-spin text-muted-foreground shrink-0" />
            )}
            {sfStatus === 'error' && (
              <span title="Failed to load samples" className="shrink-0">
                <AlertCircle className="w-2.5 h-2.5 text-destructive" />
              </span>
            )}
          </div>
        </div>

        {/* Button cluster */}
        <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={onMute} title="Mute"
            className={cn('w-5 h-5 rounded text-xs font-bold transition-colors',
              track.muted ? 'bg-destructive text-white' : 'bg-muted/40 text-muted-foreground hover:text-foreground')}>
            M
          </button>
          <button onClick={onSolo} title="Solo"
            className={cn('w-5 h-5 rounded text-xs font-bold transition-colors',
              track.soloed ? 'bg-warning text-black' : 'bg-muted/40 text-muted-foreground hover:text-foreground')}>
            S
          </button>
          {track.type === 'sample' && track.sampleUrl && (
            <a href={track.sampleUrl} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="p-1 rounded text-muted-foreground hover:text-primary transition-colors">
              <Mic className="w-3 h-3" />
            </a>
          )}
          <button onClick={onDuplicate} title="Duplicate track"
            className="p-1 rounded text-muted-foreground hover:text-primary transition-colors">
            <Copy className="w-3 h-3" />
          </button>
          <button onClick={onDelete} title="Remove track"
            className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Row 2: volume slider */}
      <div className="flex items-center gap-1.5 pl-3" onClick={e => e.stopPropagation()}>
        <input
          type="range" min={0} max={1} step={0.01}
          value={track.volume}
          onChange={e => onVolumeChange(parseFloat(e.target.value))}
          className="flex-1 h-1 cursor-pointer appearance-none rounded-full"
          style={{ accentColor: isAudible ? track.color : 'var(--color-muted-foreground)' }}
          title={`Volume: ${Math.round(track.volume * 100)}%`}
        />
        <span className={cn('text-xs font-mono tabular-nums w-7 text-right shrink-0',
          isAudible ? 'text-foreground' : 'text-muted-foreground line-through')}>
          {Math.round(track.volume * 100)}
        </span>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StudioPage() {
  const { state, dispatch, setActiveTrack, updateTrack, undo, redo, reorderTracks, duplicateTrack } = useStudio()
  const { tracks, activeTrackId, pianoRollOpen, timelineZoom } = state
  const [panel, setPanel] = useState<Panel>('edit')
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const dragHandlePressed = useRef(false)
  const { showTour, stepIdx, completeTour, startTour, nextStep, prevStep, jumpToStep } = useOnboarding()

  const handleEnableAudio = () => {
    setAudioUnlocked(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const tryStart = () => {
      if (w.Tone) {
        w.Tone.start().catch(() => {})
      } else {
        const poll = setInterval(() => {
          if (w.Tone) {
            clearInterval(poll)
            w.Tone.start().catch(() => {})
          }
        }, 50)
        setTimeout(() => clearInterval(poll), 5000)
      }
    }
    tryStart()
  }

  // ── Global keyboard shortcuts ─────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      const tag  = (e.target as HTMLElement).tagName
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable

      // Ctrl+Z / Ctrl+Shift+Z — undo/redo (always active)
      if (ctrl) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
        if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo() }
        return
      }

      // Space — play/pause (skip if focus is inside a text input)
      if (e.key === ' ' && !inInput) {
        e.preventDefault()
        dispatch({ type: 'SET_PLAYING', isPlaying: !state.isPlaying })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, dispatch, state.isPlaying])

  const synthCount   = tracks.filter(t => t.type === 'synth').length
  const drumCount    = tracks.filter(t => t.type === 'drums').length
  const barWidth     = BASE_BAR_W * timelineZoom
  const laneWidth    = BARS * barWidth
  const activeTrack  = tracks.find(t => t.id === activeTrackId)
  const hasSolo      = tracks.some(t => t.soloed)

  // Active tour step actions — do the thing each step is describing
  const handleTourStepEnter = useCallback((idx: number) => {
    const synthTrack = tracks.find(t => t.type === 'synth')
    const drumTrack  = tracks.find(t => t.type === 'drums')

    // Step 5: Synth clips — select synth track so clip lane is visible
    if (idx === 5 && synthTrack) {
      setActiveTrack(synthTrack.id)
    }
    // Step 6: Piano Roll — open first synth clip
    if (idx === 6 && synthTrack) {
      setActiveTrack(synthTrack.id)
      const clip = synthTrack.clips?.[0]
      if (clip) dispatch({ type: 'OPEN_PIANO_ROLL', trackId: synthTrack.id, clipId: clip.id })
    }
    // Step 7: AI Composer — keep piano roll open (open it if closed)
    if (idx === 7 && synthTrack) {
      setActiveTrack(synthTrack.id)
      const clip = synthTrack.clips?.[0]
      if (clip && !state.pianoRollOpen) dispatch({ type: 'OPEN_PIANO_ROLL', trackId: synthTrack.id, clipId: clip.id })
    }
    // Step 8: Drum Sequencer — close piano roll, select drum track, switch to edit panel
    if (idx === 8) {
      dispatch({ type: 'CLOSE_PIANO_ROLL' })
      if (drumTrack) { setActiveTrack(drumTrack.id); setPanel('edit') }
    }
    // Step 9: Instrument Panel — select synth track, switch to edit panel
    if (idx === 9) {
      if (synthTrack) { setActiveTrack(synthTrack.id); setPanel('edit') }
    }
    // Step 10: Mixer — switch to mixer panel
    if (idx === 10) {
      setPanel('mixer')
    }
  }, [tracks, state.pianoRollOpen, dispatch, setActiveTrack])

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden relative">
      <AudioEngine />

      {/* Audio unlock overlay — shown until user grants a gesture */}
      <AnimatePresence>
        {!audioUnlocked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.88, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.88, opacity: 0 }}
              transition={{ delay: 0.05, type: 'spring', stiffness: 280, damping: 22 }}
              className="flex flex-col items-center gap-5 p-8 rounded-2xl border border-border bg-card shadow-xl max-w-xs text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center"
              >
                <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </motion.div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">Enable Audio</p>
                <p className="text-xs text-muted-foreground">Browsers require a click before audio can play.</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleEnableAudio}
                className="w-full py-2.5 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all"
              >
                Start Studio
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <TransportBar />

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Track area ───────────────────────────────────────────────── */}
        <div id="tour-track-area" className="flex-1 overflow-auto">
          <div className="min-w-max">

            {/* Bar ruler */}
            <div id="tour-track-ruler" className="flex sticky top-0 z-20 bg-card/95 border-b border-border backdrop-blur-sm">
              <div
                className="shrink-0 px-3 py-1 flex items-center border-r border-border/30"
                style={{ width: HEADER_W }}
              >
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Track</span>
              </div>
              <div className="flex" style={{ width: laneWidth }}>
                {Array.from({ length: BARS }, (_, bar) => (
                  <div key={bar} className="border-l border-border/40 px-1.5 py-1" style={{ width: barWidth }}>
                    <span className="text-xs text-muted-foreground font-mono">{bar + 1}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Track rows */}
            <AnimatePresence initial={false}>
            {tracks.map((track, trackIdx) => {
              const isActive = activeTrackId === track.id
              const isDragging = draggingId === track.id
              const isDropTarget = !isDragging && dragOverIdx === trackIdx
              const handleRowClick = () => {
                setActiveTrack(track.id)
                if (track.type === 'synth' || track.type === 'drums') setPanel('edit')
              }

              return (
                <motion.div
                  key={track.id}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                <div
                  draggable
                  onDragStart={(e: React.DragEvent<HTMLDivElement>) => {
                    if (!dragHandlePressed.current) { e.preventDefault(); return }
                    dragHandlePressed.current = false
                    e.dataTransfer.effectAllowed = 'move'
                    setDraggingId(track.id)
                  }}
                  onDragOver={(e: React.DragEvent<HTMLDivElement>) => {
                    if (!draggingId || draggingId === track.id) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    setDragOverIdx(trackIdx)
                  }}
                  onDragLeave={(e: React.DragEvent<HTMLDivElement>) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverIdx(null)
                  }}
                  onDrop={(e: React.DragEvent<HTMLDivElement>) => {
                    e.preventDefault()
                    if (draggingId && draggingId !== track.id) {
                      const fromIdx = tracks.findIndex(t => t.id === draggingId)
                      reorderTracks(fromIdx, trackIdx)
                    }
                    setDraggingId(null); setDragOverIdx(null)
                  }}
                  onDragEnd={() => { setDraggingId(null); setDragOverIdx(null) }}
                  style={{ opacity: isDragging ? 0.4 : 1 }}
                  className={cn(
                    'flex items-stretch border-b transition-colors',
                    isDropTarget ? 'border-t-2 border-t-primary border-b-border/30' : 'border-b-border/30',
                    (track.type === 'drums' || track.type === 'synth') ? 'cursor-pointer' : '',
                    isActive ? 'bg-primary/5' : 'hover:bg-muted/5'
                  )}
                  onClick={track.type === 'drums' || track.type === 'synth' ? handleRowClick : undefined}
                >
                  <TrackHeader
                    track={track}
                    isActive={isActive}
                    hasSolo={hasSolo}
                    onSelect={handleRowClick}
                    onDelete={() => dispatch({ type: 'REMOVE_TRACK', trackId: track.id })}
                    onRename={name => updateTrack(track.id, { name })}
                    onVolumeChange={v => updateTrack(track.id, { volume: v })}
                    onMute={() => updateTrack(track.id, { muted: !track.muted })}
                    onSolo={() => updateTrack(track.id, { soloed: !track.soloed })}
                    onDuplicate={() => duplicateTrack(track.id)}
                    onDragHandleMouseDown={() => { dragHandlePressed.current = true }}
                  />

                  {/* Lane — fixed width matches bar ruler exactly */}
                  <div
                    className="flex items-center py-1 overflow-x-hidden"
                    style={{ width: laneWidth, minWidth: laneWidth }}
                  >
                    {track.type === 'drums' && (
                      <DrumLane
                        track={track}
                        barWidth={barWidth}
                        onClipOpen={() => { setActiveTrack(track.id); setPanel('edit') }}
                      />
                    )}
                    {track.type === 'synth'  && <ClipLane track={track} barWidth={barWidth} />}
                    {track.type === 'sample' && (
                      <div className="h-10 flex items-center px-2 w-full">
                        <div className="h-6 flex-1 rounded bg-warning/20 border border-warning/30 flex items-center px-2">
                          <span className="text-xs text-warning truncate">
                            {track.sampleUrl ? '● Sample loaded' : 'No sample'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                </motion.div>
              )
            })}
            </AnimatePresence>

          </div>
        </div>

        {/* Add track — always visible, outside scroll area */}
        <div id="tour-add-tracks" className="flex gap-2 px-3 py-2 border-b border-border/30 bg-background shrink-0">
          <button
            onClick={() => dispatch({ type: 'ADD_TRACK', track: newSynthTrack(synthCount + 1) })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-dashed border-border/50 transition-colors"
          >
            <Plus className="w-3 h-3" /> Add Synth
          </button>
          <button
            onClick={() => {
              const track = newDrumTrack(drumCount + 1)
              dispatch({ type: 'ADD_TRACK', track })
              setActiveTrack(track.id)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-dashed border-border/50 transition-colors"
          >
            <Plus className="w-3 h-3" /> Add Drums
          </button>
        </div>

        {/* ── Bottom panel ─────────────────────────────────────────────── */}
        <div id="tour-bottom-panel" className="border-t border-border bg-card/50 shrink-0">
          <div className="flex border-b border-border/40">
            <button
              onClick={() => setPanel('edit')}
              className={cn(
                'px-4 py-1.5 text-xs font-medium transition-colors',
                panel === 'edit'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {activeTrack?.type === 'synth'
                ? (activeTrack.instrument.soundfont
                    ? (SOUNDFONT_INSTRUMENTS.find(i => i.id === activeTrack.instrument.soundfont)?.label ?? 'Synth')
                    : 'Synth')
                : activeTrack?.type === 'drums' ? 'Drums' : 'Edit'}
            </button>
            <button
              onClick={() => setPanel('mixer')}
              className={cn(
                'px-4 py-1.5 text-xs font-medium flex items-center gap-1 transition-colors',
                panel === 'mixer'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Sliders className="w-3 h-3" /> Mixer
            </button>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {panel === 'edit' ? (
              <motion.div
                key="edit"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {activeTrack?.type === 'synth' && <InstrumentPanel trackId={activeTrack.id} />}
                {activeTrack?.type === 'drums' && (
                  <div className="overflow-x-auto"><DrumSequencer trackId={activeTrack.id} /></div>
                )}
                {(!activeTrack || activeTrack.type === 'sample') && (
                  <div className="px-4 py-2.5 text-xs text-muted-foreground space-y-0.5">
                    <p>Select a <b>Synth</b> track to edit its oscillator and envelope.</p>
                    <p>Select a <b>Drums</b> track to open the step sequencer.</p>
                    <p>Use the fader in each track header to adjust volume directly. M = Mute, S = Solo.</p>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="mixer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <div className="overflow-x-auto"><Mixer /></div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {pianoRollOpen && <PianoRoll />}
      {state.drumEditorOpen && <DrumEditor />}

      {/* Tour trigger button — bottom-right corner */}
      <AnimatePresence>
        {!showTour && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            onClick={startTour}
            className="fixed bottom-4 right-4 z-30 w-8 h-8 rounded-full bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/50 flex items-center justify-center shadow-card"
            title="Show walkthrough"
          >
            <HelpCircle className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Onboarding tour */}
      {showTour && (
        <OnboardingTour
          stepIdx={stepIdx}
          onNext={() => nextStep(TOUR_STEP_COUNT)}
          onBack={prevStep}
          onComplete={completeTour}
          onJumpToStep={jumpToStep}
          onStepEnter={handleTourStepEnter}
          layoutKey={tracks.length}
        />
      )}
    </div>
  )
}
