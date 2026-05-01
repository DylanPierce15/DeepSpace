/**
 * InstrumentPanel — synth instrument editor shown in the bottom panel.
 *
 * Two modes based on whether a soundfont instrument is selected:
 *
 *  SYNTHESIZER mode (instrument.soundfont is empty / undefined):
 *    Instrument picker → Oscillator → ADSR → Filter → FX → Preview
 *
 *  SOUNDFONT mode (instrument.soundfont is set):
 *    Instrument picker (with loading indicator) → FX → Preview
 *    Oscillator / ADSR / Filter are hidden — they don't apply to sampled instruments.
 *
 * Loading state is communicated via a "soundfont-status" CustomEvent fired by
 * useToneEngine whenever an instrument starts/finishes loading.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Play, Loader2, AlertCircle, RotateCcw } from 'lucide-react'
import { useStudio } from '../hooks/useStudio'
import type { SynthSettings } from '../constants'
import { SOUNDFONT_INSTRUMENTS } from '../constants'
import { cn, Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from './ui'

// Radix Select doesn't allow empty-string values, so we use a sentinel for the base synth
const SF_SYNTH_SENTINEL = '__synth__'
const toSelectValue  = (id: string | undefined) => id || SF_SYNTH_SENTINEL
const fromSelectValue = (v: string)              => v === SF_SYNTH_SENTINEL ? '' : v

// ── Soundfont instrument categories (for grouped <select>) ────────────────────
const SF_CATEGORIES = Array.from(new Set(SOUNDFONT_INSTRUMENTS.map(i => i.category)))

const DEFAULT_SYNTH_SETTINGS: Partial<SynthSettings> = {
  oscillator: 'sawtooth',
  filterFreq: 3000,
  filterRes:  0,
  attack:     0.01,
  decay:      0.1,
  sustain:    0.7,
  release:    0.3,
  fxReverb:   0,
  fxDelay:    0,
}

// ── Oscillator shapes ─────────────────────────────────────────────────────────
const OSCILLATORS: SynthSettings['oscillator'][] = ['sawtooth', 'square', 'triangle', 'sine']

const OSC_LABELS: Record<SynthSettings['oscillator'], string> = {
  sawtooth: 'SAW', square: 'SQR', triangle: 'TRI', sine: 'SIN',
}

const OSC_SHAPES: Record<SynthSettings['oscillator'], React.ReactNode> = {
  sawtooth: (
    <svg viewBox="0 0 32 16" className="w-8 h-4">
      <polyline points="2,14 16,2 16,14 30,2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  ),
  square: (
    <svg viewBox="0 0 32 16" className="w-8 h-4">
      <polyline points="2,14 2,2 16,2 16,14 30,14 30,2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  ),
  triangle: (
    <svg viewBox="0 0 32 16" className="w-8 h-4">
      <polyline points="2,14 9,2 16,14 23,2 30,14" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  ),
  sine: (
    <svg viewBox="0 0 32 16" className="w-8 h-4">
      <path d="M2,8 C6,2 10,2 14,8 C18,14 22,14 26,8 C28,5 30,4 30,8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  ),
}

// ── Slider ────────────────────────────────────────────────────────────────────

interface SliderProps {
  label:    string
  value:    number
  min:      number
  max:      number
  step:     number
  onChange: (v: number) => void
  format?:  (v: number) => string
  color?:   string
}

function Slider({ label, value, min, max, step, onChange, format, color }: SliderProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</span>
        <span className="text-xs font-mono text-foreground tabular-nums">
          {format ? format(value) : value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: color ?? 'var(--color-primary)' }}
      />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  trackId: string
}

type SfStatus = 'idle' | 'loading' | 'ready' | 'error'

export function InstrumentPanel({ trackId }: Props) {
  const { state, updateInstrument, previewNoteRef } = useStudio()
  const track = state.tracks.find(t => t.id === trackId)
  if (!track || track.type !== 'synth') return null

  const inst         = track.instrument
  const sfActive     = !!(inst.soundfont)
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Soundfont loading status ─────────────────────────────────────────────
  const [sfStatus, setSfStatus] = useState<SfStatus>(() => sfActive ? 'loading' : 'idle')

  // Listen for status events from useToneEngine
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail.trackId === trackId) {
        setSfStatus(detail.status as SfStatus)
      }
    }
    window.addEventListener('soundfont-status', handler)
    return () => window.removeEventListener('soundfont-status', handler)
  }, [trackId])

  // Reset status when soundfont changes or clears
  useEffect(() => {
    if (!sfActive) setSfStatus('idle')
    else setSfStatus('loading')  // optimistic — engine will fire the real status soon
  }, [inst.soundfont, sfActive])

  // ── Debounced preview ────────────────────────────────────────────────────
  const triggerPreview = useCallback(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(() => {
      previewNoteRef.current(60)
    }, 80)
  }, [previewNoteRef])

  const update = useCallback((settings: Partial<SynthSettings>) => {
    updateInstrument(trackId, settings)
    // Only trigger synth preview for non-soundfont param changes
    if (!settings.soundfont && !sfActive) triggerPreview()
  }, [trackId, updateInstrument, triggerPreview, sfActive])

  // ── Soundfont selector ───────────────────────────────────────────────────
  const handleSfChange = useCallback((raw: string) => {
    const id = fromSelectValue(raw)
    updateInstrument(trackId, { soundfont: id || undefined })
    if (!id) setTimeout(() => previewNoteRef.current(60), 80)
  }, [trackId, updateInstrument, previewNoteRef])

  return (
    <div className="flex gap-6 px-4 py-3 overflow-x-auto">

      {/* ── Sound (instrument picker) ──────────────────────────────────── */}
      <div className="shrink-0 min-w-[160px]">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Sound</p>
        <div className="flex flex-col gap-1.5">
          <Select value={toSelectValue(inst.soundfont)} onValueChange={handleSfChange}>
            <SelectTrigger className="w-full h-auto py-1.5 px-2 text-xs bg-card border-border/60 focus:ring-primary/20 focus:border-primary/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {SF_CATEGORIES.map(cat => {
                const items = SOUNDFONT_INSTRUMENTS.filter(i => i.category === cat)
                return (
                  <SelectGroup key={cat}>
                    <SelectLabel className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-primary">{cat}</SelectLabel>
                    {items.map(item => (
                      <SelectItem key={item.id || '__synth__'} value={toSelectValue(item.id)} className="text-xs py-1.5">
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )
              })}
            </SelectContent>
          </Select>

          {/* Loading / error state indicator */}
          {sfActive && sfStatus === 'loading' && (
            <div className="flex items-center gap-1.5 px-1">
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">Loading samples…</span>
            </div>
          )}
          {sfActive && sfStatus === 'error' && (
            <div className="flex items-center gap-1.5 px-1">
              <AlertCircle className="w-3 h-3 text-destructive shrink-0" />
              <span className="text-xs text-destructive">Failed to load</span>
            </div>
          )}
          {sfActive && sfStatus === 'ready' && (
            <div className="flex items-center gap-1.5 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-xs text-muted-foreground">Ready</span>
            </div>
          )}
        </div>
      </div>

      <div className="w-px bg-border/50 shrink-0" />

      {/* ── Oscillator — hidden in soundfont mode ──────────────────────── */}
      {!sfActive && (
        <>
          <div className="shrink-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Oscillator</p>
            <div className="flex gap-1.5">
              {OSCILLATORS.map(osc => (
                <button
                  key={osc}
                  onClick={() => update({ oscillator: osc })}
                  className={cn(
                    'flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg border transition-all',
                    inst.oscillator === osc
                      ? 'border-primary/60 bg-primary/10 text-primary'
                      : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
                  )}
                  title={osc}
                >
                  {OSC_SHAPES[osc]}
                  <span className="text-xs font-mono font-bold">{OSC_LABELS[osc]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="w-px bg-border/50 shrink-0" />

          {/* ── ADSR — hidden in soundfont mode ─────────────────────────── */}
          <div className="shrink-0 w-52">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Envelope</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Slider
                label="A"  value={inst.attack}  min={0.001} max={2}    step={0.001}
                format={v => `${(v * 1000).toFixed(0)}ms`}
                onChange={v => update({ attack: v })}
                color={track.color}
              />
              <Slider
                label="D"  value={inst.decay}   min={0.001} max={2}    step={0.001}
                format={v => `${(v * 1000).toFixed(0)}ms`}
                onChange={v => update({ decay: v })}
                color={track.color}
              />
              <Slider
                label="S"  value={inst.sustain} min={0}     max={1}    step={0.01}
                format={v => `${Math.round(v * 100)}%`}
                onChange={v => update({ sustain: v })}
                color={track.color}
              />
              <Slider
                label="R"  value={inst.release} min={0.01}  max={4}    step={0.01}
                format={v => `${(v * 1000).toFixed(0)}ms`}
                onChange={v => update({ release: v })}
                color={track.color}
              />
            </div>
          </div>

          <div className="w-px bg-border/50 shrink-0" />

          {/* ── Filter — hidden in soundfont mode ───────────────────────── */}
          <div className="shrink-0 w-44">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Filter</p>
            <div className="flex flex-col gap-2">
              <Slider
                label="Freq" value={inst.filterFreq} min={80} max={18000} step={10}
                format={v => v >= 1000 ? `${(v / 1000).toFixed(1)}kHz` : `${v.toFixed(0)}Hz`}
                onChange={v => update({ filterFreq: v })}
                color={track.color}
              />
              <Slider
                label="Res"  value={inst.filterRes}  min={0}  max={20}    step={0.1}
                format={v => v.toFixed(1)}
                onChange={v => update({ filterRes: v })}
                color={track.color}
              />
            </div>
          </div>

          <div className="w-px bg-border/50 shrink-0" />
        </>
      )}

      {/* ── FX — shown in both modes ───────────────────────────────────── */}
      <div className="shrink-0 w-40">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">FX</p>
        <div className="flex flex-col gap-2">
          <Slider
            label="Reverb" value={inst.fxReverb ?? 0} min={0} max={1}   step={0.01}
            format={v => `${Math.round(v * 100)}%`}
            onChange={v => update({ fxReverb: v })}
            color={track.color}
          />
          <Slider
            label="Delay"  value={inst.fxDelay  ?? 0} min={0} max={0.8} step={0.01}
            format={v => `${Math.round(v * 100)}%`}
            onChange={v => update({ fxDelay: v })}
            color={track.color}
          />
        </div>
      </div>

      {/* ── Preview + Reset buttons ─────────────────────────────────────── */}
      <div className="ml-auto mr-10 shrink-0 flex items-center gap-2">
        {!sfActive && (
          <button
            onClick={() => update(DEFAULT_SYNTH_SETTINGS)}
            className="flex flex-col items-center gap-1 p-3 rounded-xl border border-border hover:border-destructive/40 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
            title="Reset synth settings to defaults"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-xs font-medium">Reset</span>
          </button>
        )}
        <button
          onClick={() => previewNoteRef.current(60)}
          disabled={sfActive && sfStatus === 'loading'}
          className={cn(
            'flex flex-col items-center gap-1 p-3 rounded-xl border transition-all',
            sfActive && sfStatus === 'loading'
              ? 'border-border/30 text-muted-foreground/40 cursor-not-allowed'
              : 'border-border hover:border-primary/40 hover:bg-primary/10 text-muted-foreground hover:text-primary'
          )}
          title="Play preview note (Middle C)"
        >
          {sfActive && sfStatus === 'loading'
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Play className="w-4 h-4 fill-current" />
          }
          <span className="text-xs font-medium">Preview</span>
        </button>
      </div>
    </div>
  )
}
