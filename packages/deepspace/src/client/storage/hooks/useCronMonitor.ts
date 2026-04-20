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
import { MSG } from '@/shared/protocol/constants'
import {
  clientBuild,
  dispatch,
  encode,
  type ServerMessage,
} from '@/shared/protocol/messages'

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
        dispatch<ServerMessage>(event.data, {
          [MSG.CRON_TASKS]: (p) => {
            setTasks(p.tasks as CronTaskState[])
          },
          [MSG.CRON_HISTORY]: (p) => {
            setHistory(p.history as CronHistoryEntry[])
          },
          [MSG.CRON_STATUS]: (p) => {
            setTasks(p.tasks as CronTaskState[])
            setHistory(p.recentHistory as CronHistoryEntry[])
          },
        })
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

  const sendBuilt = useCallback(
    <M extends { type: string; payload: unknown }>(message: M) => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      ws.send(encode(message))
    },
    [],
  )

  const trigger = useCallback(
    (taskName: string) => sendBuilt(clientBuild.cronTrigger(taskName)),
    [sendBuilt],
  )
  const pause = useCallback(
    (taskName: string) => sendBuilt(clientBuild.cronPause(taskName)),
    [sendBuilt],
  )
  const resume = useCallback(
    (taskName: string) => sendBuilt(clientBuild.cronResume(taskName)),
    [sendBuilt],
  )

  return { tasks, history, connected, trigger, pause, resume }
}
