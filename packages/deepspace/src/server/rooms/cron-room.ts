/**
 * CronRoom — Scheduled task execution Durable Object.
 *
 * Extends BaseRoom. Replaces the old cron-schedule feature with a proper DO.
 * Uses DO alarm for scheduling, tracks execution history, supports monitoring
 * via admin WebSocket connection.
 *
 * Message types: 120-139 (MSG_CRON_*)
 */

/// <reference types="@cloudflare/workers-types" />

import { BaseRoom, type UserAttachment } from './base-room'
import {
  MSG_CRON_TASKS,
  MSG_CRON_HISTORY,
  MSG_CRON_TRIGGER,
  MSG_CRON_PAUSE,
  MSG_CRON_RESUME,
  MSG_CRON_STATUS,
  MSG_ERROR,
} from '../../shared/protocol/constants'

// ============================================================================
// Types
// ============================================================================

export interface CronTask {
  name: string
  /** Interval in minutes (simple mode) */
  intervalMinutes?: number
  /** 5-field cron expression (cron mode) */
  schedule?: string
  /** IANA timezone (cron mode) */
  timezone?: string
  /** Whether the task is paused */
  paused?: boolean
}

export interface CronRoomConfig {
  tasks: CronTask[]
}

export interface CronExecution {
  taskName: string
  startedAt: string
  completedAt: string | null
  success: boolean
  durationMs: number
  error?: string
}

// ============================================================================
// CronRoom
// ============================================================================

export abstract class CronRoom extends BaseRoom {
  private tasks: CronTask[]
  private initialized = false

  constructor(
    state: DurableObjectState,
    env: unknown,
    config: CronRoomConfig
  ) {
    super(state, env)
    this.tasks = config.tasks
  }

  private ensureInitialized(): void {
    if (this.initialized) return
    this.initialized = true

    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS cron_tasks (
        name TEXT PRIMARY KEY,
        interval_minutes INTEGER,
        schedule TEXT,
        timezone TEXT,
        paused INTEGER NOT NULL DEFAULT 0,
        last_run_at TEXT,
        next_run_at TEXT
      )
    `)

    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS cron_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_name TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        success INTEGER NOT NULL DEFAULT 0,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        created_at TEXT NOT NULL
      )
    `)

    // Sync configured tasks into DB
    for (const task of this.tasks) {
      const existing = this.sql.exec(
        `SELECT name FROM cron_tasks WHERE name = ?`, task.name
      ).toArray()
      if (existing.length === 0) {
        this.sql.exec(
          `INSERT INTO cron_tasks (name, interval_minutes, schedule, timezone, paused)
           VALUES (?, ?, ?, ?, ?)`,
          task.name,
          task.intervalMinutes ?? null,
          task.schedule ?? null,
          task.timezone ?? null,
          task.paused ? 1 : 0,
        )
      }
    }

    // Remove tasks no longer in config
    const configNames = new Set(this.tasks.map(t => t.name))
    const dbTasks = this.sql.exec(`SELECT name FROM cron_tasks`).toArray()
    for (const row of dbTasks) {
      if (!configNames.has((row as { name: string }).name)) {
        this.sql.exec(`DELETE FROM cron_tasks WHERE name = ?`, (row as { name: string }).name)
      }
    }

    // Schedule the next alarm
    this.scheduleNextAlarm()
  }

  // ==========================================================================
  // BaseRoom Lifecycle
  // ==========================================================================

  async fetch(request: Request): Promise<Response> {
    this.ensureInitialized()
    return super.fetch(request)
  }

  protected onConnect(ws: WebSocket, user: UserAttachment): UserAttachment {
    this.ensureInitialized()

    // Send current task list and recent history
    this.sendTo(ws, {
      type: MSG_CRON_TASKS,
      payload: { tasks: this.getTaskStates() },
    })

    this.sendTo(ws, {
      type: MSG_CRON_HISTORY,
      payload: { history: this.getRecentHistory(50) },
    })

    return user
  }

  protected async onMessage(
    ws: WebSocket,
    user: UserAttachment,
    message: { type: number; [key: string]: unknown }
  ): Promise<void> {
    this.ensureInitialized()
    const { type, payload } = message as { type: number; payload: Record<string, unknown> }

    switch (type) {
      case MSG_CRON_TRIGGER: {
        const taskName = payload.taskName as string
        if (!taskName) {
          this.sendTo(ws, { type: MSG_ERROR, payload: { error: 'Missing taskName' } })
          return
        }
        await this.executeTask(taskName)
        break
      }

      case MSG_CRON_PAUSE: {
        const taskName = payload.taskName as string
        this.sql.exec(`UPDATE cron_tasks SET paused = 1 WHERE name = ?`, taskName)
        this.broadcastStatus()
        break
      }

      case MSG_CRON_RESUME: {
        const taskName = payload.taskName as string
        this.sql.exec(`UPDATE cron_tasks SET paused = 0 WHERE name = ?`, taskName)
        this.scheduleNextAlarm()
        this.broadcastStatus()
        break
      }

      case MSG_CRON_TASKS: {
        this.sendTo(ws, {
          type: MSG_CRON_TASKS,
          payload: { tasks: this.getTaskStates() },
        })
        break
      }

      case MSG_CRON_HISTORY: {
        const limit = (payload.limit as number) ?? 50
        this.sendTo(ws, {
          type: MSG_CRON_HISTORY,
          payload: { history: this.getRecentHistory(limit) },
        })
        break
      }

      default:
        this.sendTo(ws, { type: MSG_ERROR, payload: { error: `Unknown cron message type: ${type}` } })
    }
  }

  protected async onAlarm(): Promise<void> {
    this.ensureInitialized()
    const now = new Date()

    // Find all tasks due to run
    const tasks = this.sql.exec(
      `SELECT * FROM cron_tasks WHERE paused = 0 AND (next_run_at IS NULL OR next_run_at <= ?)`,
      now.toISOString()
    ).toArray()

    for (const row of tasks) {
      const task = row as { name: string; interval_minutes: number | null; schedule: string | null; timezone: string | null }
      await this.executeTask(task.name)
    }

    this.scheduleNextAlarm()
  }

  // ==========================================================================
  // Task Execution
  // ==========================================================================

  private async executeTask(taskName: string): Promise<void> {
    const startedAt = new Date().toISOString()
    const start = Date.now()
    let success = true
    let error: string | undefined

    try {
      await this.onTask(taskName)
    } catch (e) {
      success = false
      error = e instanceof Error ? e.message : String(e)
      console.error(`[CronRoom] Task "${taskName}" failed:`, e)
    }

    const durationMs = Date.now() - start
    const completedAt = new Date().toISOString()

    // Record execution
    this.sql.exec(
      `INSERT INTO cron_history (task_name, started_at, completed_at, success, duration_ms, error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      taskName, startedAt, completedAt, success ? 1 : 0, durationMs, error ?? null, completedAt,
    )

    // Update last_run_at and compute next_run_at
    const taskRow = this.sql.exec(
      `SELECT interval_minutes, schedule, timezone FROM cron_tasks WHERE name = ?`, taskName
    ).toArray()[0] as { interval_minutes: number | null; schedule: string | null; timezone: string | null } | undefined

    if (taskRow) {
      let nextRunAt: string | null = null
      if (taskRow.interval_minutes) {
        nextRunAt = new Date(Date.now() + taskRow.interval_minutes * 60 * 1000).toISOString()
      }
      this.sql.exec(
        `UPDATE cron_tasks SET last_run_at = ?, next_run_at = ? WHERE name = ?`,
        completedAt, nextRunAt, taskName,
      )
    }

    // Trim history to last 500 entries
    this.sql.exec(`DELETE FROM cron_history WHERE id NOT IN (SELECT id FROM cron_history ORDER BY id DESC LIMIT 500)`)

    // Broadcast update to monitors
    this.broadcastStatus()
  }

  // ==========================================================================
  // Scheduling
  // ==========================================================================

  private scheduleNextAlarm(): void {
    const now = Date.now()
    let earliestMs = Infinity

    const tasks = this.sql.exec(
      `SELECT interval_minutes, next_run_at FROM cron_tasks WHERE paused = 0`
    ).toArray()

    for (const row of tasks) {
      const t = row as { interval_minutes: number | null; next_run_at: string | null }
      if (t.next_run_at) {
        const nextMs = new Date(t.next_run_at).getTime()
        if (nextMs < earliestMs) earliestMs = nextMs
      } else if (t.interval_minutes) {
        // No next_run_at yet — run immediately
        earliestMs = now
        break
      }
    }

    if (earliestMs < Infinity) {
      const alarmTime = Math.max(earliestMs, now + 1000) // At least 1s from now
      this.state.storage.setAlarm(alarmTime)
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private getTaskStates(): Record<string, unknown>[] {
    return this.sql.exec(`SELECT * FROM cron_tasks`).toArray().map(row => {
      const r = row as Record<string, unknown>
      return {
        name: r.name,
        intervalMinutes: r.interval_minutes,
        schedule: r.schedule,
        timezone: r.timezone,
        paused: r.paused === 1,
        lastRunAt: r.last_run_at,
        nextRunAt: r.next_run_at,
      }
    })
  }

  private getRecentHistory(limit: number): CronExecution[] {
    return this.sql.exec(
      `SELECT * FROM cron_history ORDER BY id DESC LIMIT ?`, limit
    ).toArray().map(row => {
      const r = row as Record<string, unknown>
      return {
        taskName: r.task_name as string,
        startedAt: r.started_at as string,
        completedAt: r.completed_at as string | null,
        success: r.success === 1,
        durationMs: r.duration_ms as number,
        error: r.error as string | undefined,
      }
    })
  }

  private broadcastStatus(): void {
    this.broadcast({
      type: MSG_CRON_STATUS,
      payload: {
        tasks: this.getTaskStates(),
        recentHistory: this.getRecentHistory(10),
      },
    })
  }

  // ==========================================================================
  // Lifecycle Hook (subclass implements)
  // ==========================================================================

  /**
   * Execute a scheduled task by name.
   * Called both by the alarm scheduler and manual trigger.
   */
  protected abstract onTask(taskName: string): void | Promise<void>
}
