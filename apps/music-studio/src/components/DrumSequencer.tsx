/**
 * DrumSequencer — 16-step pattern editor for the active DrumClip.
 *
 * Improvements:
 *   - Beat grouping: steps grouped 4x4 with visual gaps between beats
 *   - Velocity top-bar on each active step (width = velocity %)
 *   - Playhead glow highlights the current step while playing
 *   - Row labels color-matched with volume readout
 *   - Empty state guides user to click a clip or add a pattern
 *
 * Left-click:  toggle step on/off
 * Right-drag:  adjust velocity (up = louder, down = quieter) on active step
 * Brightness:  opacity = 0.15 + vel * 0.85
 */

import React, { useCallback } from 'react'
import { Plus, Layers } from 'lucide-react'
import { useStudio } from '../hooks/useStudio'
import { DRUM_ROWS, DRUM_ROW_COUNT, DEFAULT_STEP_VELOCITY } from '../constants'
import { cn } from './ui'

interface Props { trackId: string }

const ROW_COLORS = DRUM_ROWS.map(r => r.color)

export function DrumSequencer({ trackId }: Props) {
  const { state, toggleDrumClipStep, setDrumRowVolume, setDrumStepVelocity, addDrumClip, previewDrumRef } = useStudio()

  const track = state.tracks.find(t => t.id === trackId)
  if (!track || track.type !== 'drums') return null

  const activeClip  = track.drumClips?.find(c => c.id === track.activeDrumClipId) ?? null
  const drumVols    = track.drumVolumes    ?? Array.from({ length: DRUM_ROW_COUNT }, () => 1)
  const drumVels    = track.drumVelocities ?? Array.from({ length: DRUM_ROW_COUNT }, () => Array(16).fill(DEFAULT_STEP_VELOCITY))
  const currentStep = state.currentStep % 16

  const handleStep = useCallback((rowIdx: number, step: number, rowId: string) => {
    if (!activeClip) return
    const wasActive = activeClip.pattern[rowIdx]?.[step] ?? false
    toggleDrumClipStep(trackId, activeClip.id, rowIdx, step)
    if (!wasActive) {
      const vel = Math.min(1, (track.volume ?? 1) * (drumVols[rowIdx] ?? 1) * (drumVels[rowIdx]?.[step] ?? DEFAULT_STEP_VELOCITY))
      previewDrumRef.current(rowId, vel)
    }
  }, [activeClip, trackId, track.volume, drumVols, drumVels, toggleDrumClipStep, previewDrumRef])

  const handleVelDragStart = useCallback((e: React.MouseEvent, rowIdx: number, step: number, active: boolean) => {
    if (e.button !== 2 || !active) return
    e.preventDefault(); e.stopPropagation()
    const startY   = e.clientY
    const startVel = drumVels[rowIdx]?.[step] ?? DEFAULT_STEP_VELOCITY
    const onMove   = (ev: MouseEvent) => setDrumStepVelocity(trackId, rowIdx, step, Math.max(0.05, Math.min(1, startVel + (startY - ev.clientY) / 80)))
    const onUp     = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }, [drumVels, trackId, setDrumStepVelocity])

  // Empty state
  if (!activeClip) {
    const hasClips = (track.drumClips?.length ?? 0) > 0
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-6 px-4">
        <div className="w-10 h-10 rounded-full bg-muted/40 flex items-center justify-center mb-1">
          <Layers className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground text-center">
          {hasClips
            ? 'Click a drum clip in the timeline to edit its pattern here'
            : 'No patterns yet — add your first drum clip to start programming'
          }
        </p>
        {!hasClips && (
          <button
            onClick={() => addDrumClip(trackId, {
              id: `drumclip-${trackId}-${Date.now()}`, name: 'Pattern 1', startBar: 0, lengthBars: 8,
              pattern: Array.from({ length: DRUM_ROW_COUNT }, () => Array(16).fill(false)),
            })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/30"
          >
            <Plus className="w-3.5 h-3.5" /> Add Pattern
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="px-3 py-2 space-y-0.5" onContextMenu={e => e.preventDefault()}>
      {/* Clip header */}
      <div className="flex items-center gap-2 pb-1.5 mb-0.5 border-b border-border/20">
        <div className="w-2 h-2 rounded-full" style={{ background: track.color }} />
        <span className="text-xs font-semibold text-foreground">{activeClip.name}</span>
        <span className="text-xs text-muted-foreground">
          ({(track.drumClips?.findIndex(c => c.id === activeClip.id) ?? 0) + 1} of {track.drumClips?.length ?? 1})
        </span>
        <span className="ml-auto text-xs text-muted-foreground/40">{activeClip.lengthBars} bars</span>
      </div>

      {/* Step number header */}
      <div className="flex items-center gap-2">
        <div style={{ width: 88 }} className="shrink-0" />
        <div className="flex gap-0.5">
          {Array.from({ length: 4 }, (_, beat) => (
            <div key={beat} className={cn('flex gap-0.5', beat > 0 && 'ml-1')}>
              {Array.from({ length: 4 }, (_, si) => (
                <div key={si} className="text-center text-muted-foreground/30 font-mono"
                  style={{ width: 24, fontSize: 9 }}>
                  {beat * 4 + si + 1}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Rows */}
      {DRUM_ROWS.map((row, rowIdx) => {
        const rowVol   = drumVols[rowIdx] ?? 1
        const rowColor = ROW_COLORS[rowIdx] ?? track.color
        const pattern  = activeClip.pattern[rowIdx] ?? Array(16).fill(false)

        return (
          <div key={row.id} className="flex items-center gap-2">
            {/* Row label + volume slider */}
            <div className="flex flex-col gap-0.5 shrink-0" style={{ width: 88 }}>
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full shrink-0 ring-1 ring-black/20" style={{ background: rowColor }} />
                  <span className="text-xs text-muted-foreground font-mono truncate" style={{ fontSize: 11 }}>
                    {row.label}
                  </span>
                </div>
                <span className="text-xs font-mono tabular-nums shrink-0" style={{ color: rowColor, opacity: 0.8, fontSize: 10 }}>
                  {Math.round(rowVol * 100)}
                </span>
              </div>
              <input
                type="range" min={0} max={1} step={0.01} value={rowVol}
                onChange={e => setDrumRowVolume(trackId, rowIdx, parseFloat(e.target.value))}
                onMouseUp={e => previewDrumRef.current(row.id, Math.min(1, (track.volume ?? 1) * parseFloat((e.target as HTMLInputElement).value)))}
                className="w-full h-1 cursor-pointer appearance-none rounded-full"
                style={{ accentColor: rowVol > 0 ? rowColor : 'var(--color-muted-foreground)' }}
              />
            </div>

            {/* Step pads — 4 groups of 4 with gap between beats */}
            <div className="flex gap-0.5">
              {Array.from({ length: 4 }, (_, beat) => (
                <div key={beat} className={cn('flex gap-0.5', beat > 0 && 'ml-1')}>
                  {Array.from({ length: 4 }, (_, si) => {
                    const step      = beat * 4 + si
                    const active    = pattern[step] ?? false
                    const vel       = drumVels[rowIdx]?.[step] ?? DEFAULT_STEP_VELOCITY
                    const isCurrent = state.isPlaying && currentStep === step

                    return (
                      <div
                        key={step}
                        className="relative shrink-0 rounded-sm"
                        style={{ width: 24, height: 24, cursor: active ? 'ns-resize' : 'pointer' }}
                        onClick={() => handleStep(rowIdx, step, row.id)}
                        onMouseDown={e => handleVelDragStart(e, rowIdx, step, active)}
                        onContextMenu={e => e.preventDefault()}
                        title={active
                          ? `${row.label} step ${step + 1} · vel ${Math.round(vel * 100)}%`
                          : `${row.label} step ${step + 1}`}
                      >
                        {/* Pad body */}
                        <div
                          className={cn(
                            'absolute inset-0 rounded-sm transition-all',
                            !active && 'hover:opacity-70',
                            isCurrent && !active && 'ring-1 ring-white/30',
                          )}
                          style={{
                            background: active ? rowColor : 'rgba(255,255,255,0.06)',
                            opacity:    active ? 0.15 + vel * 0.85 : 1,
                            boxShadow:  active && isCurrent ? `0 0 8px ${rowColor}90` : undefined,
                          }}
                        />
                        {/* Velocity top bar */}
                        {active && (
                          <div
                            className="absolute top-0 left-0 h-[3px] rounded-t-sm"
                            style={{ background: rowColor, width: `${vel * 100}%`, opacity: 0.95 }}
                          />
                        )}
                        {/* Playhead line on inactive step */}
                        {isCurrent && !active && (
                          <div className="absolute bottom-0 inset-x-0 h-px bg-white/25 rounded-b-sm" />
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Footer */}
      <div className="flex items-center pt-1.5 border-t border-border/20 mt-1">
        <span className="text-xs text-muted-foreground/40">
          Click: toggle · Right-drag active step: velocity · Brightness = velocity
        </span>
      </div>
    </div>
  )
}
