/**
 * AiComposerPanel — AI music generation panel inside the Piano Roll.
 *
 * Three modes: Chord Progression | Melody Continuation | Drum Pattern
 * Settings: key, scale, mood/genre, length in bars
 * Results are inserted directly into the active clip.
 */

import React, { useState } from 'react'
import { Sparkles, RefreshCw, Plus, Check, X } from 'lucide-react'
import { useStudio } from '../hooks/useStudio'
import { useAiComposer, type AiMode } from '../hooks/useAiComposer'
import { SCALE_NAMES } from '../constants'
import { cn } from './ui'

const ROOT_NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const MOODS      = ['chill','uplifting','dark','energetic','melancholic','dreamy']
const GENRES     = ['lo-fi hip-hop','trap','house','R&B','jazz','pop','drum and bass']

export function AiComposerPanel() {
  const {
    state,
    addNoteToClip, replaceClipNotes,
    dispatch,
  } = useStudio()

  const { generate, isGenerating, pendingResult, errorMsg, acceptPending, rejectPending } = useAiComposer()

  const [mode,   setMode]   = useState<AiMode>('chords')
  const [key,    setKey]    = useState('C')
  const [scale,  setScale]  = useState('Major')
  const [mood,   setMood]   = useState('chill')
  const [genre,  setGenre]  = useState('lo-fi hip-hop')
  const [bars,   setBars]   = useState(2)
  const [panel,  setPanel]  = useState(false)   // collapsed by default

  const { pianoRollTrackId: trackId, pianoRollClipId: clipId } = state
  const clip = trackId && clipId
    ? state.tracks.find(t => t.id === trackId)?.clips?.find(c => c.id === clipId)
    : null

  const handleGenerate = async () => {
    const existingNotes = clip?.notes ?? []
    await generate({ mode, key, scale, mood, bars, genre, existingNotes })
    // Result sits in pendingResult — user must Accept or Reject before it's applied
  }

  const handleAccept = () => {
    const result = acceptPending()
    if (!result) return

    if (result.mode === 'drums' && result.drumPattern && trackId) {
      const drumTrack = state.tracks.find(t => t.type === 'drums')
      if (drumTrack) {
        dispatch({ type: 'UPDATE_TRACK', trackId: drumTrack.id, updates: { pattern: result.drumPattern } })
      }
    } else if (result.notes && trackId && clipId) {
      const lastStep = clip?.notes.reduce((m, n) => Math.max(m, n.step + n.duration), 0) ?? 0
      const startOffset = mode === 'melody' ? lastStep : 0
      const shifted = result.notes.map(n => ({ ...n, step: n.step + startOffset }))
        .filter(n => n.step < (clip?.lengthBars ?? 2) * 16)
      shifted.forEach(n => addNoteToClip(trackId, clipId, n))
    }
  }

  const handleAcceptReplace = () => {
    const result = acceptPending()
    if (!result?.notes || !clip || !trackId || !clipId) return
    replaceClipNotes(trackId, clipId, result.notes)
  }

  return (
    <div className="border-t border-border/40">
      {/* Toggle header */}
      <button
        onClick={() => setPanel(p => !p)}
        className="flex items-center gap-2 w-full px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-muted/20 transition-colors"
      >
        <Sparkles className="w-3.5 h-3.5" />
        AI Composer
        <span className={cn('ml-auto transition-transform', panel ? 'rotate-180' : '')}>▾</span>
      </button>

      {panel && (
        <div className="px-4 py-3 bg-card/30 space-y-3">
          {/* Mode tabs */}
          <div className="flex gap-1">
            {(['chords','melody','drums'] as AiMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors border',
                  mode === m
                    ? 'bg-primary/20 text-primary border-primary/40'
                    : 'text-muted-foreground border-border/50 hover:text-foreground'
                )}
              >{m}</button>
            ))}
          </div>

          {/* Settings row */}
          <div className="flex flex-wrap gap-2 items-center">
            {mode !== 'drums' && (
              <>
                <select value={key} onChange={e => setKey(e.target.value)}
                  className="text-xs bg-muted/40 border border-border/50 rounded px-1.5 py-1 text-foreground outline-none focus:border-primary">
                  {ROOT_NOTES.map(n => <option key={n}>{n}</option>)}
                </select>
                <select value={scale} onChange={e => setScale(e.target.value)}
                  className="text-xs bg-muted/40 border border-border/50 rounded px-1.5 py-1 text-foreground outline-none focus:border-primary">
                  {SCALE_NAMES.filter(s => s !== 'None').map(s => <option key={s}>{s}</option>)}
                </select>
              </>
            )}

            {mode === 'drums' ? (
              <select value={genre} onChange={e => setGenre(e.target.value)}
                className="text-xs bg-muted/40 border border-border/50 rounded px-1.5 py-1 text-foreground outline-none focus:border-primary">
                {GENRES.map(g => <option key={g}>{g}</option>)}
              </select>
            ) : (
              <select value={mood} onChange={e => setMood(e.target.value)}
                className="text-xs bg-muted/40 border border-border/50 rounded px-1.5 py-1 text-foreground outline-none focus:border-primary">
                {MOODS.map(m => <option key={m}>{m}</option>)}
              </select>
            )}

            {mode !== 'drums' && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Bars:</span>
                {[1,2,4].map(b => (
                  <button key={b} onClick={() => setBars(b)}
                    className={cn('w-6 h-6 rounded text-xs transition-colors border',
                      bars === b ? 'bg-primary/20 text-primary border-primary/40' : 'text-muted-foreground border-border/50 hover:text-foreground')}>
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}

          {/* Pending result preview — accept or reject before applying */}
          {pendingResult && (
            <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-primary/8 border border-primary/25">
              <div className="flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-primary font-medium leading-snug">{pendingResult.description}</p>
                  {pendingResult.notes && (
                    <p className="text-xs text-primary/60 mt-0.5">{pendingResult.notes.length} notes ready to insert</p>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={handleAccept}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-primary text-white hover:bg-primary/80 transition-colors"
                >
                  <Check className="w-3 h-3" /> Insert
                </button>
                {mode !== 'drums' && clip && clip.notes.length > 0 && (
                  <button
                    onClick={handleAcceptReplace}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-muted/50 border border-border text-foreground hover:bg-muted/70 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" /> Replace
                  </button>
                )}
                <button
                  onClick={rejectPending}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-auto"
                >
                  <X className="w-3 h-3" /> Discard
                </button>
              </div>
            </div>
          )}

          {/* Generate button — only shown when no pending result */}
          {!pendingResult && (
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary/80 transition-colors disabled:opacity-50"
            >
              {isGenerating
                ? <><RefreshCw className="w-3 h-3 animate-spin" /> Generating…</>
                : <><Sparkles className="w-3 h-3" /> Generate</>
              }
            </button>
          )}

          {/* Re-generate when pending */}
          {pendingResult && (
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('w-3 h-3', isGenerating && 'animate-spin')} />
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  )
}
