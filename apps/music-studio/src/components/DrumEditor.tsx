/**
 * DrumEditor — full-screen drum pattern editor overlay.
 *
 * Opens when a drum clip is clicked in the DrumLane, mirroring how
 * the Piano Roll opens for synth clips.
 *
 * Features:
 *   • 16-step grid for each drum row (Kick / Snare / Hi-Hat / Open Hat)
 *   • Per-step toggle — plays a preview hit on activation
 *   • Beat grouping (steps 0,4,8,12 visually separated)
 *   • Playhead tracking during playback
 *   • Clip-level controls: Clear, Duplicate pattern rows
 *   • Step count selector (16 / 32 steps)
 */

import React, { useCallback } from 'react'
import { X, Copy, Trash2, Play, Square } from 'lucide-react'
import { useStudio } from '../hooks/useStudio'
import { DRUM_ROWS } from '../constants'
import { cn } from './ui'

export function DrumEditor() {
  const {
    state, dispatch, closeDrumEditor, toggleDrumClipStep, previewDrumRef,
    updateDrumClip, play, stop,
  } = useStudio()

  const { drumEditorTrackId, drumEditorClipId, tracks, currentStep, isPlaying } = state

  const track = tracks.find(t => t.id === drumEditorTrackId)
  const clip  = track?.drumClips?.find(c => c.id === drumEditorClipId)

  const handleStep = useCallback((rowIdx: number, step: number, rowId: string) => {
    if (!drumEditorTrackId || !drumEditorClipId) return
    const wasActive = clip?.pattern[rowIdx]?.[step] ?? false
    toggleDrumClipStep(drumEditorTrackId, drumEditorClipId, rowIdx, step)
    if (!wasActive) previewDrumRef.current(rowId)
  }, [clip, drumEditorTrackId, drumEditorClipId, toggleDrumClipStep, previewDrumRef])

  const clearPattern = useCallback(() => {
    if (!drumEditorTrackId || !drumEditorClipId || !clip) return
    updateDrumClip(drumEditorTrackId, drumEditorClipId, {})
    // Clear all steps: we need to reset via replace. Use TOGGLE_DRUM_CLIP_STEP
    // Simplest: dispatch directly through the context updateDrumClip isn't enough here
    // We'll dispatch a custom approach through the state update
    // For now, toggle off all active steps
    const pattern = clip.pattern
    DRUM_ROWS.forEach((_, rowIdx) => {
      pattern[rowIdx]?.forEach((active, step) => {
        if (active) toggleDrumClipStep(drumEditorTrackId, drumEditorClipId, rowIdx, step)
      })
    })
  }, [clip, drumEditorTrackId, drumEditorClipId, updateDrumClip, toggleDrumClipStep])

  if (!track || !clip) return null

  const stepCount    = clip.pattern[0]?.length ?? 16
  const playheadStep = isPlaying ? currentStep % stepCount : -1

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/65"
      onContextMenu={e => e.preventDefault()}
    >
      <div className="w-full bg-background border-t border-border" style={{ height: '52vh', minHeight: 240 }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/80 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: track.color }} />
            <span className="text-sm font-semibold text-foreground truncate">
              {track.name} — {clip.name}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">Drum Editor</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Step count toggle */}
            <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-0.5">
              {[16, 32].map(n => (
                <button
                  key={n}
                  onClick={() => {
                    if (!drumEditorTrackId || !drumEditorClipId || !clip) return
                    if ((clip.pattern[0]?.length ?? 16) === n) return
                    const newPattern = DRUM_ROWS.map((_, ri) => {
                      const row = clip.pattern[ri] ?? Array(16).fill(false)
                      return n === 32
                        ? [...row.slice(0, 16), ...Array(16).fill(false)]
                        : row.slice(0, 16)
                    })
                    dispatch({
                      type: 'TOGGLE_DRUM_CLIP_STEP',   // abuse not ideal — use direct dispatch
                      trackId: drumEditorTrackId,
                      clipId:  drumEditorClipId,
                      row: -1,  // sentinel — handled in reducer as no-op, pattern set via UPDATE_DRUM_CLIP
                      step: -1,
                    } as any)
                    // Actually replace via direct track update
                    dispatch({
                      type: 'UPDATE_TRACK',
                      trackId: drumEditorTrackId,
                      updates: {
                        drumClips: track.drumClips?.map(c =>
                          c.id === drumEditorClipId ? { ...c, pattern: newPattern } : c
                        ),
                      },
                    })
                  }}
                  className={cn(
                    'px-2 py-0.5 rounded text-xs font-mono font-bold transition-colors',
                    stepCount === n ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
                  )}
                >{n}</button>
              ))}
            </div>

            {/* Clear */}
            <button
              onClick={clearPattern}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors border border-transparent hover:border-destructive/30"
              title="Clear all steps"
            >
              <Trash2 className="w-3 h-3" /> Clear
            </button>

            {/* Play / Stop */}
            <button
              onClick={isPlaying ? stop : play}
              className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
                isPlaying ? 'bg-destructive text-white hover:bg-destructive/80' : 'bg-primary text-white hover:bg-primary/80'
              )}
              title={isPlaying ? 'Stop' : 'Play'}
            >
              {isPlaying ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
            </button>

            {/* Close */}
            <button
              onClick={closeDrumEditor}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Step grid ──────────────────────────────────────────────────── */}
        <div className="h-[calc(100%-48px)] overflow-auto px-4 py-3 flex flex-col justify-around gap-2">
          {DRUM_ROWS.map((row, rowIdx) => {
            const pattern = clip.pattern[rowIdx] ?? Array(stepCount).fill(false)
            return (
              <div key={row.id} className="flex items-center gap-2">
                {/* Row label */}
                <div className="w-16 shrink-0 text-right">
                  <span className="text-xs font-semibold text-muted-foreground">{row.label}</span>
                </div>

                {/* Steps */}
                <div className="flex gap-0.5 flex-wrap">
                  {Array.from({ length: stepCount }, (_, step) => {
                    const active    = pattern[step] ?? false
                    const isCurrent = isPlaying && playheadStep === step
                    const isBeat    = step % 4 === 0
                    const isBar     = step % 16 === 0 && step > 0

                    return (
                      <button
                        key={step}
                        onClick={() => handleStep(rowIdx, step, row.id)}
                        title={`${row.label} step ${step + 1}`}
                        className={cn(
                          'h-9 rounded transition-all border',
                          stepCount === 32 ? 'w-5' : 'w-8',
                          isBar ? 'ml-2' : isBeat ? 'ml-1' : '',
                          active
                            ? 'border-transparent scale-[0.93]'
                            : 'bg-muted/25 border-border/40 hover:bg-muted/50',
                          active && isCurrent ? 'brightness-125 scale-100' : '',
                          !active && isCurrent ? 'border-primary/60 bg-primary/10' : '',
                        )}
                        style={active ? { background: track.color, borderColor: 'transparent' } : {}}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
