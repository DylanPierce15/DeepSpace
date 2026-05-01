/**
 * DrumLane — clip-based drum arrangement timeline.
 *
 * Each clip shows a mini 4-row × 16-step dot grid (all drum rows visible)
 * so you can read the beat at a glance without opening the editor.
 *
 * Click clip      → setActiveDrumClip + call onClipOpen (switches bottom panel to edit tab)
 * Drag body       → move clip (bar-snapped)
 * Drag right edge → resize clip (bar-snapped, min 1 bar)
 * Right-click     → context menu: Rename / Duplicate / Delete
 * + button        → add new empty clip at next free bar
 */

import React, { useRef, useState, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { useStudio } from '../hooks/useStudio'
import { DrumClip, Track, BARS, DRUM_ROWS, DRUM_ROW_COUNT } from '../constants'
import { cn } from './ui'

const CLIP_COLORS = [
  '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#f97316', '#84cc16',
  '#a78bfa', '#34d399', '#ffffff', '#94a3b8',
]

interface Props {
  track:       Track
  barWidth:    number
  onClipOpen?: () => void   // called when a clip is clicked — lets StudioPage switch to edit tab
}
interface CtxMenu { clip: DrumClip; x: number; y: number }

// All 8 drum rows shown in the mini grid
const MINI_ROWS = DRUM_ROWS

export function DrumLane({ track, barWidth, onClipOpen }: Props) {
  const { state, addDrumClip, removeDrumClip, updateDrumClip, duplicateDrumClip, setActiveDrumClip } = useStudio()

  const [ctxMenu,  setCtxMenu]  = useState<CtxMenu | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const dragRef   = useRef<{ clipId: string; startX: number; startBar: number } | null>(null)
  const resizeRef = useRef<{ clipId: string; startX: number; startLen: number; startBar: number } | null>(null)

  const clips     = track.drumClips ?? []
  const activeId  = track.activeDrumClipId
  const totalBars = BARS

  const onDragStart = useCallback((e: React.MouseEvent, clip: DrumClip) => {
    e.stopPropagation()
    dragRef.current = { clipId: clip.id, startX: e.clientX, startBar: clip.startBar }
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const nb = Math.max(0, Math.min(totalBars - clip.lengthBars, dragRef.current.startBar + Math.round((ev.clientX - dragRef.current.startX) / barWidth)))
      updateDrumClip(track.id, clip.id, { startBar: nb })
    }
    const onUp = () => { dragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }, [track.id, barWidth, totalBars, updateDrumClip])

  const onResizeStart = useCallback((e: React.MouseEvent, clip: DrumClip) => {
    e.stopPropagation()
    resizeRef.current = { clipId: clip.id, startX: e.clientX, startLen: clip.lengthBars, startBar: clip.startBar }
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return
      const nl = Math.max(1, Math.min(totalBars - resizeRef.current.startBar, resizeRef.current.startLen + Math.round((ev.clientX - resizeRef.current.startX) / barWidth)))
      updateDrumClip(track.id, clip.id, { lengthBars: nl })
    }
    const onUp = () => { resizeRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }, [track.id, barWidth, totalBars, updateDrumClip])

  const addNew = useCallback(() => {
    const occ = new Set<number>()
    clips.forEach(c => { for (let b = c.startBar; b < c.startBar + c.lengthBars; b++) occ.add(b) })
    let sb = 0
    while (occ.has(sb) && sb < totalBars) sb++
    if (sb >= totalBars) return
    const nc: DrumClip = {
      id: `drumclip-${track.id}-${Date.now()}`, name: `Pattern ${clips.length + 1}`,
      startBar: sb, lengthBars: Math.min(2, totalBars - sb),
      pattern: Array.from({ length: DRUM_ROW_COUNT }, () => Array(16).fill(false)),
    }
    addDrumClip(track.id, nc)
    setActiveDrumClip(track.id, nc.id)
    onClipOpen?.()
  }, [clips, track.id, totalBars, addDrumClip, setActiveDrumClip, onClipOpen])

  return (
    <div className="relative flex-1 h-16" style={{ width: totalBars * barWidth }} onClick={() => setCtxMenu(null)}>
      {/* Bar grid */}
      {Array.from({ length: totalBars + 1 }, (_, i) => (
        <div key={i} className="absolute top-0 h-full border-l border-border/20" style={{ left: i * barWidth }} />
      ))}

      {/* Clips */}
      {clips.map(clip => {
        const isActive  = activeId === clip.id
        const clipW     = clip.lengthBars * barWidth - 2
        const totalSteps = 16 * clip.lengthBars
        const clipColor = clip.color ?? track.color

        return (
          <div
            key={clip.id}
            className={cn('absolute top-1 bottom-1 rounded-md cursor-pointer select-none border transition-all overflow-hidden',
              isActive ? 'border-white/50 ring-1 ring-white/25' : 'border-transparent hover:border-white/20'
            )}
            style={{
              left:       clip.startBar * barWidth + 1,
              width:      clipW,
              background: isActive ? `${clipColor}70` : `${clipColor}45`,
            }}
            onMouseDown={e => { if ((e.target as HTMLElement).dataset.resize) return; e.stopPropagation(); onDragStart(e, clip) }}
            onClick={e => {
              e.stopPropagation()
              setActiveDrumClip(track.id, clip.id)
              onClipOpen?.()
            }}
            onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ clip, x: e.clientX, y: e.clientY }) }}
          >
            {/* Clip name + bar count */}
            <div className="absolute left-1.5 right-3 top-0.5 flex items-center gap-1.5 pointer-events-none overflow-hidden">
              <span className="text-xs font-semibold truncate shrink-0 leading-none"
                style={{ color: clipColor, maxWidth: clipW * 0.55, fontSize: 10 }}>
                {clip.name}
              </span>
              <span className="text-xs opacity-40 font-mono leading-none shrink-0"
                style={{ color: clipColor, fontSize: 9 }}>
                {clip.lengthBars}b
              </span>
            </div>

            {/* ── Mini 8-row × N-step dot grid (pattern repeats per bar) ── */}
            <div
              className="absolute inset-x-1 pointer-events-none"
              style={{ top: 14, bottom: 2 }}
            >
              {MINI_ROWS.map((row, ri) => {
                const rowPattern = clip.pattern[ri] ?? Array(16).fill(false)
                const rowH = '10%'
                return (
                  <div
                    key={row.id}
                    className="absolute flex"
                    style={{ left: 0, right: 0, height: rowH, top: `${ri * 12}%` }}
                  >
                    {Array.from({ length: totalSteps }, (_, s) => {
                      const active = rowPattern[s % 16]
                      return (
                        <div
                          key={s}
                          className="flex-1"
                          style={{
                            background: active ? row.color : `${row.color}18`,
                            opacity:    active ? 0.9 : 0.4,
                          }}
                        />
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {/* Playhead */}
            {state.isPlaying && (() => {
              const abs = state.currentStep, s = clip.startBar * 16, e2 = (clip.startBar + clip.lengthBars) * 16
              if (abs < s || abs >= e2) return null
              return <div className="absolute top-0 bottom-0 w-px bg-white/60 z-10 pointer-events-none"
                style={{ left: `${((abs - s) / (clip.lengthBars * 16)) * 100}%` }} />
            })()}

            {/* Resize handle */}
            <div data-resize="true"
              className="absolute top-0 right-0 h-full w-2 cursor-ew-resize z-20 flex items-center justify-end pr-0.5 group/rh"
              onMouseDown={e => { e.stopPropagation(); onResizeStart(e, clip) }}
              onClick={e => e.stopPropagation()}>
              <div className="w-px h-3/4 rounded-full bg-white/0 group-hover/rh:bg-white/50 transition-colors" />
            </div>
          </div>
        )
      })}

      {/* Add clip */}
      <button onClick={e => { e.stopPropagation(); addNew() }}
        className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-colors"
        title="Add drum clip">
        <Plus className="w-3 h-3" />
      </button>

      {/* Context menu */}
      {ctxMenu && (
        <div className="fixed z-50 bg-popover border border-border rounded-lg shadow-card py-1 min-w-[140px]"
          style={{ left: ctxMenu.x, top: ctxMenu.y }} onClick={e => e.stopPropagation()}>
          {renaming?.id === ctxMenu.clip.id ? (
            <div className="px-3 py-1">
              <input autoFocus value={renaming.name}
                onChange={e => setRenaming(r => r ? { ...r, name: e.target.value } : null)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { updateDrumClip(track.id, renaming.id, { name: renaming.name }); setRenaming(null); setCtxMenu(null) }
                  if (e.key === 'Escape') { setRenaming(null); setCtxMenu(null) }
                }}
                className="w-full bg-transparent text-sm text-foreground border-b border-primary outline-none" />
            </div>
          ) : (
            <>
              <button className="w-full px-3 py-1.5 text-xs text-left text-foreground hover:bg-muted/40"
                onClick={() => setRenaming({ id: ctxMenu.clip.id, name: ctxMenu.clip.name })}>Rename</button>
              <button className="w-full px-3 py-1.5 text-xs text-left text-foreground hover:bg-muted/40"
                onClick={() => { duplicateDrumClip(track.id, ctxMenu.clip.id); setCtxMenu(null) }}>Duplicate</button>
              <div className="my-1 border-t border-border/40" />
              <p className="px-3 py-1 text-xs text-muted-foreground">Clip color</p>
              <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                {CLIP_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => { updateDrumClip(track.id, ctxMenu.clip.id, { color: c }); setCtxMenu(null) }}
                    className="w-4 h-4 rounded-full border border-white/20 hover:scale-125 transition-transform"
                    style={{ background: c, outline: ctxMenu.clip.color === c ? '2px solid white' : undefined, outlineOffset: 1 }}
                    title={c}
                  />
                ))}
                {ctxMenu.clip.color && (
                  <button
                    onClick={() => { updateDrumClip(track.id, ctxMenu.clip.id, { color: undefined }); setCtxMenu(null) }}
                    className="px-1.5 h-4 rounded text-xs text-muted-foreground hover:text-foreground transition-colors border border-border/40"
                  >reset</button>
                )}
              </div>
              <div className="my-1 border-t border-border/40" />
              <button className="w-full px-3 py-1.5 text-xs text-left text-destructive hover:bg-destructive/10"
                onClick={() => { removeDrumClip(track.id, ctxMenu.clip.id); setCtxMenu(null) }}>Delete</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
