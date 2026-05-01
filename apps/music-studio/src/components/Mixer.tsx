/**
 * Mixer — per-track volume fader, pan, mute, solo
 */

import React from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { useStudio } from '../hooks/useStudio'
import { cn } from './ui'

export function Mixer() {
  const { state, updateTrack } = useStudio()
  const { tracks } = state
  const hasSolo = tracks.some(t => t.soloed)

  return (
    <div className="flex gap-2 p-3 overflow-x-auto">
      {tracks.map(track => {
        const isAudible = !track.muted && (!hasSolo || track.soloed)
        return (
          <div
            key={track.id}
            className="flex flex-col items-center gap-2 w-16 shrink-0"
          >
            {/* Track color dot + name */}
            <div className="w-3 h-3 rounded-full" style={{ background: track.color }} />
            <span className="text-xs text-muted-foreground truncate w-full text-center" title={track.name}>
              {track.name}
            </span>

            {/* Volume fader (vertical) */}
            <div className="relative h-24 flex items-center justify-center">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={track.volume}
                onChange={e => updateTrack(track.id, { volume: parseFloat(e.target.value) })}
                className="appearance-none w-2 h-24 rounded cursor-pointer"
                style={{
                  writingMode: 'vertical-lr' as const,
                  direction: 'rtl',
                  accentColor: track.color,
                }}
                title={`Volume: ${Math.round(track.volume * 100)}%`}
              />
            </div>

            {/* Volume % */}
            <span className="text-xs font-mono text-muted-foreground">
              {Math.round(track.volume * 100)}
            </span>

            {/* Pan */}
            <input
              type="range"
              min={-1}
              max={1}
              step={0.01}
              value={track.pan}
              onChange={e => updateTrack(track.id, { pan: parseFloat(e.target.value) })}
              className="w-14 cursor-pointer"
              style={{ accentColor: track.color }}
              title={`Pan: ${track.pan === 0 ? 'C' : track.pan > 0 ? `R${Math.round(track.pan * 100)}` : `L${Math.round(-track.pan * 100)}`}`}
            />

            {/* Mute / Solo */}
            <div className="flex gap-1">
              <button
                onClick={() => updateTrack(track.id, { muted: !track.muted })}
                className={cn(
                  'w-6 h-5 rounded text-xs font-bold transition-colors',
                  track.muted ? 'bg-destructive text-white' : 'bg-muted/40 text-muted-foreground hover:text-foreground'
                )}
                title="Mute"
              >M</button>
              <button
                onClick={() => updateTrack(track.id, { soloed: !track.soloed })}
                className={cn(
                  'w-6 h-5 rounded text-xs font-bold transition-colors',
                  track.soloed ? 'bg-warning text-black' : 'bg-muted/40 text-muted-foreground hover:text-foreground'
                )}
                title="Solo"
              >S</button>
            </div>

            {/* Audibility indicator */}
            {isAudible
              ? <Volume2 className="w-3 h-3 text-success" />
              : <VolumeX className="w-3 h-3 text-muted-foreground" />
            }
          </div>
        )
      })}
    </div>
  )
}
