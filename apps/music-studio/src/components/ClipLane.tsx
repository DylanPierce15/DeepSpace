/**
 * ClipLane — renders a track's clips as draggable colored blocks.
 *
 * - Click clip  → open in Piano Roll
 * - Drag clip   → reposition (bar-snapped)
 * - Drag right edge → resize (bar-snapped)
 * - Right-click → context menu: Rename / Duplicate / Delete
 * - + button    → add a new clip at the next free bar
 */

import React, { useRef, useState, useCallback, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { useStudio } from '../hooks/useStudio'
import { Clip, Track, BARS, Note } from '../constants'
import { cn } from './ui'

// ── Clip content summary ──────────────────────────────────────────────────────

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'] as const

/** Returns a short human-readable summary of a clip's content. */
function clipContentSummary(notes: Note[]): string | null {
  if (notes.length === 0) return null
  const pitches = [...new Set(notes.map(n => NOTE_NAMES[n.midi % 12]))]
  if (pitches.length <= 4) return pitches.join(' · ')
  return `${notes.length} notes`
}

/** Returns a layout of note-bar positions for the mini preview waveform. */
function noteMiniMap(notes: Note[], clipSteps: number, width: number): { x: number; h: number }[] {
  if (notes.length === 0) return []
  const midiValues = notes.map(n => n.midi)
  const midiMin = Math.min(...midiValues)
  const midiRange = Math.max(1, Math.max(...midiValues) - midiMin)
  return notes.slice(0, 48).map(n => ({
    x: Math.floor((n.step / clipSteps) * width),
    h: 0.2 + 0.8 * (1 - (n.midi - midiMin) / midiRange),  // higher midi = shorter bar (top of range)
  }))
}

const BAR_W = 48   // px per bar (will be multiplied by zoom externally)

const CLIP_COLORS = [
  '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#f97316', '#84cc16',
  '#a78bfa', '#34d399', '#ffffff', '#94a3b8',
]

interface Props {
  track:     Track
  barWidth?: number  // px per bar, default BAR_W
}

interface CtxMenu {
  clip: Clip
  x:    number
  y:    number
}

export function ClipLane({ track, barWidth = BAR_W }: Props) {
  const {
    state, openPianoRoll,
    addClip, removeClip, updateClip, duplicateClip,
  } = useStudio()

  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const dragRef = useRef<{
    clipId:    string
    startX:    number
    startBar:  number
  } | null>(null)
  const resizeRef = useRef<{
    clipId:     string
    startX:     number
    startLength: number
    startBar:   number
  } | null>(null)

  const clips = track.clips ?? []
  const totalBars = BARS

  // ── Drag logic ─────────────────────────────────────────────────────────────
  const onDragStart = useCallback((e: React.MouseEvent, clip: Clip) => {
    e.stopPropagation()
    dragRef.current = { clipId: clip.id, startX: e.clientX, startBar: clip.startBar }

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const dx      = ev.clientX - dragRef.current.startX
      const deltaBars = Math.round(dx / barWidth)
      const newBar  = Math.max(0, Math.min(totalBars - clip.lengthBars, dragRef.current.startBar + deltaBars))
      updateClip(track.id, clip.id, { startBar: newBar })
    }

    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [track.id, barWidth, totalBars, updateClip])

  // ── Resize logic ──────────────────────────────────────────────────────────
  const onResizeStart = useCallback((e: React.MouseEvent, clip: Clip) => {
    e.stopPropagation()
    resizeRef.current = { clipId: clip.id, startX: e.clientX, startLength: clip.lengthBars, startBar: clip.startBar }

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return
      const dx       = ev.clientX - resizeRef.current.startX
      const delta    = Math.round(dx / barWidth)
      const newLen   = Math.max(1, resizeRef.current.startLength + delta)
      const maxLen   = totalBars - resizeRef.current.startBar
      updateClip(track.id, clip.id, { lengthBars: Math.min(maxLen, newLen) })
    }
    const onUp = () => {
      resizeRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [track.id, barWidth, totalBars, updateClip])

  // ── Add a clip at the next free bar ───────────────────────────────────────
  const addNewClip = useCallback(() => {
    const occupiedBars = new Set<number>()
    clips.forEach(c => {
      for (let b = c.startBar; b < c.startBar + c.lengthBars; b++) occupiedBars.add(b)
    })
    let startBar = 0
    while (occupiedBars.has(startBar) && startBar < totalBars) startBar++
    if (startBar >= totalBars) return

    const newClip: Clip = {
      id:         `clip-${track.id}-${Date.now()}`,
      name:       `Clip ${clips.length + 1}`,
      startBar,
      lengthBars: 2,
      notes:      [],
    }
    addClip(track.id, newClip)
    openPianoRoll(track.id, newClip.id)
  }, [clips, track.id, totalBars, addClip, openPianoRoll])

  return (
    <div
      id="tour-clip-lane"
      className="relative flex-1 h-12"
      onClick={() => setCtxMenu(null)}
      style={{ width: totalBars * barWidth, background: 'rgba(255,255,255,0.025)' }}
    >
      {/* Bar grid lines */}
      {Array.from({ length: totalBars + 1 }, (_, i) => (
        <div key={i} className="absolute top-0 h-full border-l border-border/20"
          style={{ left: i * barWidth }} />
      ))}

      {/* Empty state hint — only when no clips exist */}
      {clips.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs text-muted-foreground/40 select-none">
            Click <span className="font-bold text-muted-foreground/60">+</span> to add a clip
          </span>
        </div>
      )}

      {/* Clips */}
      {clips.map(clip => {
        const isActive  = state.pianoRollClipId === clip.id && state.pianoRollOpen
        const hasNotes  = clip.notes.length > 0
        const summary   = clipContentSummary(clip.notes)
        const clipW     = clip.lengthBars * barWidth - 2
        const clipSteps = clip.lengthBars * 16
        const miniMap   = hasNotes ? noteMiniMap(clip.notes, clipSteps, clipW) : []
        const clipColor = clip.color ?? track.color

        return (
          <div
            key={clip.id}
            className={cn(
              'absolute top-1 bottom-1 rounded-md cursor-pointer select-none border transition-all',
              isActive
                ? 'border-white/70 ring-1 ring-white/40 shadow-[0_0_8px_rgba(255,255,255,0.15)]'
                : hasNotes
                  ? 'border-transparent hover:border-white/30'
                  : 'border-dashed border-white/15 hover:border-white/30'
            )}
            style={{
              left:       clip.startBar * barWidth + 1,
              width:      clipW,
              background: hasNotes ? `${clipColor}66` : `${clipColor}22`,
            }}
            onMouseDown={e => {
              if ((e.target as HTMLElement).dataset.resize) return
              e.stopPropagation(); onDragStart(e, clip)
            }}
            onClick={e => { e.stopPropagation(); openPianoRoll(track.id, clip.id) }}
            onContextMenu={e => {
              e.preventDefault()
              e.stopPropagation()
              setCtxMenu({ clip, x: e.clientX, y: e.clientY })
            }}
          >
            {/* Top row: clip name + note summary */}
            <div className="absolute left-1.5 right-4 top-0.5 flex items-center gap-1.5 pointer-events-none overflow-hidden">
              <span
                className="text-xs font-semibold truncate shrink-0 leading-none"
                style={{ color: clipColor, maxWidth: clipW * 0.45 }}
              >
                {clip.name}
              </span>
              {summary && (
                <span
                  className="text-xs font-medium truncate leading-none opacity-80"
                  style={{ color: clipColor }}
                >
                  {summary}
                </span>
              )}
              {!hasNotes && (
                <span className="text-xs opacity-40 leading-none" style={{ color: clipColor }}>
                  empty
                </span>
              )}
            </div>

            {/* Bar-length badge */}
            {clipW > 40 && (
              <span
                className="absolute top-0.5 right-3 text-xs font-mono opacity-40 leading-none pointer-events-none"
                style={{ color: clipColor, fontSize: 9 }}
              >
                {clip.lengthBars}b
              </span>
            )}

            {/* Mini piano-roll preview — actual note positions */}
            {hasNotes && (
              <div className="absolute inset-x-0 bottom-1 pointer-events-none overflow-hidden" style={{ top: 16, height: 'calc(100% - 20px)' }}>
                {miniMap.map((pos, i) => (
                  <div
                    key={i}
                    className="absolute bottom-0 rounded-sm"
                    style={{
                      left:       Math.min(pos.x, clipW - 3),
                      width:      3,
                      height:     `${pos.h * 100}%`,
                      background: clipColor,
                      opacity:    0.7,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Empty-clip prompt */}
            {!hasNotes && clipW > 48 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-xs opacity-30" style={{ color: clipColor, fontSize: 10 }}>
                  click to add notes
                </span>
              </div>
            )}

            {/* Resize handle — right edge */}
            <div
              data-resize="true"
              className="absolute top-0 right-0 h-full w-2 cursor-ew-resize z-20 group/rh flex items-center justify-end pr-0.5"
              onMouseDown={e => { e.stopPropagation(); onResizeStart(e, clip) }}
              onClick={e => e.stopPropagation()}
            >
              <div className="w-px h-4/5 rounded-full bg-white/0 group-hover/rh:bg-white/50 transition-colors" />
            </div>

            {/* Playhead inside clip */}
            {state.isPlaying && (
              (() => {
                const absStep  = state.currentStep
                const clipStart = clip.startBar * 16
                const clipEnd   = (clip.startBar + clip.lengthBars) * 16
                if (absStep < clipStart || absStep >= clipEnd) return null
                const pct = (absStep - clipStart) / (clip.lengthBars * 16)
                return (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-white/70 z-10 pointer-events-none"
                    style={{ left: `${pct * 100}%` }}
                  />
                )
              })()
            )}
          </div>
        )
      })}

      {/* Add clip button */}
      <button
        onClick={e => { e.stopPropagation(); addNewClip() }}
        className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-colors"
        title="Add clip"
      >
        <Plus className="w-3 h-3" />
      </button>

      {/* Context menu */}
      {ctxMenu && (
        <>
        <div className="fixed inset-0 z-40" onClick={() => { setCtxMenu(null); setRenaming(null) }} />
        <div
          className="fixed z-50 bg-popover border border-border rounded-lg shadow-card py-1 min-w-[140px]"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          {renaming?.id === ctxMenu.clip.id ? (
            <div className="px-3 py-1">
              <input
                autoFocus
                value={renaming.name}
                onChange={e => setRenaming(r => r ? { ...r, name: e.target.value } : null)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    updateClip(track.id, renaming.id, { name: renaming.name })
                    setRenaming(null); setCtxMenu(null)
                  }
                  if (e.key === 'Escape') { setRenaming(null); setCtxMenu(null) }
                }}
                className="w-full bg-transparent text-sm text-foreground border-b border-primary outline-none"
              />
            </div>
          ) : (
            <>
              <button
                className="w-full px-3 py-1.5 text-xs text-left text-foreground hover:bg-muted/40 transition-colors"
                onClick={() => setRenaming({ id: ctxMenu.clip.id, name: ctxMenu.clip.name })}
              >Rename</button>
              <button
                className="w-full px-3 py-1.5 text-xs text-left text-foreground hover:bg-muted/40 transition-colors"
                onClick={() => { duplicateClip(track.id, ctxMenu.clip.id); setCtxMenu(null) }}
              >Duplicate</button>
              <div className="my-1 border-t border-border/40" />
              <p className="px-3 py-1 text-xs text-muted-foreground">Clip color</p>
              <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                {CLIP_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => { updateClip(track.id, ctxMenu.clip.id, { color: c }); setCtxMenu(null) }}
                    className="w-4 h-4 rounded-full border border-white/20 hover:scale-125 transition-transform"
                    style={{ background: c, outline: ctxMenu.clip.color === c ? '2px solid white' : undefined, outlineOffset: 1 }}
                    title={c}
                  />
                ))}
                {ctxMenu.clip.color && (
                  <button
                    onClick={() => { updateClip(track.id, ctxMenu.clip.id, { color: undefined }); setCtxMenu(null) }}
                    className="px-1.5 h-4 rounded text-xs text-muted-foreground hover:text-foreground transition-colors border border-border/40"
                  >reset</button>
                )}
              </div>
              <div className="my-1 border-t border-border/40" />
              <button
                className="w-full px-3 py-1.5 text-xs text-left text-destructive hover:bg-destructive/10 transition-colors"
                onClick={() => { removeClip(track.id, ctxMenu.clip.id); setCtxMenu(null) }}
              >Delete</button>
            </>
          )}
        </div>
        </>
      )}
    </div>
  )
}
