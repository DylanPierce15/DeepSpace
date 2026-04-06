/**
 * useYjsRoom — Connect to a dedicated YjsRoom Durable Object.
 *
 * Unlike useYjsField (which piggybacks on RecordRoom's WebSocket),
 * this hook opens a direct WebSocket to a YjsRoom DO at /ws/yjs/:docId.
 * Each document gets its own DO for horizontal scaling.
 *
 * Uses the shared yjs-protocol.ts encoding — no duplication.
 *
 * @example
 * const { doc, text, setText, synced, canWrite } = useYjsRoom(docId, 'content')
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import * as Y from 'yjs'
import { getAuthToken } from '../../auth'
import { wsLog } from '../ws-log'
import {
  MSG_SYNC,
  MSG_SYNC_STEP1,
  MSG_SYNC_STEP2,
  MSG_SYNC_UPDATE,
  createEncoder,
  createDecoder,
  toUint8Array,
  writeVarUint,
  writeVarUint8Array,
  readVarUint,
  readVarUint8Array,
} from '@/shared/protocol/yjs'

// ============================================================================
// Hook
// ============================================================================

export interface UseYjsRoomResult {
  /** The Yjs document */
  doc: Y.Doc
  /** Current text content (for the specified field) */
  text: string
  /** Set text (replaces full content) */
  setText: (value: string) => void
  /** Whether initial sync is complete */
  synced: boolean
  /** Whether user has write access */
  canWrite: boolean
}

/**
 * Connect to a YjsRoom DO for collaborative editing.
 *
 * @param docId - Document identifier (maps to DO name)
 * @param fieldName - Y.Text field name within the Y.Doc
 */
export function useYjsRoom(docId: string, fieldName: string): UseYjsRoomResult {
  const [synced, setSynced] = useState(false)
  const [canWrite, setCanWrite] = useState(false)
  const [text, setTextState] = useState('')
  const [, setUpdateCount] = useState(0)

  const docRef = useRef<Y.Doc | null>(null)
  if (!docRef.current) docRef.current = new Y.Doc()
  const doc = docRef.current

  const wsRef = useRef<WebSocket | null>(null)
  const isLocalRef = useRef(false)

  const yText = useMemo(() => doc.getText(fieldName), [doc, fieldName])

  // Observe remote Y.Text changes
  useEffect(() => {
    const observer = () => {
      if (isLocalRef.current) return
      setTextState(yText.toString())
    }
    yText.observe(observer)
    return () => yText.unobserve(observer)
  }, [yText])

  // WebSocket connection to YjsRoom DO
  useEffect(() => {
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let alive = true

    const connect = async () => {
      if (!alive) return

      const token = await getAuthToken()
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const baseUrl = `${protocol}//${window.location.host}`
      const url = new URL(`/ws/yjs/${encodeURIComponent(docId)}`, baseUrl)
      if (token) url.searchParams.set('token', token)

      wsLog('connecting', `yjs:${docId}`)
      ws = new WebSocket(url.toString())
      ws.binaryType = 'arraybuffer'
      wsRef.current = ws

      ws.onopen = () => {
        wsLog('connected', `yjs:${docId}`)
        setSynced(false)
      }

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data)
            if (msg.type === 'auth') setCanWrite(msg.canWrite)
          } catch { /* ignore */ }
          return
        }

        const data = new Uint8Array(event.data)
        const decoder = createDecoder(data)
        const messageType = readVarUint(decoder)

        if (messageType === MSG_SYNC) {
          const syncType = readVarUint(decoder)
          const payload = readVarUint8Array(decoder)

          switch (syncType) {
            case MSG_SYNC_STEP1: {
              const diff = Y.encodeStateAsUpdate(doc, payload)
              const enc = createEncoder()
              writeVarUint(enc, MSG_SYNC)
              writeVarUint(enc, MSG_SYNC_STEP2)
              writeVarUint8Array(enc, diff)
              ws?.send(toUint8Array(enc).buffer)
              setSynced(true)
              break
            }
            case MSG_SYNC_STEP2: {
              Y.applyUpdate(doc, payload, 'server')
              setTextState(yText.toString())
              setSynced(true)
              break
            }
            case MSG_SYNC_UPDATE: {
              Y.applyUpdate(doc, payload, 'server')
              setUpdateCount(c => c + 1)
              break
            }
          }
        }
      }

      ws.onclose = () => {
        wsLog('disconnected', `yjs:${docId}`)
        wsRef.current = null
        setSynced(false)
        if (alive) reconnectTimer = setTimeout(connect, 1000)
      }

      ws.onerror = () => ws?.close()
    }

    connect()

    return () => {
      wsLog('closing', `yjs:${docId}`)
      alive = false
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (ws) {
        ws.onclose = null
        ws.onmessage = null
        ws.onerror = null
        ws.close()
      }
      wsRef.current = null
    }
  }, [doc, docId, yText])

  // Send local Y.Doc updates to server
  useEffect(() => {
    const handler = (update: Uint8Array, origin: unknown) => {
      if (origin === 'server') return
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return

      const enc = createEncoder()
      writeVarUint(enc, MSG_SYNC)
      writeVarUint(enc, MSG_SYNC_UPDATE)
      writeVarUint8Array(enc, update)
      ws.send(toUint8Array(enc).buffer)
    }

    doc.on('update', handler)
    return () => { doc.off('update', handler) }
  }, [doc])

  // setText: update Y.Text + local state
  const setText = useCallback((value: string) => {
    setTextState(value)
    if (!canWrite) return

    isLocalRef.current = true
    doc.transact(() => {
      yText.delete(0, yText.length)
      yText.insert(0, value)
    })
    isLocalRef.current = false
  }, [doc, yText, canWrite])

  return { doc, text, setText, synced, canWrite }
}
