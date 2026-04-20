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
import {
  clientBuild,
  dispatch,
  encode,
  type ServerMessage,
} from '@/shared/protocol/messages'

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
        dispatch<ServerMessage>(event.data, {
          [MSG.MEDIA_PEERS]: (p) => {
            setPeers(p.peers as MediaPeerClient[])
          },
          [MSG.MEDIA_JOIN]: (p) => {
            const peer = p.peer as MediaPeerClient
            setPeers((prev) => [...prev.filter((x) => x.userId !== peer.userId), peer])
          },
          [MSG.MEDIA_LEAVE]: (p) => {
            setPeers((prev) => prev.filter((x) => x.userId !== p.userId))
          },
          [MSG.MEDIA_OFFER]: (p) => {
            onOffer.current?.(p.fromUserId, p.sdp as RTCSessionDescriptionInit)
          },
          [MSG.MEDIA_ANSWER]: (p) => {
            onAnswer.current?.(p.fromUserId, p.sdp as RTCSessionDescriptionInit)
          },
          [MSG.MEDIA_ICE_CANDIDATE]: (p) => {
            onIceCandidate.current?.(p.fromUserId, p.candidate as RTCIceCandidateInit)
          },
        })
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

  const sendBuilt = useCallback(
    <M extends { type: string; payload: unknown }>(message: M) => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      ws.send(encode(message))
    },
    [],
  )

  const disconnect = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop())
      setLocalStream(null)
    }
    sendBuilt(clientBuild.mediaLeave())
  }, [localStream, sendBuilt])

  const sendOffer = useCallback(
    (targetUserId: string, sdp: RTCSessionDescriptionInit) =>
      sendBuilt(clientBuild.mediaOffer(targetUserId, sdp)),
    [sendBuilt],
  )

  const sendAnswer = useCallback(
    (targetUserId: string, sdp: RTCSessionDescriptionInit) =>
      sendBuilt(clientBuild.mediaAnswer(targetUserId, sdp)),
    [sendBuilt],
  )

  const sendIceCandidate = useCallback(
    (targetUserId: string, candidate: RTCIceCandidate) =>
      sendBuilt(clientBuild.mediaIceCandidate(targetUserId, candidate.toJSON())),
    [sendBuilt],
  )

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
