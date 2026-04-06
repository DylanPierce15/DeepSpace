/**
 * usePresenceRoom — Connect to a PresenceRoom Durable Object.
 *
 * Opens a WebSocket to /ws/presence/:scopeId for real-time presence tracking.
 * Use with any scope: canvas, doc, thread, page, etc.
 *
 * Peers can share arbitrary state (cursor position, typing indicator,
 * viewport, selection) via updateState().
 *
 * @example
 * // Track who's on a canvas
 * const { peers, connected, updateState } = usePresenceRoom(`canvas:${canvasId}`)
 *
 * // Share cursor position
 * updateState({ cursor: { x: 100, y: 200 } })
 *
 * // Track who's viewing a thread
 * const { peers } = usePresenceRoom(`thread:${channelId}`)
 *
 * // Show typing indicator
 * updateState({ typing: true })
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getAuthToken } from '../../auth'
import { wsLog } from '../ws-log'
import {
  MSG_PRESENCE_SYNC,
  MSG_PRESENCE_JOIN,
  MSG_PRESENCE_LEAVE,
  MSG_PRESENCE_UPDATE,
} from '@/shared/protocol/constants'

// ============================================================================
// Types
// ============================================================================

export interface PresencePeerClient {
  userId: string
  userName: string
  userEmail: string
  userImageUrl?: string
  joinedAt: string
  state: Record<string, unknown>
}

export interface UsePresenceRoomResult {
  /** All peers currently present in this scope (excludes self) */
  peers: PresencePeerClient[]
  /** Whether the WebSocket is connected */
  connected: boolean
  /** Send a state update (cursor, typing, viewport, etc.) — merges with existing state */
  updateState: (state: Record<string, unknown>) => void
}

// ============================================================================
// Hook
// ============================================================================

export function usePresenceRoom(scopeId: string): UsePresenceRoomResult {
  const [peers, setPeers] = useState<PresencePeerClient[]>([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let alive = true

    const connect = async () => {
      if (!alive) return

      const token = await getAuthToken()
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const baseUrl = `${protocol}//${window.location.host}`
      const url = new URL(`/ws/presence/${encodeURIComponent(scopeId)}`, baseUrl)
      if (token) url.searchParams.set('token', token)

      wsLog('connecting', `presence:${scopeId}`)
      ws = new WebSocket(url.toString())
      wsRef.current = ws

      ws.onopen = () => {
        wsLog('connected', `presence:${scopeId}`)
        setConnected(true)
      }

      ws.onmessage = (event) => {
        if (typeof event.data !== 'string') return
        try {
          const msg = JSON.parse(event.data) as { type: number; payload: Record<string, unknown> }
          switch (msg.type) {
            case MSG_PRESENCE_SYNC: {
              setPeers(msg.payload.peers as PresencePeerClient[])
              break
            }
            case MSG_PRESENCE_JOIN: {
              const peer = msg.payload.peer as PresencePeerClient
              setPeers(prev => [...prev.filter(p => p.userId !== peer.userId), peer])
              break
            }
            case MSG_PRESENCE_LEAVE: {
              const userId = msg.payload.userId as string
              setPeers(prev => prev.filter(p => p.userId !== userId))
              break
            }
            case MSG_PRESENCE_UPDATE: {
              const { userId, state } = msg.payload as { userId: string; state: Record<string, unknown> }
              setPeers(prev =>
                prev.map(p =>
                  p.userId === userId ? { ...p, state: { ...p.state, ...state } } : p,
                ),
              )
              break
            }
          }
        } catch { /* ignore parse errors */ }
      }

      ws.onclose = () => {
        wsLog('disconnected', `presence:${scopeId}`)
        wsRef.current = null
        setConnected(false)
        if (alive) reconnectTimer = setTimeout(connect, 1000)
      }

      ws.onerror = () => ws?.close()
    }

    connect()

    return () => {
      wsLog('closing', `presence:${scopeId}`)
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
  }, [scopeId])

  const updateState = useCallback((state: Record<string, unknown>) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: MSG_PRESENCE_UPDATE, payload: state }))
  }, [])

  return { peers, connected, updateState }
}
