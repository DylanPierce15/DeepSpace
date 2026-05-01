/**
 * useToneEngine — multi-track audio engine (Tone.js + Tone.Sampler via CDN).
 *
 * Each track gets its own isolated signal chain:
 *
 *   PolySynth (no soundfont):
 *     PolySynth → Filter → Reverb → Delay → Gain(volume) → Panner(pan) → masterVol
 *
 *   Soundfont (instrument.soundfont set):
 *     soundfont-player → sfBridge(Gain) → Reverb → Delay → Gain(volume) → Panner(pan) → masterVol
 *     soundfont-player outputs to sfBridge's underlying native GainNode so the Tone
 *     signal chain handles all FX and routing from that point on.
 *
 *   Drums:
 *     kick/snare/hihat/openhat → Gain(volume) → Panner(pan) → masterVol
 *
 *   Sample:
 *     Player → Gain(volume) → Panner(pan) → masterVol
 *
 * Soundfont loading
 * ─────────────────
 * soundfont-player is loaded from CDN alongside Tone.js. Instrument samples load
 * lazily when a track first uses a soundfont instrument (or when it changes). While
 * loading, the track plays nothing. A custom DOM event ("soundfont-status") notifies
 * InstrumentPanel to show a loading indicator.
 *
 * Race-condition safety
 * ─────────────────────
 * 1. node.disposed guard in every scheduler touch — skip silently if disposed.
 * 2. try/catch wraps around every node disposal — a double-dispose is a no-op.
 * 3. toneRef nulled in cleanup — prevents the state.tracks effect from calling
 *    syncNodes after the main effect has torn everything down.
 * 4. syncNodes bails on disposed nodes — recreates them on the next call.
 * 5. cancelRef guards all async soundfont callbacks against post-unmount updates.
 * 6. instrumentName guard in soundfont callbacks prevents stale loads from landing.
 */

import { useEffect, useRef, useCallback } from 'react'
import { useStudio } from './useStudio'
import { DRUM_ROWS, TOTAL_STEPS, getInstrumentSource } from '../constants'

/* eslint-disable @typescript-eslint/no-explicit-any */
type ToneModule = any
declare global {
  interface Window { Tone: ToneModule }
}

const TONE_CDN = 'https://cdn.jsdelivr.net/npm/tone@14/build/Tone.js'

// ── CDN loaders ───────────────────────────────────────────────────────────────

function ensureTone(): Promise<ToneModule> {
  if (window.Tone) return Promise.resolve(window.Tone)
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[data-tone-cdn]')) {
      const poll = setInterval(() => { if (window.Tone) { clearInterval(poll); resolve(window.Tone) } }, 50)
      return
    }
    const s = document.createElement('script')
    s.src = TONE_CDN
    s.setAttribute('data-tone-cdn', 'true')
    s.onload  = () => resolve(window.Tone)
    s.onerror = () => reject(new Error('Failed to load Tone.js from CDN'))
    document.head.appendChild(s)
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Safely dispose a Tone node — swallows double-dispose errors. */
function safeDispose(node: any) {
  try { node?.dispose() } catch { /* already disposed */ }
}

/** True if the node exists AND has not been disposed. */
function alive(node: any): boolean {
  return !!node && !node.disposed
}

/** Convert MIDI note number to soundfont-player note name (e.g. 60 → 'C4', 61 → 'C#4'). */
function midiToNoteName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const octave = Math.floor(midi / 12) - 1
  return names[midi % 12] + octave
}

/** Fire a UI status event so InstrumentPanel can show loading state. */
function emitSfStatus(trackId: string, status: 'loading' | 'ready' | 'error') {
  window.dispatchEvent(new CustomEvent('soundfont-status', { detail: { trackId, status } }))
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useToneEngine() {
  const ctx = useStudio()
  const { state, dispatch, masterVolRef, previewNoteRef, previewDrumRef } = ctx
  const analyserRef = (ctx as any).analyserRef as React.MutableRefObject<any> | undefined

  const toneRef       = useRef<ToneModule>(null)
  const tracksRef     = useRef(state.tracks)
  const activeIdRef   = useRef(state.activeTrackId)
  const isPlayingRef  = useRef(state.isPlaying)
  const stepRef       = useRef(0)
  const scheduleIdRef = useRef<number | null>(null)
  const cancelRef     = useRef(false)   // guards async sampler onload/onerror callbacks

  // Per-track node maps
  const synthNodesMap  = useRef(new Map<string, any>())  // {synth, filter, reverb, delay, gain, pan}
  const drumNodesMap   = useRef(new Map<string, any>())  // {kick, snare, ...drum synths, reverb, delay, gain, pan}
  const sampleNodesMap = useRef(new Map<string, any>())  // {player, gain, pan}
  const samplersMap    = useRef(new Map<string, any>())  // {sampler, reverb, delay, gain, pan, instrumentName}

  useEffect(() => { tracksRef.current  = state.tracks },      [state.tracks])
  useEffect(() => { activeIdRef.current = state.activeTrackId }, [state.activeTrackId])
  useEffect(() => { isPlayingRef.current = state.isPlaying },  [state.isPlaying])

  // ── syncNodes ─────────────────────────────────────────────────────────────
  const syncNodes = useCallback((Tone: ToneModule, tracks?: any[]) => {
    const vol = masterVolRef.current
    if (!vol || vol.disposed) return

    const resolvedTracks = tracks ?? tracksRef.current
    const liveIds = new Set(resolvedTracks.map((t: any) => t.id))

    // ── Remove nodes for deleted tracks ──────────────────────────────────
    synthNodesMap.current.forEach((n, id) => {
      if (!liveIds.has(id)) {
        safeDispose(n.synth); safeDispose(n.filter); safeDispose(n.reverb)
        safeDispose(n.delay); safeDispose(n.gain); safeDispose(n.pan)
        synthNodesMap.current.delete(id)
      }
    })
    drumNodesMap.current.forEach((n, id) => {
      if (!liveIds.has(id)) {
        safeDispose(n.kick); safeDispose(n.kickFilter); safeDispose(n.snare); safeDispose(n.snareFx)
        safeDispose(n.hihat); safeDispose(n.hihatFx)
        safeDispose(n.openhat); safeDispose(n.openhatFx)
        safeDispose(n.clap); safeDispose(n.clapFx); safeDispose(n.clapBP)
        safeDispose(n.perc); safeDispose(n.percFilter)
        safeDispose(n.tom)
        safeDispose(n.shaker); safeDispose(n.shakerFx)
        safeDispose(n.reverb); safeDispose(n.delay)
        safeDispose(n.gain); safeDispose(n.pan)
        drumNodesMap.current.delete(id)
      }
    })
    sampleNodesMap.current.forEach((n, id) => {
      if (!liveIds.has(id)) {
        safeDispose(n.player); safeDispose(n.gain); safeDispose(n.pan)
        sampleNodesMap.current.delete(id)
      }
    })
    samplersMap.current.forEach((n, id) => {
      if (!liveIds.has(id)) {
        safeDispose(n.sampler); safeDispose(n.boost); safeDispose(n.reverb); safeDispose(n.delay)
        safeDispose(n.gain); safeDispose(n.pan)
        samplersMap.current.delete(id)
      }
    })

    // ── Create or update each track's nodes ───────────────────────────────
    resolvedTracks.forEach((track: any) => {

      // ── Synth track ───────────────────────────────────────────────────
      if (track.type === 'synth') {
        const sfName = track.instrument.soundfont as string | undefined

        if (sfName) {
          // ── SAMPLER MODE (Tone.Sampler — Salamander or MusyngKite via jsDelivr) ──
          // If track was previously in PolySynth mode, clean up those nodes
          const existingSynth = synthNodesMap.current.get(track.id)
          if (existingSynth) {
            safeDispose(existingSynth.synth); safeDispose(existingSynth.filter)
            safeDispose(existingSynth.reverb); safeDispose(existingSynth.delay)
            safeDispose(existingSynth.gain); safeDispose(existingSynth.pan)
            synthNodesMap.current.delete(track.id)
          }

          // If the instrument changed, tear down old sampler nodes
          const existingSampler = samplersMap.current.get(track.id)
          if (existingSampler && existingSampler.instrumentName !== sfName) {
            safeDispose(existingSampler.sampler); safeDispose(existingSampler.boost); safeDispose(existingSampler.reverb)
            safeDispose(existingSampler.delay); safeDispose(existingSampler.gain); safeDispose(existingSampler.pan)
            samplersMap.current.delete(track.id)
          }

          if (!samplersMap.current.has(track.id)) {
            // Check if we have sample data for this instrument
            const source = getInstrumentSource(sfName)

            if (!source) {
              // No sample source for this GM id (e.g. choir, pads) — use PolySynth silently.
              // Clear the soundfont setting so the engine routes to PolySynth below.
              // (We don't mutate track state here; the UI "Ready" state won't show,
              //  and InstrumentPanel's oscillator/ADSR controls will still be visible.)
              emitSfStatus(track.id, 'error')
              // Fall through: sfName is truthy but we skip creating a sampler,
              // so the scheduler will use PolySynth via synthNodesMap if it exists.
              // Ensure PolySynth nodes are created for this track on the next pass.
            } else {
              // Build Tone signal chain: Sampler → Reverb → Delay → Gain → Panner → masterVol
              const pan    = new Tone.Panner(track.pan).connect(vol)
              const gain   = new Tone.Gain(track.volume).connect(pan)
              const delay  = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.35, wet: track.instrument.fxDelay  ?? 0 }).connect(gain)
              const reverb = new Tone.Reverb({ decay: 2.5, wet: track.instrument.fxReverb ?? 0 }).connect(delay)

              const trackId   = track.id
              const sfNameCap = sfName

              const boost = new Tone.Volume(source.boostDb).connect(reverb)

              const sampler = new Tone.Sampler({
                urls:    source.urls,
                baseUrl: source.baseUrl,
                release: 1,
                onload: () => {
                  if (cancelRef.current) return
                  const entry = samplersMap.current.get(trackId)
                  if (entry && entry.instrumentName === sfNameCap) emitSfStatus(trackId, 'ready')
                },
                onerror: () => {
                  if (cancelRef.current) return
                  const entry = samplersMap.current.get(trackId)
                  if (entry && entry.instrumentName === sfNameCap) {
                    // Remove broken sampler so scheduler falls through to PolySynth
                    safeDispose(entry.sampler); safeDispose(entry.boost); safeDispose(entry.reverb)
                    safeDispose(entry.delay);   safeDispose(entry.gain); safeDispose(entry.pan)
                    samplersMap.current.delete(trackId)
                    emitSfStatus(trackId, 'error')
                  }
                },
              }).connect(boost)

              samplersMap.current.set(track.id, { sampler, boost, reverb, delay, gain, pan, instrumentName: sfName })
              emitSfStatus(track.id, 'loading')
            }
          } else {
            // Update volume / pan / FX on existing sampler entry
            const n = samplersMap.current.get(track.id)!
            try {
              n.gain.gain.value = track.volume
              n.pan.pan.value   = track.pan
              if (n.reverb) n.reverb.wet.value = track.instrument.fxReverb ?? 0
              if (n.delay)  n.delay.wet.value  = track.instrument.fxDelay  ?? 0
            } catch { /* node disposed mid-update */ }
          }

        } else {
          // ── POLYSYNTH MODE ────────────────────────────────────────────
          // If track was previously in sampler mode, clean up those nodes
          const existingSampler = samplersMap.current.get(track.id)
          if (existingSampler) {
            safeDispose(existingSampler.sampler); safeDispose(existingSampler.boost); safeDispose(existingSampler.reverb)
            safeDispose(existingSampler.delay); safeDispose(existingSampler.gain); safeDispose(existingSampler.pan)
            samplersMap.current.delete(track.id)
          }

          const existing = synthNodesMap.current.get(track.id)
          if (existing && !alive(existing.synth)) {
            safeDispose(existing.filter); safeDispose(existing.reverb)
            safeDispose(existing.delay);  safeDispose(existing.gain); safeDispose(existing.pan)
            synthNodesMap.current.delete(track.id)
          }

          if (!synthNodesMap.current.has(track.id)) {
            const pan    = new Tone.Panner(track.pan).connect(vol)
            const gain   = new Tone.Gain(track.volume).connect(pan)
            const delay  = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.35, wet: track.instrument.fxDelay  ?? 0 }).connect(gain)
            const reverb = new Tone.Reverb({ decay: 2.5, wet: track.instrument.fxReverb ?? 0 }).connect(delay)
            const filter = new Tone.Filter({ type: 'lowpass', frequency: track.instrument.filterFreq, Q: track.instrument.filterRes }).connect(reverb)
            const synth  = new Tone.PolySynth(Tone.Synth, {
              oscillator: { type: track.instrument.oscillator },
              envelope:   { attack: track.instrument.attack, decay: track.instrument.decay, sustain: track.instrument.sustain, release: track.instrument.release },
            }).connect(filter)
            synthNodesMap.current.set(track.id, { synth, filter, reverb, delay, gain, pan })
          } else {
            const n = synthNodesMap.current.get(track.id)!
            if (!alive(n.synth)) return
            try {
              n.gain.gain.value        = track.volume
              n.pan.pan.value          = track.pan
              n.filter.frequency.value = track.instrument.filterFreq
              n.filter.Q.value         = track.instrument.filterRes
              if (n.reverb) n.reverb.wet.value = track.instrument.fxReverb ?? 0
              if (n.delay)  n.delay.wet.value  = track.instrument.fxDelay  ?? 0
              n.synth.set({
                oscillator: { type: track.instrument.oscillator },
                envelope:   { attack: track.instrument.attack, decay: track.instrument.decay, sustain: track.instrument.sustain, release: track.instrument.release },
              })
            } catch { /* node disposed mid-update */ }
          }
        }
      }

      // ── Drum track ────────────────────────────────────────────────────
      if (track.type === 'drums') {
        const existing = drumNodesMap.current.get(track.id)
        if (existing && !alive(existing.kick)) {
          safeDispose(existing.kickFilter); safeDispose(existing.snare); safeDispose(existing.snareFx)
          safeDispose(existing.hihat); safeDispose(existing.hihatFx)
          safeDispose(existing.openhat); safeDispose(existing.openhatFx)
          safeDispose(existing.clap); safeDispose(existing.clapFx); safeDispose(existing.clapBP)
          safeDispose(existing.perc); safeDispose(existing.percFilter)
          safeDispose(existing.tom)
          safeDispose(existing.shaker); safeDispose(existing.shakerFx)
          safeDispose(existing.reverb); safeDispose(existing.delay)
          safeDispose(existing.gain); safeDispose(existing.pan)
          drumNodesMap.current.delete(track.id)
        }

        if (!drumNodesMap.current.has(track.id)) {
          const pan    = new Tone.Panner(track.pan).connect(vol)
          const gain   = new Tone.Gain(track.volume).connect(pan)
          const delay  = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.35, wet: track.instrument.fxDelay  ?? 0 }).connect(gain)
          const reverb = new Tone.Reverb({ decay: 2.0, wet: track.instrument.fxReverb ?? 0 }).connect(delay)

          const kickFilter = new Tone.Filter({ type: 'lowpass', frequency: 200, Q: 0.7 }).connect(reverb)
          const kick = new Tone.MembraneSynth({
            pitchDecay: 0.05, octaves: 10, volume: 8,
            envelope: { attack: 0.001, decay: 0.42, sustain: 0, release: 0.15 },
          }).connect(kickFilter)

          const snareFx = new Tone.Filter({ type: 'highpass', frequency: 250, Q: 0.8 }).connect(reverb)
          const snare   = new Tone.NoiseSynth({
            noise: { type: 'white' }, envelope: { attack: 0.003, decay: 0.15, sustain: 0, release: 0.04 }, volume: 6,
          }).connect(snareFx)

          const hihatFx = new Tone.Filter({ type: 'highpass', frequency: 10000, Q: 3.0 }).connect(reverb)
          const hihat   = new Tone.NoiseSynth({
            noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.038, sustain: 0, release: 0.008 }, volume: 0,
          }).connect(hihatFx)

          const openhatFx = new Tone.Filter({ type: 'highpass', frequency: 7800, Q: 1.8 }).connect(reverb)
          const openhat   = new Tone.NoiseSynth({
            noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.4, sustain: 0.06, release: 0.25 }, volume: -1,
          }).connect(openhatFx)

          const clapBP = new Tone.Filter({ type: 'bandpass', frequency: 2800, Q: 1.2 }).connect(reverb)
          const clapFx = new Tone.Filter({ type: 'highpass', frequency: 1200, Q: 0.6 }).connect(clapBP)
          const clap   = new Tone.NoiseSynth({
            noise: { type: 'white' }, envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.04 }, volume: 4,
          }).connect(clapFx)

          const percFilter = new Tone.Filter({ type: 'bandpass', frequency: 900, Q: 4 }).connect(reverb)
          const perc = new Tone.Synth({
            oscillator: { type: 'triangle' }, volume: 4,
            envelope:   { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
          }).connect(percFilter)

          const tom = new Tone.MembraneSynth({
            pitchDecay: 0.05, octaves: 7, volume: 6,
            envelope:   { attack: 0.001, decay: 0.28, sustain: 0, release: 0.12 },
          }).connect(reverb)

          const shakerFx = new Tone.Filter({ type: 'highpass', frequency: 5500, Q: 0.6 }).connect(reverb)
          const shaker   = new Tone.NoiseSynth({
            noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.032, sustain: 0, release: 0.012 }, volume: -3,
          }).connect(shakerFx)

          drumNodesMap.current.set(track.id, {
            kick, kickFilter, snare, snareFx, hihat, hihatFx, openhat, openhatFx,
            clap, clapFx, clapBP, perc, percFilter, tom, shaker, shakerFx,
            reverb, delay, gain, pan,
          })
        } else {
          const n = drumNodesMap.current.get(track.id)!
          if (!alive(n.kick)) return
          try {
            n.gain.gain.value = track.volume
            n.pan.pan.value   = track.pan
            if (n.reverb) n.reverb.wet.value = track.instrument.fxReverb ?? 0
            if (n.delay)  n.delay.wet.value  = track.instrument.fxDelay  ?? 0
          } catch { /* disposed mid-update */ }
        }
      }

      // ── Sample track ──────────────────────────────────────────────────
      if (track.type === 'sample' && track.sampleUrl) {
        if (!sampleNodesMap.current.has(track.id)) {
          const pan    = new Tone.Panner(track.pan).connect(vol)
          const gain   = new Tone.Gain(track.volume).connect(pan)
          const player = new Tone.Player({ url: track.sampleUrl, loop: false }).connect(gain)
          sampleNodesMap.current.set(track.id, { player, gain, pan, url: track.sampleUrl })
        } else {
          const n = sampleNodesMap.current.get(track.id)!
          if (!alive(n.player)) return
          try {
            n.gain.gain.value = track.volume
            n.pan.pan.value   = track.pan
            if (n.url !== track.sampleUrl) { n.url = track.sampleUrl; n.player.load(track.sampleUrl) }
          } catch { /* disposed mid-update */ }
        }
      }
    })

    // ── Update preview callbacks ──────────────────────────────────────────
    previewNoteRef.current = (midi: number, duration?: number) => {
      Tone.start().then(() => {
        const id          = activeIdRef.current
        const activeTrack = tracksRef.current.find((t: any) => t.id === id && t.type === 'synth')
                         ?? tracksRef.current.find((t: any) => t.type === 'synth')
        if (!activeTrack) return

        const sfEntry = samplersMap.current.get(activeTrack.id)
        if (sfEntry?.sampler?.loaded) {
          try {
            const noteName = midiToNoteName(midi)
            const durSecs  = duration != null
              ? Tone.Time('16n').toSeconds() * duration
              : Tone.Time('8n').toSeconds()
            sfEntry.sampler.triggerAttackRelease(noteName, durSecs)
          } catch { /* out of range or disposed */ }
        } else {
          const nodes = (id ? synthNodesMap.current.get(id) : null) ?? [...synthNodesMap.current.values()][0]
          if (!nodes || !alive(nodes.synth)) return
          try {
            const freq    = Tone.Frequency(midi, 'midi').toFrequency()
            const durSecs = duration != null
              ? Tone.Time('16n').toSeconds() * duration
              : Tone.Time('8n').toSeconds()
            nodes.synth.triggerAttackRelease(freq, durSecs)
          } catch { /* range or disposed */ }
        }
      })
    }

    previewDrumRef.current = (drumId: string) => {
      Tone.start().then(() => {
        const id    = activeIdRef.current
        const nodes = (id ? drumNodesMap.current.get(id) : null) ?? [...drumNodesMap.current.values()][0]
        if (!nodes || !alive(nodes.kick)) return
        try {
          switch (drumId) {
            case 'kick':    nodes.kick.triggerAttackRelease('C2', '8n'); break
            case 'snare':   nodes.snare.triggerAttackRelease('8n'); break
            case 'clap':    nodes.clap?.triggerAttackRelease('8n'); break
            case 'hihat':   nodes.hihat.triggerAttackRelease('32n'); break
            case 'openhat': nodes.openhat.triggerAttackRelease('8n'); break
            case 'perc':    nodes.perc?.triggerAttackRelease('G3', '16n'); break
            case 'tom':     nodes.tom?.triggerAttackRelease('E2', '16n'); break
            case 'shaker':  nodes.shaker?.triggerAttackRelease('32n'); break
          }
        } catch { /* disposed */ }
      })
    }
  }, [masterVolRef, previewNoteRef, previewDrumRef])

  // Re-sync whenever tracks change — pass state.tracks directly to avoid stale ref
  useEffect(() => {
    if (toneRef.current && masterVolRef.current && !masterVolRef.current.disposed) {
      syncNodes(toneRef.current, state.tracks)
    }
  }, [state.tracks, syncNodes, masterVolRef])

  // ── Main setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    cancelRef.current = false

    // Load Tone.js — samples load lazily per-track via Tone.Sampler when instruments are selected
    ensureTone().then((Tone) => {
      if (cancelRef.current) return
      toneRef.current = Tone

      const vol = new Tone.Volume(-2).toDestination()
      masterVolRef.current = vol

      try {
        if (analyserRef) {
          const analyser = new Tone.Analyser({ type: 'waveform', size: 512 })
          vol.connect(analyser)
          analyserRef.current = analyser
        }
      } catch { /* Analyser unavailable */ }

      syncNodes(Tone, tracksRef.current)

      scheduleIdRef.current = Tone.getTransport().scheduleRepeat((time: number) => {
        const step = stepRef.current
        stepRef.current = (step + 1) % TOTAL_STEPS
        dispatch({ type: 'SET_STEP', step })

        const tracks  = tracksRef.current
        const hasSolo = tracks.some((t: any) => t.soloed)

        tracks.forEach((track: any) => {
          if (track.muted) return
          if (hasSolo && !track.soloed) return

          // ── Synth (Tone.Sampler or PolySynth) ───────────────────────
          if (track.type === 'synth') {
            const sfEntry   = samplersMap.current.get(track.id)
            const sfReady   = sfEntry?.sampler?.loaded === true
            const polyNodes = synthNodesMap.current.get(track.id)

            // Skip if neither audio source is ready
            if (!sfReady && (!polyNodes || !alive(polyNodes.synth))) return

            const bar       = Math.floor(step / 16)
            const stepInBar = step % 16

            // Unified note trigger — routes to Sampler or PolySynth
            const fireNote = (note: any) => {
              if (sfReady) {
                try {
                  const noteName = midiToNoteName(note.midi)
                  const durSecs  = Tone.Time('16n').toSeconds() * note.duration
                  sfEntry!.sampler.triggerAttackRelease(noteName, durSecs > 0 ? durSecs : '8n', time, note.velocity ?? 0.8)
                } catch { /* out of range or disposed */ }
              } else if (polyNodes && alive(polyNodes.synth)) {
                try {
                  const freq = Tone.Frequency(note.midi, 'midi').toFrequency()
                  const dur  = Tone.Time('16n').toSeconds() * note.duration
                  polyNodes.synth.triggerAttackRelease(freq, dur, time, note.velocity)
                } catch { /* disposed or out of range */ }
              }
            }

            if (track.clips?.length) {
              track.clips.forEach((clip: any) => {
                if (bar < clip.startBar || bar >= clip.startBar + clip.lengthBars) return
                const localStep = (bar - clip.startBar) * 16 + stepInBar
                clip.notes.forEach((note: any) => {
                  if (note.step !== localStep) return
                  fireNote(note)
                })
              })
            } else {
              track.notes?.forEach((note: any) => {
                if (note.step !== step) return
                fireNote(note)
              })
            }
          }

          // ── Drums (clip-based + legacy fallback) ────────────────────
          if (track.type === 'drums') {
            const nodes = drumNodesMap.current.get(track.id)
            if (!nodes || !alive(nodes.kick)) return

            const bar       = Math.floor(step / 16)
            const stepInBar = step % 16
            const drumVels  = track.drumVelocities

            const triggerRow = (rowId: string, rowIdx: number, stepIdx: number) => {
              const vel = drumVels?.[rowIdx]?.[stepIdx] ?? 0.8
              try {
                switch (rowId) {
                  case 'kick':    nodes.kick.triggerAttackRelease('C2', '8n', time, vel); break
                  case 'snare':   nodes.snare.triggerAttackRelease('8n', time, vel); break
                  case 'clap':    nodes.clap?.triggerAttackRelease('8n', time, vel); break
                  case 'hihat':   nodes.hihat.triggerAttackRelease('32n', time, vel); break
                  case 'openhat': nodes.openhat.triggerAttackRelease('8n', time, vel); break
                  case 'perc':    nodes.perc?.triggerAttackRelease('G3', '16n', time, vel); break
                  case 'tom':     nodes.tom?.triggerAttackRelease('E2', '16n', time, vel); break
                  case 'shaker':  nodes.shaker?.triggerAttackRelease('32n', time, vel); break
                }
              } catch { /* disposed */ }
            }

            if (track.drumClips?.length) {
              track.drumClips.forEach((clip: any) => {
                if (bar < clip.startBar || bar >= clip.startBar + clip.lengthBars) return
                DRUM_ROWS.forEach((row: any, rowIdx: number) => {
                  if (clip.pattern[rowIdx]?.[stepInBar]) triggerRow(row.id, rowIdx, stepInBar)
                })
              })
            } else if (track.pattern) {
              DRUM_ROWS.forEach((row: any, rowIdx: number) => {
                if (track.pattern[rowIdx]?.[stepInBar]) triggerRow(row.id, rowIdx, stepInBar)
              })
            }
          }

          // ── Sample ───────────────────────────────────────────────────
          if (track.type === 'sample' && step === 0) {
            const nodes = sampleNodesMap.current.get(track.id)
            if (!nodes || !alive(nodes.player)) return
            try { if (nodes.player.loaded) nodes.player.start(time) } catch { /* already playing */ }
          }
        })
      }, '16n')

      // If play was clicked before Tone.js finished loading, start transport now
      if (isPlayingRef.current) {
        Tone.start().then(() => Tone.getTransport().start())
      }
    }).catch(err => console.error('[useToneEngine] CDN load failed:', err))

    return () => {
      cancelRef.current = true
      toneRef.current   = null
      previewNoteRef.current = () => {}
      previewDrumRef.current = () => {}

      const Tone = window.Tone
      if (!Tone) return
      if (scheduleIdRef.current !== null) { try { Tone.getTransport().clear(scheduleIdRef.current) } catch {} }
      try { Tone.getTransport().stop() } catch {}

      synthNodesMap.current.forEach(n => {
        safeDispose(n.synth); safeDispose(n.filter); safeDispose(n.reverb)
        safeDispose(n.delay); safeDispose(n.gain);   safeDispose(n.pan)
      })
      drumNodesMap.current.forEach(n => {
        safeDispose(n.kick); safeDispose(n.kickFilter); safeDispose(n.snare); safeDispose(n.snareFx)
        safeDispose(n.hihat); safeDispose(n.hihatFx); safeDispose(n.openhat); safeDispose(n.openhatFx)
        safeDispose(n.clap); safeDispose(n.clapFx); safeDispose(n.clapBP)
        safeDispose(n.perc); safeDispose(n.percFilter)
        safeDispose(n.tom); safeDispose(n.shaker); safeDispose(n.shakerFx)
        safeDispose(n.reverb); safeDispose(n.delay)
        safeDispose(n.gain); safeDispose(n.pan)
      })
      sampleNodesMap.current.forEach(n => { safeDispose(n.player); safeDispose(n.gain); safeDispose(n.pan) })
      samplersMap.current.forEach(n => {
        safeDispose(n.sampler); safeDispose(n.boost); safeDispose(n.reverb); safeDispose(n.delay)
        safeDispose(n.gain); safeDispose(n.pan)
      })
      synthNodesMap.current.clear()
      drumNodesMap.current.clear()
      sampleNodesMap.current.clear()
      samplersMap.current.clear()
      if (analyserRef) { safeDispose(analyserRef.current); analyserRef.current = null }
      safeDispose(masterVolRef.current)
      masterVolRef.current = null
    }
  }, [dispatch, masterVolRef, previewNoteRef, previewDrumRef, syncNodes])

  useEffect(() => {
    if (toneRef.current) toneRef.current.getTransport().bpm.value = state.bpm
  }, [state.bpm])

  useEffect(() => {
    const Tone = toneRef.current
    if (!Tone) return
    if (state.isPlaying) {
      Tone.start().then(() => Tone.getTransport().start())
    } else {
      try { Tone.getTransport().stop(); Tone.getTransport().position = 0 } catch {}
      stepRef.current = 0
    }
  }, [state.isPlaying])
}
