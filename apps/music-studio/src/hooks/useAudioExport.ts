/**
 * useAudioExport
 *
 * Records live playback using MediaRecorder, encodes to MP3 via lamejs (CDN),
 * and optionally publishes to the community feed via R2 + published-projects.
 */

import { useState, useRef, useCallback } from 'react'
import { useR2Files, useMutations, useUser } from 'deepspace'
import { integration } from 'deepspace'
import { useStudio } from './useStudio'

async function generateCoverArt(trackName: string): Promise<string | null> {
  try {
    const res = await integration.post('/generate-image-gemini', {
      prompt: `Abstract music cover art for a track called "${trackName}". Dark atmospheric mood, flowing audio waveforms, neon accent colours, no text, no words, no letters, no people.`,
    })
    if (res.success) {
      const d = res.data as any
      return d?.imageUrls?.[0] ?? d?.url ?? d?.imageUrl ?? null
    }
  } catch { /* generation failed — use gradient fallback */ }
  return null
}

declare global { interface Window { lamejs: any } }

const LAMEJS_CDN = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js'

async function ensureLamejs(): Promise<any> {
  if (window.lamejs) return window.lamejs
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[data-lamejs-cdn]')) {
      const poll = setInterval(() => { if (window.lamejs) { clearInterval(poll); resolve(window.lamejs) } }, 50)
      return
    }
    const script = document.createElement('script')
    script.src = LAMEJS_CDN
    script.setAttribute('data-lamejs-cdn', 'true')
    script.onload  = () => resolve(window.lamejs)
    script.onerror = () => reject(new Error('Failed to load lamejs from CDN'))
    document.head.appendChild(script)
  })
}

function float32ToInt16(f32: Float32Array): Int16Array {
  const int16 = new Int16Array(f32.length)
  for (let i = 0; i < f32.length; i++) {
    int16[i] = Math.max(-32768, Math.min(32767, Math.round(f32[i] * 32768)))
  }
  return int16
}

async function encodeToMp3(audioBlob: Blob): Promise<Blob> {
  const lamejs = await ensureLamejs()
  const arrayBuffer = await audioBlob.arrayBuffer()
  const audioCtx = new AudioContext()
  const decoded  = await audioCtx.decodeAudioData(arrayBuffer)
  audioCtx.close()

  const sampleRate = decoded.sampleRate
  const left  = float32ToInt16(decoded.getChannelData(0))
  const right  = decoded.numberOfChannels > 1 ? float32ToInt16(decoded.getChannelData(1)) : left

  const encoder  = new lamejs.Mp3Encoder(2, sampleRate, 192)
  const mp3Parts: BlobPart[] = []
  const chunkSize = 1152

  for (let i = 0; i < left.length; i += chunkSize) {
    const l = left.subarray(i, i + chunkSize)
    const r = right.subarray(i, i + chunkSize)
    const buf = encoder.encodeBuffer(l, r)
    if (buf.length > 0) mp3Parts.push(buf as BlobPart)
  }
  const tail = encoder.flush()
  if (tail.length > 0) mp3Parts.push(tail as BlobPart)

  return new Blob(mp3Parts, { type: 'audio/mpeg' })
}

export type ExportStatus = 'idle' | 'recording' | 'encoding' | 'uploading' | 'done' | 'error'

export function useAudioExport() {
  const { state, masterVolRef } = useStudio()
  const { user }   = useUser()
  const { upload } = useR2Files()
  const { create } = useMutations('published-projects')
  const { put }    = useMutations('projects')

  const [status,   setStatus]   = useState<ExportStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)

  const recorderRef  = useRef<MediaRecorder | null>(null)
  const chunksRef    = useRef<Blob[]>([])
  const destNodeRef  = useRef<MediaStreamAudioDestinationNode | null>(null)

  const startRecording = useCallback(() => {
    const vol = masterVolRef.current
    if (!vol) { setErrorMsg('Audio engine not ready'); return }

    try {
      const ctx  = vol.context.rawContext as AudioContext
      const dest = ctx.createMediaStreamDestination()
      destNodeRef.current = dest
      vol.connect(dest)

      const recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus' })
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.start(100)
      recorderRef.current = recorder
      setStatus('recording')
      setAudioBlob(null)
      setErrorMsg(null)
    } catch (e: any) {
      setErrorMsg(e.message)
      setStatus('error')
    }
  }, [masterVolRef])

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const recorder = recorderRef.current
      if (!recorder) { reject(new Error('Not recording')); return }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setStatus('idle')
        try { masterVolRef.current?.disconnect(destNodeRef.current) } catch {}
        resolve(blob)
      }
      recorder.stop()
      recorderRef.current = null
    })
  }, [masterVolRef])

  const downloadMp3 = useCallback(async (blob?: Blob) => {
    const source = blob ?? audioBlob
    if (!source) return

    setStatus('encoding')
    try {
      const mp3 = await encodeToMp3(source)
      const url = URL.createObjectURL(mp3)
      const a   = document.createElement('a')
      a.href     = url
      a.download = `${state.projectName.replace(/\s+/g, '_')}.mp3`
      a.click()
      URL.revokeObjectURL(url)
      setStatus('done')
    } catch (e: any) {
      setErrorMsg(e.message)
      setStatus('error')
    }
  }, [audioBlob, state.projectName])

  const publish = useCallback(async (blob?: Blob) => {
    const source = blob ?? audioBlob
    if (!source) { setErrorMsg('No audio recorded'); return null }

    setStatus('encoding')
    let mp3: Blob
    try {
      mp3 = await encodeToMp3(source)
    } catch (e: any) {
      setErrorMsg(e.message); setStatus('error'); return null
    }

    setStatus('uploading')
    try {
      const [coverImageUrl, result] = await Promise.all([
        generateCoverArt(state.projectName),
        upload(new File([mp3], `${state.projectName}.mp3`, { type: 'audio/mpeg' }), `${state.projectName}.mp3`),
      ])
      if (!result.success || !result.url) throw new Error('Upload failed')

      await create({
        name:            state.projectName,
        bpm:             state.bpm,
        publishedUrl:    result.url,
        tracks:          JSON.stringify(state.tracks),
        authorId:        user?.id ?? '',
        authorName:      user?.name ?? 'Unknown',
        authorImageUrl:  user?.imageUrl ?? '',
        authorUsername:  (user as any)?.publicUsername ?? '',
        coverImageUrl:   coverImageUrl ?? '',
        publishedAt:     new Date().toISOString(),
      })

      if (state.savedProjectId) {
        put(state.savedProjectId, { visibility: 'public', publishedUrl: result.url })
      }

      setStatus('done')
      return result.url
    } catch (e: any) {
      setErrorMsg(e.message); setStatus('error'); return null
    }
  }, [audioBlob, state, upload, create, put])

  return {
    status, errorMsg, audioBlob,
    startRecording, stopRecording, downloadMp3, publish,
    isRecording: status === 'recording',
  }
}
