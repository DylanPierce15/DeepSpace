/**
 * useMicRecorder — capture microphone audio, store as a sample track.
 */

import { useState, useRef, useCallback } from 'react'
import { useR2Files } from 'deepspace'
import { useStudio } from './useStudio'
import type { Track } from '../constants'

export type MicStatus = 'idle' | 'requesting' | 'ready' | 'recording' | 'uploading' | 'done' | 'error'

export function useMicRecorder() {
  const { addTrack } = useStudio()
  const { upload } = useR2Files()

  const [micStatus, setMicStatus] = useState<MicStatus>('idle')
  const [errorMsg,  setErrorMsg]  = useState<string | null>(null)
  const [sampleUrl, setSampleUrl] = useState<string | null>(null)

  const streamRef   = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef   = useRef<Blob[]>([])

  const requestMic = useCallback(async () => {
    setMicStatus('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream
      setMicStatus('ready')
      setErrorMsg(null)
    } catch (e: any) {
      setErrorMsg(e.message)
      setMicStatus('error')
    }
  }, [])

  const startRec = useCallback(() => {
    const stream = streamRef.current
    if (!stream) { setErrorMsg('Microphone not ready'); return }

    chunksRef.current = []
    const recorder = new MediaRecorder(stream)
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.start(100)
    recorderRef.current = recorder
    setMicStatus('recording')
  }, [])

  const stopRec = useCallback(async (sampleName?: string) => {
    const recorder = recorderRef.current
    if (!recorder) return

    await new Promise<void>(resolve => {
      recorder.onstop = () => resolve()
      recorder.stop()
    })
    recorderRef.current = null

    setMicStatus('uploading')
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    const name = `${sampleName ?? 'sample'}-${Date.now()}.webm`

    try {
      const file   = new File([blob], name, { type: 'audio/webm' })
      const result = await upload(file, name)
      if (!result.success || !result.url) throw new Error('Upload failed')

      setSampleUrl(result.url)
      setMicStatus('done')

      const newTrack: Track = {
        id:        `track-${Date.now()}`,
        name:      sampleName ?? 'Sample',
        type:      'sample',
        sampleUrl: result.url,
        volume:    0.8,
        pan:       0,
        muted:     false,
        soloed:    false,
        color:     '#f59e0b',
        instrument: { oscillator: 'sine', filterFreq: 2000, filterRes: 1, attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.5 },
      }
      addTrack(newTrack)
      return result.url
    } catch (e: any) {
      setErrorMsg(e.message)
      setMicStatus('error')
      return null
    }
  }, [upload, addTrack])

  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setMicStatus('idle')
  }, [])

  return {
    micStatus, errorMsg, sampleUrl,
    isRecording: micStatus === 'recording',
    requestMic, startRec, stopRec, releaseMic,
  }
}
