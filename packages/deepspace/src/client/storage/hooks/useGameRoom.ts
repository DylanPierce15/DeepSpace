/**
 * useGameRoom — Connect to a GameRoom Durable Object.
 *
 * Opens a WebSocket to /ws/game/:roomId for real-time game state.
 *
 * @example
 * const { state, sendInput, players, connected } = useGameRoom('my-game')
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getAuthToken } from '../../auth'
import {
  MSG_GAME_STATE,
  MSG_GAME_INPUT,
  MSG_GAME_PLAYER_JOIN,
  MSG_GAME_PLAYER_LEAVE,
  MSG_GAME_PLAYER_READY,
  MSG_GAME_START,
  MSG_GAME_END,
  MSG_GAME_TICK,
} from '@/shared/protocol/constants'

export interface GamePlayer {
  userId: string
  userName: string
  ready: boolean
  connectedAt: string
  data: Record<string, unknown>
}

export interface UseGameRoomResult {
  /** Current game state */
  state: Record<string, unknown>
  /** Current tick number */
  tick: number
  /** Connected players */
  players: GamePlayer[]
  /** Whether the game is currently running */
  running: boolean
  /** Whether WebSocket is connected */
  connected: boolean
  /** Send a game input */
  sendInput: (action: string, data?: Record<string, unknown>) => void
  /** Mark self as ready */
  setReady: () => void
  /** Request game start */
  startGame: () => void
  /** Request game end */
  endGame: () => void
}

export function useGameRoom(roomId: string): UseGameRoomResult {
  const [gameState, setGameState] = useState<Record<string, unknown>>({})
  const [tick, setTick] = useState(0)
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [running, setRunning] = useState(false)
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
      const url = new URL(`/ws/game/${encodeURIComponent(roomId)}`, baseUrl)
      if (token) url.searchParams.set('token', token)

      ws = new WebSocket(url.toString())
      wsRef.current = ws

      ws.onopen = () => setConnected(true)

      ws.onmessage = (event) => {
        if (typeof event.data !== 'string') return
        try {
          const msg = JSON.parse(event.data) as { type: number; payload: Record<string, unknown> }
          switch (msg.type) {
            case MSG_GAME_STATE: {
              const p = msg.payload
              setGameState(p.state as Record<string, unknown>)
              setTick(p.tick as number)
              setPlayers(p.players as GamePlayer[])
              setRunning(p.running as boolean)
              break
            }
            case MSG_GAME_TICK: {
              setGameState(msg.payload.state as Record<string, unknown>)
              setTick(msg.payload.tick as number)
              break
            }
            case MSG_GAME_PLAYER_JOIN: {
              const player = msg.payload.player as GamePlayer
              setPlayers(prev => [...prev.filter(p => p.userId !== player.userId), player])
              break
            }
            case MSG_GAME_PLAYER_LEAVE: {
              const userId = msg.payload.userId as string
              setPlayers(prev => prev.filter(p => p.userId !== userId))
              break
            }
            case MSG_GAME_PLAYER_READY: {
              const userId = msg.payload.userId as string
              setPlayers(prev => prev.map(p => p.userId === userId ? { ...p, ready: true } : p))
              break
            }
            case MSG_GAME_START: {
              setRunning(true)
              setGameState(msg.payload.state as Record<string, unknown>)
              setTick(msg.payload.tick as number)
              break
            }
            case MSG_GAME_END: {
              setRunning(false)
              setGameState(msg.payload.state as Record<string, unknown>)
              break
            }
          }
        } catch { /* ignore parse errors */ }
      }

      ws.onclose = () => {
        wsRef.current = null
        setConnected(false)
        if (alive) reconnectTimer = setTimeout(connect, 1000)
      }

      ws.onerror = () => ws?.close()
    }

    connect()

    return () => {
      alive = false
      if (reconnectTimer) clearTimeout(reconnectTimer)
      ws?.close()
      wsRef.current = null
    }
  }, [roomId])

  const sendInput = useCallback((action: string, data: Record<string, unknown> = {}) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: MSG_GAME_INPUT, payload: { action, data } }))
  }, [])

  const setReady = useCallback(() => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: MSG_GAME_PLAYER_READY, payload: {} }))
  }, [])

  const startGame = useCallback(() => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: MSG_GAME_START, payload: {} }))
  }, [])

  const endGame = useCallback(() => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: MSG_GAME_END, payload: {} }))
  }, [])

  return { state: gameState, tick, players, running, connected, sendInput, setReady, startGame, endGame }
}
