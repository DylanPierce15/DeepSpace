import React, { useState, useRef, useCallback } from 'react'
import { Play, Square, RotateCcw, Save, FolderOpen, ZoomIn, ZoomOut, Download, Radio, Mic, Keyboard, Undo2, Redo2 } from 'lucide-react'
import { useStudio } from '../hooks/useStudio'
import { useToast } from './ui'
import { useProjects } from '../hooks/useProjects'
import { useAudioExport } from '../hooks/useAudioExport'
import { useMicRecorder } from '../hooks/useMicRecorder'
import { Visualizer } from './Visualizer'
import { MIN_BPM, MAX_BPM } from '../constants'
import { cn } from './ui'
import { useNavigate } from 'react-router-dom'

export function TransportBar() {
  const { state, play, stop, setBpm, dispatch, setTimelineZoom, toggleKeyboardMode, undo, redo } = useStudio()
  const { isPlaying, bpm, loopEnabled, projectName, timelineZoom, isDirty, keyboardMode, history, future } = state
  const { success: toastSuccess } = useToast()
  const { save, isSaving } = useProjects()
  const navigate = useNavigate()

  const { status: exportStatus, startRecording, stopRecording, downloadMp3, publish, isRecording } = useAudioExport()
  const { micStatus, requestMic, startRec, stopRec } = useMicRecorder()

  const [micModalOpen, setMicModalOpen] = useState(false)
  const [micName, setMicName]           = useState('Sample')
  const [showExport, setShowExport]     = useState(false)

  // ── Tap tempo ────────────────────────────────────────────────────────────
  const tapTimestamps = useRef<number[]>([])
  const tapResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [tapFlash, setTapFlash] = useState(false)

  const handleTap = useCallback(() => {
    const now = Date.now()
    tapTimestamps.current = [...tapTimestamps.current, now].slice(-8)

    // Flash animation
    setTapFlash(true)
    setTimeout(() => setTapFlash(false), 120)

    // Reset after 3 s of inactivity
    if (tapResetTimer.current) clearTimeout(tapResetTimer.current)
    tapResetTimer.current = setTimeout(() => { tapTimestamps.current = [] }, 3000)

    // Need at least 2 taps to compute BPM
    if (tapTimestamps.current.length < 2) return
    const intervals = tapTimestamps.current.slice(1).map((t, i) => t - tapTimestamps.current[i])
    const avgMs = intervals.reduce((s, v) => s + v, 0) / intervals.length
    const newBpm = Math.round(60000 / avgMs)
    if (newBpm >= MIN_BPM && newBpm <= MAX_BPM) setBpm(newBpm)
  }, [setBpm])

  const handleExportRecord = async () => {
    if (isRecording) {
      const blob = await stopRecording()
      stop()
      setShowExport(true)
    } else {
      startRecording()
      if (!isPlaying) play()
    }
  }

  const handleMicRecord = async () => {
    if (micStatus === 'idle') {
      await requestMic()
    } else if (micStatus === 'ready') {
      startRec()
    } else if (micStatus === 'recording') {
      await stopRec(micName)
      setMicModalOpen(false)
    }
  }

  return (
    <div id="tour-transport" className="flex items-center gap-2 px-3 py-1.5 bg-card border-b border-border h-12 shrink-0 flex-wrap">

      {/* Project name */}
      <input
        value={projectName}
        onChange={e => dispatch({ type: 'SET_PROJECT_NAME', name: e.target.value })}
        className="bg-transparent text-sm font-semibold text-foreground border-none outline-none w-36 truncate"
        placeholder="Untitled Project"
      />

      <div className="w-px h-5 bg-border" />

      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => { undo(); toastSuccess('Undone') }}
          disabled={history.length === 0}
          className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 disabled:opacity-25 transition-colors"
          title={`Undo (${history.length} available) · Ctrl+Z`}
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => { redo(); toastSuccess('Redone') }}
          disabled={future.length === 0}
          className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 disabled:opacity-25 transition-colors"
          title={`Redo (${future.length} available) · Ctrl+Shift+Z`}
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Play / Stop / Rewind */}
      <div className="flex items-center gap-1">
        <button
          onClick={isPlaying ? stop : play}
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
            isPlaying ? 'bg-destructive text-white hover:bg-destructive/80' : 'bg-primary text-white hover:bg-primary/80'
          )}
          title={isPlaying ? 'Stop' : 'Play'}
        >
          {isPlaying ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
        </button>
        <button
          onClick={stop}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          title="Stop & Rewind"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-px h-5 bg-border" />

      {/* BPM */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">BPM</span>
        <button onClick={() => setBpm(Math.max(MIN_BPM, bpm - 1))} className="w-5 h-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 flex items-center justify-center text-sm transition-colors">−</button>
        <input
          type="number" value={bpm} min={MIN_BPM} max={MAX_BPM}
          onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= MIN_BPM && v <= MAX_BPM) setBpm(v) }}
          className="w-12 text-center bg-muted/40 border border-border rounded text-xs font-mono font-bold text-foreground outline-none focus:border-primary px-1 py-0.5"
        />
        <button onClick={() => setBpm(Math.min(MAX_BPM, bpm + 1))} className="w-5 h-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 flex items-center justify-center text-sm transition-colors">+</button>
        <button
          onClick={handleTap}
          title="Tap Tempo — tap 4+ times to set BPM"
          className={cn(
            'px-2 py-0.5 rounded text-xs font-bold transition-all border ml-0.5',
            tapFlash
              ? 'bg-primary text-white border-primary scale-105'
              : 'text-muted-foreground border-border/60 hover:text-foreground hover:border-border'
          )}
        >
          TAP
        </button>
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Loop */}
      <button
        onClick={() => dispatch({ type: 'TOGGLE_LOOP' })}
        className={cn('px-2 py-0.5 rounded text-xs font-medium transition-colors border', loopEnabled ? 'bg-primary/20 text-primary border-primary/40' : 'text-muted-foreground border-border hover:text-foreground')}
      >LOOP</button>

      <div className="w-px h-5 bg-border" />

      {/* Timeline zoom */}
      <div className="flex items-center gap-1">
        <button onClick={() => setTimelineZoom(timelineZoom === 4 ? 4 : timelineZoom === 2 ? 4 : 2)}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors" title="Zoom in">
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs text-muted-foreground font-mono w-7 text-center">{timelineZoom}×</span>
        <button onClick={() => setTimelineZoom(timelineZoom === 1 ? 1 : timelineZoom === 2 ? 1 : 2)}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors" title="Zoom out">
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2">

        {/* Mini waveform visualizer */}
        <div className="hidden md:block opacity-70">
          <Visualizer width={120} height={24} mode="waveform" />
        </div>

        {/* Step counter */}
        <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
          {String(Math.floor(state.currentStep / 16) + 1).padStart(2, '0')}:{String((state.currentStep % 16) + 1).padStart(2, '0')}
        </span>
        {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" title="Unsaved changes" />}

        {/* Keyboard mode toggle + contextual tooltip */}
        <div className="relative group">
          <button
            onClick={toggleKeyboardMode}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors border',
              keyboardMode
                ? 'bg-primary/20 text-primary border-primary/40'
                : 'text-muted-foreground border-border hover:text-foreground hover:border-border-strong'
            )}
            title="QWERTY keyboard → play notes on active synth track"
          >
            <Keyboard className="w-3 h-3" />
            <span className="hidden sm:inline">Keys</span>
            {keyboardMode && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary ml-0.5 animate-pulse shrink-0" />
            )}
          </button>

          {/* Key-map popover — appears on hover */}
          <div className={cn(
            'absolute right-0 top-full mt-2 z-50 w-56 p-3 rounded-xl border shadow-card pointer-events-none',
            'bg-card border-border opacity-0 group-hover:opacity-100 transition-opacity duration-150',
          )}>
            <p className="text-xs font-bold text-foreground mb-2">
              {keyboardMode ? '⌨️ Keys mode ON' : '⌨️ Keys mode (hover to see)'}
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              QWERTY plays the active synth track in real time. White keys:
            </p>
            <div className="grid grid-cols-7 gap-0.5 mb-1.5">
              {[['A','C'],['S','D'],['D','E'],['F','F'],['G','G'],['H','A'],['J','B']].map(([key, note]) => (
                <div key={key} className="flex flex-col items-center gap-0.5">
                  <div className="w-6 h-6 rounded-md bg-muted/60 border border-border flex items-center justify-center text-xs font-bold text-foreground">{key}</div>
                  <span className="text-xs font-medium text-primary">{note}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-0.5">
              {[['W','C#'],['E','D#'],['T','F#'],['Y','G#'],['U','A#']].map(([key, note]) => (
                <div key={key} className="flex flex-col items-center gap-0.5">
                  <div className="w-6 h-6 rounded-md bg-foreground/80 border border-border/50 flex items-center justify-center text-xs font-bold text-background">{key}</div>
                  <span className="text-xs font-medium text-muted-foreground">{note}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Z/X to shift octave down/up</p>
          </div>
        </div>

        {/* Mic record */}
        <button
          onClick={() => { setMicModalOpen(true); if (micStatus === 'idle') requestMic() }}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors border',
            micStatus === 'recording'
              ? 'bg-destructive/20 text-destructive border-destructive/40 animate-pulse'
              : 'text-muted-foreground border-border hover:text-foreground hover:border-border-strong'
          )}
          title="Record from microphone"
        >
          <Mic className="w-3 h-3" />
          {micStatus === 'recording' ? 'Stop' : 'Mic'}
        </button>

        {/* Export record */}
        <div className="relative">
          <button
            id="tour-export"
            onClick={handleExportRecord}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors border',
              isRecording
                ? 'bg-destructive/20 text-destructive border-destructive/40 animate-pulse'
                : 'text-muted-foreground border-border hover:text-foreground hover:border-border-strong'
            )}
            title={isRecording ? 'Stop recording' : 'Record audio'}
          >
            <Radio className="w-3 h-3" />
            {isRecording ? 'Stop' : 'Rec'}
          </button>

          {showExport && (
            <div className="absolute right-0 top-full mt-1 flex items-center gap-1 bg-card border border-border rounded-lg p-1.5 shadow-lg z-50">
              <button
                onClick={() => downloadMp3()}
                disabled={exportStatus === 'encoding'}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-border text-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
              >
                <Download className="w-3 h-3" />
                {exportStatus === 'encoding' ? 'Encoding…' : 'MP3'}
              </button>
              <button
                onClick={() => { publish(); setShowExport(false) }}
                disabled={exportStatus === 'uploading'}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-primary/40 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
              >
                {exportStatus === 'uploading' ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          )}
        </div>

        {/* Projects */}
        <button
          onClick={() => navigate('/projects')}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          title="My Projects"
        >
          <FolderOpen className="w-3.5 h-3.5" />
        </button>

        {/* Save */}
        <button
          onClick={save}
          disabled={isSaving}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors border',
            isDirty
              ? 'bg-primary/20 text-primary border-primary/40 hover:bg-primary/30'
              : 'text-muted-foreground border-border hover:text-foreground'
          )}
          title="Save project"
        >
          <Save className="w-3 h-3" />
          {isSaving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Mic modal */}
      {micModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setMicModalOpen(false)}>
          <div className="bg-card border border-border rounded-xl p-6 w-72 shadow-card" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-foreground mb-3">Record from Microphone</h3>
            <input
              value={micName}
              onChange={e => setMicName(e.target.value)}
              placeholder="Sample name"
              className="w-full bg-muted/40 border border-border rounded px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary mb-4"
            />
            <button
              onClick={handleMicRecord}
              className={cn(
                'w-full py-2 rounded text-sm font-medium transition-colors',
                micStatus === 'recording'
                  ? 'bg-destructive text-white hover:bg-destructive/80'
                  : 'bg-primary text-white hover:bg-primary/80'
              )}
            >
              {micStatus === 'idle' && 'Request Microphone'}
              {micStatus === 'requesting' && 'Requesting…'}
              {micStatus === 'ready' && 'Start Recording'}
              {micStatus === 'recording' && '⏹ Stop & Save'}
              {micStatus === 'uploading' && 'Uploading…'}
              {micStatus === 'done' && 'Done!'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
