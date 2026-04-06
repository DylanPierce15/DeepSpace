/**
 * useCanvas — Connect to a CanvasRoom Durable Object.
 *
 * Opens a WebSocket to /ws/canvas/:roomId for collaborative spatial editing.
 *
 * @example
 * const { shapes, addShape, moveShape, deleteShape, viewports } = useCanvas('my-canvas')
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getAuthToken } from '../../auth'
import { wsLog } from '../ws-log'
import {
  MSG_CANVAS_SHAPES,
  MSG_CANVAS_ADD,
  MSG_CANVAS_MOVE,
  MSG_CANVAS_RESIZE,
  MSG_CANVAS_DELETE,
  MSG_CANVAS_UPDATE,
  MSG_CANVAS_VIEWPORT,
  MSG_CANVAS_UNDO,
  MSG_CANVAS_REDO,
} from '@/shared/protocol/constants'

export interface CanvasShapeClient {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  props: Record<string, unknown>
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface ViewportClient {
  userId: string
  x: number
  y: number
  width: number
  height: number
  zoom: number
}

export interface UseCanvasResult {
  /** All shapes on the canvas */
  shapes: CanvasShapeClient[]
  /** Other users' viewports */
  viewports: ViewportClient[]
  /** Whether WebSocket is connected */
  connected: boolean
  /** Add a shape */
  addShape: (shape: Partial<CanvasShapeClient>) => void
  /** Move a shape */
  moveShape: (shapeId: string, x: number, y: number) => void
  /** Resize a shape */
  resizeShape: (shapeId: string, width: number, height: number, x?: number, y?: number) => void
  /** Delete a shape */
  deleteShape: (shapeId: string) => void
  /** Update shape properties */
  updateShape: (shapeId: string, props: Record<string, unknown>) => void
  /** Report local viewport */
  setViewport: (viewport: Omit<ViewportClient, 'userId'>) => void
  /** Undo last action */
  undo: () => void
  /** Redo last undone action */
  redo: () => void
}

export function useCanvas(roomId: string): UseCanvasResult {
  const [shapes, setShapes] = useState<CanvasShapeClient[]>([])
  const [viewports, setViewports] = useState<ViewportClient[]>([])
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
      const url = new URL(`/ws/canvas/${encodeURIComponent(roomId)}`, baseUrl)
      if (token) url.searchParams.set('token', token)

      wsLog('connecting', `canvas:${roomId}`)
      ws = new WebSocket(url.toString())
      wsRef.current = ws

      ws.onopen = () => {
        wsLog('connected', `canvas:${roomId}`)
        setConnected(true)
      }

      ws.onmessage = (event) => {
        if (typeof event.data !== 'string') return
        try {
          const msg = JSON.parse(event.data) as { type: number; payload: Record<string, unknown> }
          switch (msg.type) {
            case MSG_CANVAS_SHAPES:
              setShapes(msg.payload.shapes as CanvasShapeClient[])
              if (msg.payload.viewports) {
                setViewports(msg.payload.viewports as ViewportClient[])
              }
              break
            case MSG_CANVAS_ADD: {
              const shape = msg.payload.shape as CanvasShapeClient
              setShapes(prev => [...prev.filter(s => s.id !== shape.id), shape])
              break
            }
            case MSG_CANVAS_MOVE: {
              const { shapeId, x, y } = msg.payload as { shapeId: string; x: number; y: number }
              setShapes(prev => prev.map(s => s.id === shapeId ? { ...s, x, y } : s))
              break
            }
            case MSG_CANVAS_RESIZE: {
              const p = msg.payload as { shapeId: string; width: number; height: number; x?: number; y?: number }
              setShapes(prev => prev.map(s => {
                if (s.id !== p.shapeId) return s
                const updated = { ...s, width: p.width, height: p.height }
                if (p.x !== undefined) updated.x = p.x
                if (p.y !== undefined) updated.y = p.y
                return updated
              }))
              break
            }
            case MSG_CANVAS_DELETE: {
              const { shapeId } = msg.payload as { shapeId: string }
              setShapes(prev => prev.filter(s => s.id !== shapeId))
              break
            }
            case MSG_CANVAS_UPDATE: {
              const { shapeId, props } = msg.payload as { shapeId: string; props: Record<string, unknown> }
              setShapes(prev => prev.map(s =>
                s.id === shapeId ? { ...s, props: { ...s.props, ...props } } : s
              ))
              break
            }
            case MSG_CANVAS_VIEWPORT: {
              const vp = msg.payload as { viewport?: ViewportClient; userId?: string; removed?: boolean }
              if (vp.removed && vp.userId) {
                setViewports(prev => prev.filter(v => v.userId !== vp.userId))
              } else if (vp.viewport) {
                setViewports(prev => [
                  ...prev.filter(v => v.userId !== vp.viewport!.userId),
                  vp.viewport!,
                ])
              }
              break
            }
          }
        } catch { /* ignore */ }
      }

      ws.onclose = () => {
        wsLog('disconnected', `canvas:${roomId}`)
        wsRef.current = null
        setConnected(false)
        if (alive) reconnectTimer = setTimeout(connect, 1000)
      }

      ws.onerror = () => ws?.close()
    }

    connect()

    return () => {
      wsLog('closing', `canvas:${roomId}`)
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

  const send = useCallback((type: number, payload: Record<string, unknown>) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type, payload }))
  }, [])

  const addShape = useCallback((shape: Partial<CanvasShapeClient>) => {
    send(MSG_CANVAS_ADD, shape as Record<string, unknown>)
  }, [send])

  const moveShape = useCallback((shapeId: string, x: number, y: number) => {
    send(MSG_CANVAS_MOVE, { shapeId, x, y })
  }, [send])

  const resizeShape = useCallback((shapeId: string, width: number, height: number, x?: number, y?: number) => {
    send(MSG_CANVAS_RESIZE, { shapeId, width, height, x, y })
  }, [send])

  const deleteShape = useCallback((shapeId: string) => {
    send(MSG_CANVAS_DELETE, { shapeId })
  }, [send])

  const updateShape = useCallback((shapeId: string, props: Record<string, unknown>) => {
    send(MSG_CANVAS_UPDATE, { shapeId, props })
  }, [send])

  const setViewport = useCallback((viewport: Omit<ViewportClient, 'userId'>) => {
    send(MSG_CANVAS_VIEWPORT, viewport as Record<string, unknown>)
  }, [send])

  const undo = useCallback(() => {
    send(MSG_CANVAS_UNDO, {})
  }, [send])

  const redo = useCallback(() => {
    send(MSG_CANVAS_REDO, {})
  }, [send])

  return { shapes, viewports, connected, addShape, moveShape, resizeShape, deleteShape, updateShape, setViewport, undo, redo }
}
