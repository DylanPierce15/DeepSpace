/**
 * useMediaRoom — Connect to a MediaRoom Durable Object for WebRTC signaling.
 *
 * Opens a WebSocket to /ws/media/:roomId for peer-to-peer media connections.
 * Handles SDP offer/answer exchange and ICE candidate relay.
 *
 * @example
 * const { peers, localStream, connect, disconnect } = useMediaRoom('my-call')
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getAuthToken } from '../../auth'
import { wsLog } from '../ws-log'
import { MSG } from '@/shared/protocol/constants'

export interface MediaPeerClient {
  userId: string
  userName: string
  joinedAt: string
}

export interface UseMediaRoomResult {
  /** Connected peers in the room */
  peers: MediaPeerClient[]
  /** Local media stream (if connected) */
  localStream: MediaStream | null
  /** Whether signaling WebSocket is connected */
  connected: boolean
  /** Start local media and join the room */
  connect: (constraints?: MediaStreamConstraints) => Promise<void>
  /** Stop local media and leave the room */
  disconnect: () => void
  /** Send an SDP offer to a specific peer */
  sendOffer: (targetUserId: string, sdp: RTCSessionDescriptionInit) => void
  /** Send an SDP answer to a specific peer */
  sendAnswer: (targetUserId: string, sdp: RTCSessionDescriptionInit) => void
  /** Send an ICE candidate to a specific peer */
  sendIceCandidate: (targetUserId: string, candidate: RTCIceCandidate) => void
  /** Handler for incoming offers (set by consumer) */
  onOffer: React.MutableRefObject<((fromUserId: string, sdp: RTCSessionDescriptionInit) => void) | null>
  /** Handler for incoming answers */
  onAnswer: React.MutableRefObject<((fromUserId: string, sdp: RTCSessionDescriptionInit) => void) | null>
  /** Handler for incoming ICE candidates */
  onIceCandidate: React.MutableRefObject<((fromUserId: string, candidate: RTCIceCandidateInit) => void) | null>
}

export function useMediaRoom(roomId: string): UseMediaRoomResult {
  const [peers, setPeers] = useState<MediaPeerClient[]>([])
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  const onOffer = useRef<((fromUserId: string, sdp: RTCSessionDescriptionInit) => void) | null>(null)
  const onAnswer = useRef<((fromUserId: string, sdp: RTCSessionDescriptionInit) => void) | null>(null)
  const onIceCandidate = useRef<((fromUserId: string, candidate: RTCIceCandidateInit) => void) | null>(null)

  useEffect(() => {
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let alive = true

    const connectWs = async () => {
      if (!alive) return

      const token = await getAuthToken()
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const baseUrl = `${protocol}//${window.location.host}`
      const url = new URL(`/ws/media/${encodeURIComponent(roomId)}`, baseUrl)
      if (token) url.searchParams.set('token', token)

      wsLog('connecting', `media:${roomId}`)
      ws = new WebSocket(url.toString())
      wsRef.current = ws

      ws.onopen = () => {
        wsLog('connected', `media:${roomId}`)
        setConnected(true)
      }

      ws.onmessage = (event) => {
        if (typeof event.data !== 'string') return
        try {
          const msg = JSON.parse(event.data) as { type: string; payload: Record<string, unknown> }
          switch (msg.type) {
            case MSG.MEDIA_PEERS:
              setPeers(msg.payload.peers as MediaPeerClient[])
              break
            case MSG.MEDIA_JOIN: {
              const peer = msg.payload.peer as MediaPeerClient
              setPeers(prev => [...prev.filter(p => p.userId !== peer.userId), peer])
              break
            }
            case MSG.MEDIA_LEAVE: {
              const userId = msg.payload.userId as string
              setPeers(prev => prev.filter(p => p.userId !== userId))
              break
            }
            case MSG.MEDIA_OFFER: {
              const { fromUserId, sdp } = msg.payload as { fromUserId: string; sdp: RTCSessionDescriptionInit }
              onOffer.current?.(fromUserId, sdp)
              break
            }
            case MSG.MEDIA_ANSWER: {
              const { fromUserId, sdp } = msg.payload as { fromUserId: string; sdp: RTCSessionDescriptionInit }
              onAnswer.current?.(fromUserId, sdp)
              break
            }
            case MSG.MEDIA_ICE_CANDIDATE: {
              const { fromUserId, candidate } = msg.payload as { fromUserId: string; candidate: RTCIceCandidateInit }
              onIceCandidate.current?.(fromUserId, candidate)
              break
            }
          }
        } catch { /* ignore */ }
      }

      ws.onclose = () => {
        wsLog('disconnected', `media:${roomId}`)
        wsRef.current = null
        setConnected(false)
        if (alive) reconnectTimer = setTimeout(connectWs, 1000)
      }

      ws.onerror = () => ws?.close()
    }

    connectWs()

    return () => {
      wsLog('closing', `media:${roomId}`)
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
  }, [roomId])

  const connectMedia = useCallback(async (constraints?: MediaStreamConstraints) => {
    const stream = await navigator.mediaDevices.getUserMedia(
      constraints ?? { audio: true, video: true }
    )
    setLocalStream(stream)
  }, [])

  const disconnect = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop())
      setLocalStream(null)
    }
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: MSG.MEDIA_LEAVE, payload: {} }))
    }
  }, [localStream])

  const sendOffer = useCallback((targetUserId: string, sdp: RTCSessionDescriptionInit) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: MSG.MEDIA_OFFER, payload: { targetUserId, sdp } }))
  }, [])

  const sendAnswer = useCallback((targetUserId: string, sdp: RTCSessionDescriptionInit) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: MSG.MEDIA_ANSWER, payload: { targetUserId, sdp } }))
  }, [])

  const sendIceCandidate = useCallback((targetUserId: string, candidate: RTCIceCandidate) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: MSG.MEDIA_ICE_CANDIDATE, payload: { targetUserId, candidate: candidate.toJSON() } }))
  }, [])

  return {
    peers,
    localStream,
    connected,
    connect: connectMedia,
    disconnect,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    onOffer,
    onAnswer,
    onIceCandidate,
  }
}
