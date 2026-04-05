/**
 * useCronMonitor — Connect to a CronRoom for monitoring scheduled tasks.
 *
 * Opens a WebSocket to /cron/:roomId for real-time task status.
 *
 * @example
 * const { tasks, history, trigger, pause, resume } = useCronMonitor('cron')
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getAuthToken } from '../../auth'
import {
  MSG_CRON_TASKS,
  MSG_CRON_HISTORY,
  MSG_CRON_TRIGGER,
  MSG_CRON_PAUSE,
  MSG_CRON_RESUME,
  MSG_CRON_STATUS,
} from '@/shared/protocol/constants'

export interface CronTaskState {
  name: string
  intervalMinutes: number | null
  schedule: string | null
  timezone: string | null
  paused: boolean
  lastRunAt: string | null
  nextRunAt: string | null
}

export interface CronHistoryEntry {
  taskName: string
  startedAt: string
  completedAt: string | null
  success: boolean
  durationMs: number
  error?: string
}

export interface UseCronMonitorResult {
  /** Current task states */
  tasks: CronTaskState[]
  /** Execution history */
  history: CronHistoryEntry[]
  /** Whether WebSocket is connected */
  connected: boolean
  /** Manually trigger a task */
  trigger: (taskName: string) => void
  /** Pause a task */
  pause: (taskName: string) => void
  /** Resume a paused task */
  resume: (taskName: string) => void
}

export function useCronMonitor(roomId: string): UseCronMonitorResult {
  const [tasks, setTasks] = useState<CronTaskState[]>([])
  const [history, setHistory] = useState<CronHistoryEntry[]>([])
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
      const url = new URL(`/cron/${encodeURIComponent(roomId)}`, baseUrl)
      if (token) url.searchParams.set('token', token)

      ws = new WebSocket(url.toString())
      wsRef.current = ws

      ws.onopen = () => setConnected(true)

      ws.onmessage = (event) => {
        if (typeof event.data !== 'string') return
        try {
          const msg = JSON.parse(event.data) as { type: number; payload: Record<string, unknown> }
          switch (msg.type) {
            case MSG_CRON_TASKS:
              setTasks(msg.payload.tasks as CronTaskState[])
              break
            case MSG_CRON_HISTORY:
              setHistory(msg.payload.history as CronHistoryEntry[])
              break
            case MSG_CRON_STATUS:
              setTasks(msg.payload.tasks as CronTaskState[])
              if (msg.payload.recentHistory) {
                setHistory(msg.payload.recentHistory as CronHistoryEntry[])
              }
              break
          }
        } catch { /* ignore */ }
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

  const trigger = useCallback((taskName: string) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: MSG_CRON_TRIGGER, payload: { taskName } }))
  }, [])

  const pause = useCallback((taskName: string) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: MSG_CRON_PAUSE, payload: { taskName } }))
  }, [])

  const resume = useCallback((taskName: string) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: MSG_CRON_RESUME, payload: { taskName } }))
  }, [])

  return { tasks, history, connected, trigger, pause, resume }
}
