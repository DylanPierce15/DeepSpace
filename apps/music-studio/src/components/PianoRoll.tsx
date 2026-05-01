/**
 * Piano Roll — clip-aware, with:
 *   • Quantize snap  (1/16 → Bar)
 *   • Scale highlighting
 *   • Multi-select (Shift+click, Delete key)
 *   • Right-click to delete
 */

import React, { useRef, useCallback, useEffect, useState } from 'react'
import { X, AlignCenter, Keyboard, Play, Square } from 'lucide-react'
import { useStudio } from '../hooks/useStudio'
import { useKeyboardPlay } from '../hooks/useKeyboardPlay'
import { AiComposerPanel } from './AiComposerPanel'
import {
  PIANO_ROLL_NOTES, TOTAL_STEPS, Note,
  QUANTIZE_OPTIONS, MUSICAL_SCALES, SCALE_NAMES,
} from '../constants'
import { cn } from './ui'

function KeyboardPlayHint() {
  useKeyboardPlay()  // activates key listeners
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border-b border-primary/20 text-xs text-primary">
      <Keyboard className="w-3 h-3 shrink-0" />
      <span>Keyboard mode ON — play notes with <b>A S D F G H J</b> (white) <b>W E T Y U</b> (black) · Z/X shift octave · notes record to active clip</span>
    </div>
  )
}

const BASE_CELL_W = 28
const CELL_H      = 14
const KEY_W       = 52

function noteId() { return `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }

function snapToGrid(step: number, quantizeSteps: number): number {
  return Math.round(step / quantizeSteps) * quantizeSteps
}

export function PianoRoll() {
  const {
    state, dispatch,
    addNoteToClip, removeNoteFromClip, replaceClipNotes,
    addNote, removeNote,
    closePianoRoll, selectNotes, deselectNotes,
    setQuantize, setScale,
    previewNoteRef, play, stop,
  } = useStudio()

  const {
    pianoRollTrackId, pianoRollClipId, tracks, currentStep, isPlaying,
    selectedNoteIds, quantizeSteps, activeScale, timelineZoom,
  } = state

  const CELL_W = BASE_CELL_W * timelineZoom

  const track = tracks.find(t => t.id === pianoRollTrackId)
  const clip  = pianoRollClipId ? track?.clips?.find(c => c.id === pianoRollClipId) : null

  // Notes and total steps for this editing context
  const notes     = clip ? clip.notes : (track?.notes ?? [])
  const maxSteps  = clip ? clip.lengthBars * 16 : TOTAL_STEPS

  // Scale pitch classes (midi % 12)
  const scalePCs = MUSICAL_SCALES[activeScale] ?? []

  // ── Ghost notes from other synth tracks ───────────────────────────────────
  // Collect notes from all other synth tracks that fall within this clip's time window.
  // They render at 12% opacity as compositional reference.
  const ghostNotes: Array<{ note: Note; color: string }> = []
  if (track) {
    const clipStart = clip ? clip.startBar * 16 : 0
    const clipEnd   = clipStart + maxSteps
    tracks.forEach(t => {
      if (t.id === track.id || t.type !== 'synth') return
      const otherNotes: Note[] = []
      if (t.clips?.length) {
        t.clips.forEach(c => {
          const cStart = c.startBar * 16
          c.notes.forEach(n => {
            const abs = cStart + n.step
            if (abs >= clipStart && abs < clipEnd) {
              otherNotes.push({ ...n, step: abs - clipStart })
            }
          })
        })
      } else {
        (t.notes ?? []).forEach(n => {
          if (n.step >= clipStart && n.step < clipEnd) {
            otherNotes.push({ ...n, step: n.step - clipStart })
          }
        })
      }
      otherNotes.forEach(n => ghostNotes.push({ note: n, color: t.color }))
    })
  }

  const gridRef      = useRef<HTMLDivElement>(null)
  const isMouseDown  = useRef(false)
  const lastPlacedId = useRef<string | null>(null)

  // Drag-to-move state for selected notes
  const noteDragRef = useRef<{
    startMouseX:   number
    startMouseY:   number
    originalNotes: Note[]
    dragIds:       string[]
    moved:         boolean
  } | null>(null)

  // Drag-to-resize state for a single note's right edge
  const resizeDragRef = useRef<{
    noteId:          string
    startMouseX:     number
    startDuration:   number
  } | null>(null)

  // Lasso selection rect (coords relative to the note grid area, excluding key col)
  const [lassoRect, setLassoRect] = useState<{
    x1: number; y1: number; x2: number; y2: number
  } | null>(null)
  const lassoActiveRef = useRef(false)

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNoteIds.length === 0) return
        selectedNoteIds.forEach(nid => {
          if (clip && pianoRollTrackId && pianoRollClipId) {
            removeNoteFromClip(pianoRollTrackId, pianoRollClipId, nid)
          } else if (pianoRollTrackId) {
            removeNote(pianoRollTrackId, nid)
          }
        })
        deselectNotes()
      }
      if (e.key === 'Escape') deselectNotes()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedNoteIds, clip, pianoRollTrackId, pianoRollClipId, removeNoteFromClip, removeNote, deselectNotes])

  // ── Commit moved notes ────────────────────────────────────────────────────
  const commitNoteDrag = useCallback((updatedNotes: Note[]) => {
    if (clip && pianoRollTrackId && pianoRollClipId) {
      replaceClipNotes(pianoRollTrackId, pianoRollClipId, updatedNotes)
    } else if (pianoRollTrackId) {
      updatedNotes.forEach(n => dispatch({ type: 'UPDATE_NOTE', trackId: pianoRollTrackId, noteId: n.id, updates: { step: n.step, midi: n.midi } }))
    }
  }, [clip, pianoRollTrackId, pianoRollClipId, replaceClipNotes, dispatch])

  // ── Mouse interaction ──────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!track) return
    isMouseDown.current = true

    const target     = e.target as HTMLElement
    const noteDataId = target.dataset.noteId

    // Right-edge resize handle
    if (target.dataset.resizeHandle) {
      e.stopPropagation()
      const resizeNoteId = target.dataset.resizeHandle
      const resizeNote   = notes.find(n => n.id === resizeNoteId)
      if (!resizeNote) return

      resizeDragRef.current = {
        noteId:        resizeNoteId,
        startMouseX:   e.clientX,
        startDuration: resizeNote.duration,
      }

      const onMove = (ev: MouseEvent) => {
        if (!resizeDragRef.current) return
        const dx         = ev.clientX - resizeDragRef.current.startMouseX
        const deltSteps  = Math.round(dx / CELL_W)
        const newDur     = Math.max(1, snapToGrid(
          Math.max(quantizeSteps, resizeDragRef.current.startDuration + deltSteps),
          quantizeSteps,
        ))
        const updated = notes.map(n =>
          n.id === resizeDragRef.current!.noteId ? { ...n, duration: newDur } : n
        )
        if (clip && pianoRollTrackId && pianoRollClipId) {
          replaceClipNotes(pianoRollTrackId, pianoRollClipId, updated)
        } else if (pianoRollTrackId) {
          dispatch({ type: 'UPDATE_NOTE', trackId: pianoRollTrackId, noteId: resizeDragRef.current.noteId, updates: { duration: newDur } })
        }
      }

      const onUp = () => {
        resizeDragRef.current = null
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
      return
    }

    // Right-click: delete
    if (e.button === 2) {
      if (noteDataId) {
        if (clip && pianoRollTrackId && pianoRollClipId) removeNoteFromClip(pianoRollTrackId, pianoRollClipId, noteDataId)
        else if (pianoRollTrackId) removeNote(pianoRollTrackId, noteDataId)
      }
      return
    }

    // Shift+click: toggle selection
    if (e.shiftKey && noteDataId) {
      const next = selectedNoteIds.includes(noteDataId)
        ? selectedNoteIds.filter(id => id !== noteDataId)
        : [...selectedNoteIds, noteDataId]
      selectNotes(next)
      return
    }

    // Click / drag on existing note
    if (noteDataId) {
      // Ensure the note is selected
      const newSelection = selectedNoteIds.includes(noteDataId) ? selectedNoteIds : [noteDataId]
      selectNotes(newSelection)

      // Set up drag tracking
      const drag = {
        startMouseX:   e.clientX,
        startMouseY:   e.clientY,
        originalNotes: notes.map(n => ({ ...n })),
        dragIds:       newSelection,
        moved:         false,
      }
      noteDragRef.current = drag

      const onMove = (ev: MouseEvent) => {
        if (!noteDragRef.current) return
        const dx = ev.clientX - noteDragRef.current.startMouseX
        const dy = ev.clientY - noteDragRef.current.startMouseY
        if (!noteDragRef.current.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return
        noteDragRef.current.moved = true

        const stepDelta = Math.round(dx / CELL_W)
        const midiDelta = Math.round(-dy / CELL_H)   // Y inverted

        const midiMin = PIANO_ROLL_NOTES[PIANO_ROLL_NOTES.length - 1].midi
        const midiMax = PIANO_ROLL_NOTES[0].midi

        const moved = noteDragRef.current.originalNotes.map(n => {
          if (!noteDragRef.current!.dragIds.includes(n.id)) return n
          return {
            ...n,
            step: Math.max(0, Math.min(maxSteps - 1, n.step + stepDelta)),
            midi: Math.max(midiMin, Math.min(midiMax, n.midi + midiDelta)),
          }
        })
        commitNoteDrag(moved)
      }

      const onUp = () => {
        // If no drag happened, treat as click → play preview
        if (noteDragRef.current && !noteDragRef.current.moved) {
          const clickedNote = notes.find(n => n.id === noteDataId)
          if (clickedNote) previewNoteRef.current(clickedNote.midi, clickedNote.duration)
        }
        noteDragRef.current = null
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
      return
    }

    // Empty grid cell — Shift+drag = lasso, plain click = place note
    const rect   = gridRef.current!.getBoundingClientRect()
    const x      = e.clientX - rect.left - KEY_W
    const y      = e.clientY - rect.top

    if (e.shiftKey) {
      // ── Lasso selection ───────────────────────────────────────────────
      lassoActiveRef.current = true
      setLassoRect({ x1: x, y1: y, x2: x, y2: y })

      const onMove = (ev: MouseEvent) => {
        if (!lassoActiveRef.current) return
        const curX = ev.clientX - rect.left - KEY_W
        const curY = ev.clientY - rect.top
        setLassoRect({ x1: x, y1: y, x2: curX, y2: curY })
      }

      const onUp = () => {
        lassoActiveRef.current = false
        setLassoRect(prev => {
          if (!prev) return null
          // Select all notes inside the rectangle
          const lx1 = Math.min(prev.x1, prev.x2)
          const lx2 = Math.max(prev.x1, prev.x2)
          const ly1 = Math.min(prev.y1, prev.y2)
          const ly2 = Math.max(prev.y1, prev.y2)
          const selected: string[] = []
          notes.forEach(n => {
            const ri = PIANO_ROLL_NOTES.findIndex(pr => pr.midi === n.midi)
            if (ri < 0) return
            const nLeft   = n.step * CELL_W
            const nRight  = nLeft + n.duration * CELL_W
            const nTop    = ri * CELL_H
            const nBottom = nTop + CELL_H
            if (nRight > lx1 && nLeft < lx2 && nBottom > ly1 && nTop < ly2) {
              selected.push(n.id)
            }
          })
          if (selected.length > 0) selectNotes(selected)
          return null
        })
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
      return
    }

    // ── Place note ─────────────────────────────────────────────────────
    deselectNotes()
    const rawStep = Math.floor(x / CELL_W)
    const step    = Math.max(0, Math.min(maxSteps - 1, snapToGrid(rawStep, quantizeSteps)))
    const rowIdx  = Math.floor(y / CELL_H)
    if (step < 0 || step >= maxSteps || rowIdx < 0 || rowIdx >= PIANO_ROLL_NOTES.length) return

    const note: Note = {
      id:       noteId(),
      midi:     PIANO_ROLL_NOTES[rowIdx].midi,
      step,
      duration: quantizeSteps,
      velocity: 0.8,
    }
    lastPlacedId.current = note.id
    previewNoteRef.current(note.midi, note.duration)
    if (clip && pianoRollTrackId && pianoRollClipId) {
      addNoteToClip(pianoRollTrackId, pianoRollClipId, note)
    } else if (pianoRollTrackId) {
      addNote(pianoRollTrackId, note)
    }
  }, [track, clip, pianoRollTrackId, pianoRollClipId, notes, selectedNoteIds, quantizeSteps, maxSteps, CELL_W,
      addNoteToClip, addNote, removeNoteFromClip, removeNote, selectNotes, deselectNotes,
      previewNoteRef, commitNoteDrag, replaceClipNotes, dispatch])

  // ── Quantize all notes ─────────────────────────────────────────────────────
  const quantizeAll = useCallback(() => {
    const quantized = notes.map(n => ({ ...n, step: snapToGrid(n.step, quantizeSteps) }))
    if (clip && pianoRollTrackId && pianoRollClipId) {
      replaceClipNotes(pianoRollTrackId, pianoRollClipId, quantized)
    } else if (pianoRollTrackId) {
      quantized.forEach(n => dispatch({ type: 'UPDATE_NOTE', trackId: pianoRollTrackId, noteId: n.id, updates: { step: n.step } }))
    }
  }, [notes, quantizeSteps, clip, pianoRollTrackId, pianoRollClipId, replaceClipNotes, dispatch])

  if (!track) return null

  const playheadStep = clip
    ? currentStep - clip.startBar * 16
    : currentStep

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      onContextMenu={e => e.preventDefault()}
    >
      <div className="flex-1 flex flex-col min-h-0">

        {/* Keyboard mode banner */}
        {state.keyboardMode && <KeyboardPlayHint />}

        {/* ── Toolbar ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card/80 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: track.color }} />
            <span className="text-sm font-semibold text-foreground">
              {track.name}{clip ? ` — ${clip.name}` : ''} · Piano Roll
            </span>
            <span className="text-xs text-muted-foreground">{notes.length} note{notes.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="flex items-center gap-1 ml-auto">
            {/* Quantize selector */}
            <span className="text-xs text-muted-foreground mr-1">Q:</span>
            {QUANTIZE_OPTIONS.map(opt => (
              <button
                key={opt.steps}
                onClick={() => setQuantize(opt.steps)}
                className={cn(
                  'px-2 py-0.5 rounded text-xs font-mono transition-colors border',
                  quantizeSteps === opt.steps
                    ? 'bg-primary/20 text-primary border-primary/40'
                    : 'text-muted-foreground border-border/50 hover:text-foreground'
                )}
              >{opt.label}</button>
            ))}

            {/* Quantize all */}
            <button
              onClick={quantizeAll}
              title="Snap all notes to quantize grid"
              className="ml-1 p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>

            {/* Scale selector */}
            <span className="text-xs text-muted-foreground ml-2 mr-1">Scale:</span>
            <select
              value={activeScale}
              onChange={e => setScale(e.target.value)}
              className="text-xs bg-muted/40 border border-border/50 rounded px-1 py-0.5 text-foreground outline-none focus:border-primary"
            >
              {SCALE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {selectedNoteIds.length > 0 && (
              <span className="ml-2 text-xs text-primary font-medium">
                {selectedNoteIds.length} selected · drag to move · Del to remove
              </span>
            )}
            {selectedNoteIds.length === 0 && !state.keyboardMode && (
              <span className="ml-2 text-xs text-muted-foreground/60 hidden sm:inline">
                Click: place · Shift+drag: select · Shift+click: multi-select
              </span>
            )}
            {state.keyboardMode && !isPlaying && (
              <span className="ml-2 text-xs font-medium" style={{ color: 'rgb(16,185,129)' }}>
                ⌨ Step input — play keys to advance · Backspace to back up
              </span>
            )}
            {state.keyboardMode && isPlaying && (
              <span className="ml-2 text-xs font-medium text-warning">
                ⌨ Live record — keys held while playing are recorded
              </span>
            )}

            <button
              onClick={isPlaying ? stop : play}
              className={cn(
                'ml-2 w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
                isPlaying ? 'bg-destructive text-white hover:bg-destructive/80' : 'bg-primary text-white hover:bg-primary/80'
              )}
              title={isPlaying ? 'Stop' : 'Play'}
            >
              {isPlaying ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
            </button>

            <button
              onClick={closePianoRoll}
              className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── AI Composer Panel ───────────────────────────────────────────── */}
        <AiComposerPanel />

        {/* ── Grid ────────────────────────────────────────────────────────── */}
        <div className="overflow-auto flex-1">
          <div
            ref={gridRef}
            className="relative select-none"
            style={{ width: KEY_W + maxSteps * CELL_W, height: PIANO_ROLL_NOTES.length * CELL_H }}
            onMouseDown={handleMouseDown}
            onMouseUp={() => { isMouseDown.current = false; lastPlacedId.current = null }}
            onContextMenu={e => e.preventDefault()}
          >
            {/* Piano keys */}
            <div className="absolute left-0 top-0 z-10" style={{ width: KEY_W }}>
              {PIANO_ROLL_NOTES.map((n) => {
                const inScale = scalePCs.length > 0 && scalePCs.includes(n.midi % 12)
                return (
                  <div
                    key={n.midi}
                    className={cn(
                      'flex items-center justify-end pr-1 border-b border-border/30',
                      n.isBlack ? 'bg-muted/60' : 'bg-card',
                      inScale && !n.isBlack ? 'bg-primary/10' : '',
                      inScale && n.isBlack  ? 'bg-primary/20' : '',
                    )}
                    style={{ height: CELL_H, fontSize: 9 }}
                  >
                    {n.name === 'C'
                      ? <span className="font-bold text-primary" style={{ fontSize: 9 }}>{n.label}</span>
                      : !n.isBlack
                        ? <span className={cn(inScale ? 'text-primary' : 'text-muted-foreground')} style={{ fontSize: 9 }}>{n.label}</span>
                        : null
                    }
                  </div>
                )
              })}
            </div>

            {/* Note grid */}
            <div
              className="absolute top-0"
              style={{ left: KEY_W, width: maxSteps * CELL_W, height: PIANO_ROLL_NOTES.length * CELL_H }}
            >
              {/* Row backgrounds with scale highlighting */}
              {PIANO_ROLL_NOTES.map((n, i) => {
                const inScale = scalePCs.length > 0 && scalePCs.includes(n.midi % 12)
                return (
                  <div
                    key={n.midi}
                    className={cn(
                      'absolute w-full border-b',
                      n.isBlack ? 'bg-muted/20' : 'bg-transparent',
                      inScale ? 'bg-primary/5' : '',
                      n.name === 'C' ? 'border-primary/25' : 'border-border/20',
                    )}
                    style={{ top: i * CELL_H, height: CELL_H }}
                  />
                )
              })}

              {/* Bar dividers */}
              {Array.from({ length: Math.floor(maxSteps / 16) + 1 }, (_, bar) => (
                <div key={bar} className="absolute top-0 h-full border-l border-primary/30"
                  style={{ left: bar * 16 * CELL_W }} />
              ))}

              {/* Beat dividers */}
              {Array.from({ length: maxSteps / 4 }, (_, beat) => (
                <div key={beat} className="absolute top-0 h-full border-l border-border/40"
                  style={{ left: beat * 4 * CELL_W }} />
              ))}

              {/* Quantize grid lines (subtle) */}
              {quantizeSteps < 4 && Array.from({ length: maxSteps }, (_, s) => (
                s % quantizeSteps === 0 && s % 4 !== 0
                  ? <div key={s} className="absolute top-0 h-full border-l border-border/20"
                      style={{ left: s * CELL_W }} />
                  : null
              ))}

              {/* Playhead (transport playing) */}
              {isPlaying && playheadStep >= 0 && playheadStep < maxSteps && (
                <div
                  className="absolute top-0 h-full w-px bg-primary/80 z-20 pointer-events-none"
                  style={{ left: playheadStep * CELL_W }}
                />
              )}

              {/* Step-input cursor (keyboard mode, transport stopped) */}
              {state.keyboardMode && !isPlaying && state.keyInputStep >= 0 && state.keyInputStep < maxSteps && (
                <div
                  className="absolute top-0 h-full z-20 pointer-events-none"
                  style={{
                    left:    state.keyInputStep * CELL_W,
                    width:   state.quantizeSteps * CELL_W,
                    background: 'rgba(16,185,129,0.12)',
                    borderLeft: '2px solid rgb(16,185,129)',
                  }}
                >
                  <div className="absolute -top-0 left-1 px-1 py-0.5 rounded-b text-xs font-bold"
                    style={{ background: 'rgb(16,185,129)', color: '#000', fontSize: 8, lineHeight: '10px' }}>
                    ↓
                  </div>
                </div>
              )}

              {/* Lasso selection rectangle */}
              {lassoRect && (
                <div
                  className="absolute pointer-events-none z-30 rounded-sm"
                  style={{
                    left:    Math.min(lassoRect.x1, lassoRect.x2),
                    top:     Math.min(lassoRect.y1, lassoRect.y2),
                    width:   Math.abs(lassoRect.x2 - lassoRect.x1),
                    height:  Math.abs(lassoRect.y2 - lassoRect.y1),
                    border:  '1px dashed var(--color-primary)',
                    background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
                  }}
                />
              )}

              {/* Ghost notes from other tracks (compositional reference) */}
              {ghostNotes.map(({ note, color }, gi) => {
                const rowIdx = PIANO_ROLL_NOTES.findIndex(n => n.midi === note.midi)
                if (rowIdx < 0) return null
                return (
                  <div
                    key={`ghost-${gi}`}
                    className="absolute rounded-sm pointer-events-none z-5"
                    style={{
                      left:       note.step * CELL_W + 1,
                      top:        rowIdx * CELL_H + 1,
                      width:      note.duration * CELL_W - 2,
                      height:     CELL_H - 2,
                      background: color,
                      opacity:    0.12,
                    }}
                  />
                )
              })}

              {/* Notes */}
              {notes.map(note => {
                const rowIdx = PIANO_ROLL_NOTES.findIndex(n => n.midi === note.midi)
                if (rowIdx < 0) return null
                const isSelected = selectedNoteIds.includes(note.id)
                return (
                  <div
                    key={note.id}
                    data-note-id={note.id}
                    className={cn(
                      'absolute rounded-sm z-10 transition-colors overflow-hidden',
                      isSelected ? 'cursor-grab ring-2 ring-white/80 brightness-125 active:cursor-grabbing' : 'cursor-pointer hover:brightness-110'
                    )}
                    style={{
                      left:       note.step * CELL_W + 1,
                      top:        rowIdx * CELL_H + 1,
                      width:      note.duration * CELL_W - 2,
                      height:     CELL_H - 2,
                      background: track.color,
                      opacity:    0.82 + note.velocity * 0.18,
                    }}
                    title={`${PIANO_ROLL_NOTES[rowIdx].label} — shift+click to select, right-click to delete, drag right edge to resize`}
                  >
                    {/* Resize handle — right edge */}
                    <div
                      data-resize-handle={note.id}
                      className="absolute right-0 top-0 h-full cursor-ew-resize z-20"
                      style={{ width: 6, background: 'rgba(255,255,255,0.25)' }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Velocity lane (sits below the grid scroll, inside the flex-col) ── */}
      <div className="shrink-0 border-t border-border/50 bg-card/40" style={{ height: 68 }}>
        <div className="flex h-full overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {/* Label sidebar aligned with piano key col */}
          <div
            className="shrink-0 flex items-end justify-end px-2 pb-1 border-r border-border/30"
            style={{ width: KEY_W }}
          >
            <span className="text-xs text-muted-foreground/60 uppercase tracking-wider font-mono">vel</span>
          </div>

          {/* Velocity bars */}
          <div className="flex-1 relative overflow-hidden" style={{ minWidth: maxSteps * CELL_W }}>
            {/* Guide lines at 25%, 50%, 75% */}
            {[0.25, 0.5, 0.75].map(p => (
              <div
                key={p}
                className="absolute left-0 right-0 border-t pointer-events-none"
                style={{
                  bottom: `${p * 100}%`,
                  borderColor: p === 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                }}
              />
            ))}

            {/* One bar per note */}
            {notes.map(note => {
              const isSel  = selectedNoteIds.includes(note.id)
              const barH   = Math.max(4, note.velocity * 56)   // 56px max bar height
              const left   = note.step * CELL_W
              const width  = Math.max(6, note.duration * CELL_W - 2)

              return (
                <div
                  key={note.id}
                  className="absolute bottom-0 cursor-ns-resize group"
                  style={{ left, width, height: '100%' }}
                  onMouseDown={e => {
                    if (e.button !== 0) return
                    e.stopPropagation()
                    selectNotes([note.id])
                    const startY   = e.clientY
                    const startVel = note.velocity
                    const onMove   = (ev: MouseEvent) => {
                      const delta  = (startY - ev.clientY) / 56
                      const newVel = Math.max(0.02, Math.min(1, startVel + delta))
                      if (clip && pianoRollTrackId && pianoRollClipId) {
                        const updated = notes.map(n => n.id === note.id ? { ...n, velocity: newVel } : n)
                        replaceClipNotes(pianoRollTrackId, pianoRollClipId, updated)
                      } else if (pianoRollTrackId) {
                        dispatch({ type: 'UPDATE_NOTE', trackId: pianoRollTrackId, noteId: note.id, updates: { velocity: newVel } })
                      }
                    }
                    const onUp = () => {
                      window.removeEventListener('mousemove', onMove)
                      window.removeEventListener('mouseup', onUp)
                    }
                    window.addEventListener('mousemove', onMove)
                    window.addEventListener('mouseup', onUp)
                  }}
                >
                  {/* Bar fill */}
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded-t-sm transition-colors"
                    style={{
                      height:     barH,
                      background: isSel
                        ? `linear-gradient(0deg, ${track?.color ?? 'var(--color-primary)'} 0%, ${track?.color ?? 'var(--color-primary)'}aa 100%)`
                        : `linear-gradient(0deg, ${track?.color ?? 'var(--color-primary)'}88 0%, ${track?.color ?? 'var(--color-primary)'}44 100%)`,
                    }}
                  />
                  {/* Value label on hover */}
                  <div
                    className="absolute bottom-0 left-0 right-0 text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    style={{ bottom: barH + 2, fontSize: 8, color: isSel ? track?.color : 'rgba(255,255,255,0.5)' }}
                  >
                    {Math.round(note.velocity * 100)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

