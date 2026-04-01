/**
 * Cron / scheduled task tests for the dispatch worker.
 *
 * Tests shouldRunTask directly (now exported from worker.ts) and validates
 * CRON_TASKS KV operations used by the scheduled handler.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'
import { shouldRunTask, type CronTask } from '../worker'

// ===========================================================================
// shouldRunTask unit tests
// ===========================================================================

describe('shouldRunTask', () => {
  it('returns true when enough time has elapsed past the interval', () => {
    const task: CronTask = {
      name: 'cleanup',
      intervalMinutes: 5,
      lastRun: 1000,
    }
    // 5 minutes = 300_000ms. lastRun=1000, now=301_001 => elapsed=300_001 >= 300_000
    expect(shouldRunTask(task, 301_001)).toBe(true)
  })

  it('returns true when exactly at the interval boundary', () => {
    const task: CronTask = {
      name: 'cleanup',
      intervalMinutes: 10,
      lastRun: 0,
    }
    // 10 minutes = 600_000ms
    expect(shouldRunTask(task, 600_000)).toBe(true)
  })

  it('returns true with large elapsed time', () => {
    const task: CronTask = {
      name: 'sync',
      intervalMinutes: 1,
      lastRun: 0,
    }
    // Way past the interval
    expect(shouldRunTask(task, 10_000_000)).toBe(true)
  })

  it('returns false when interval has not yet been reached', () => {
    const task: CronTask = {
      name: 'cleanup',
      intervalMinutes: 5,
      lastRun: 1000,
    }
    // 5 minutes = 300_000ms. lastRun=1000, now=200_000 => elapsed=199_000 < 300_000
    expect(shouldRunTask(task, 200_000)).toBe(false)
  })

  it('returns false when just under the interval', () => {
    const task: CronTask = {
      name: 'sync',
      intervalMinutes: 1,
      lastRun: 0,
    }
    // 1 minute = 60_000ms. now=59_999 => not yet
    expect(shouldRunTask(task, 59_999)).toBe(false)
  })

  it('returns false for schedule-based tasks (not yet implemented)', () => {
    const task: CronTask = {
      name: 'weekly-report',
      schedule: '0 9 * * MON',
      timezone: 'America/New_York',
      lastRun: 0,
    }
    // schedule-based tasks always return false currently
    expect(shouldRunTask(task, Date.now())).toBe(false)
  })

  it('returns false when neither intervalMinutes nor schedule is set', () => {
    const task: CronTask = {
      name: 'orphan-task',
      lastRun: 0,
    }
    expect(shouldRunTask(task, Date.now())).toBe(false)
  })

  it('handles intervalMinutes of 0 (always runs)', () => {
    const task: CronTask = {
      name: 'always-run',
      intervalMinutes: 0,
      lastRun: Date.now(),
    }
    // 0 minutes = 0ms interval. Any elapsed time >= 0 is true
    expect(shouldRunTask(task, Date.now())).toBe(true)
  })
})

// ===========================================================================
// CRON_TASKS KV integration tests
// ===========================================================================

describe('CRON_TASKS KV', () => {
  beforeEach(async () => {
    const list = await env.CRON_TASKS.list()
    for (const key of list.keys) {
      await env.CRON_TASKS.delete(key.name)
    }
  })

  it('can store and retrieve a cron config', async () => {
    const config = {
      ownerUserId: 'user-123',
      tasks: [
        {
          name: 'cleanup',
          intervalMinutes: 5,
          lastRun: 0,
        },
      ],
    }

    await env.CRON_TASKS.put('my-app', JSON.stringify(config))
    const raw = await env.CRON_TASKS.get('my-app')
    expect(raw).not.toBeNull()

    const parsed = JSON.parse(raw!)
    expect(parsed.ownerUserId).toBe('user-123')
    expect(parsed.tasks).toHaveLength(1)
    expect(parsed.tasks[0].name).toBe('cleanup')
  })

  it('lists all registered cron apps', async () => {
    await env.CRON_TASKS.put('app-a', JSON.stringify({
      ownerUserId: 'user-1',
      tasks: [{ name: 'task-1', intervalMinutes: 10, lastRun: 0 }],
    }))
    await env.CRON_TASKS.put('app-b', JSON.stringify({
      ownerUserId: 'user-2',
      tasks: [{ name: 'task-2', intervalMinutes: 30, lastRun: 0 }],
    }))

    const list = await env.CRON_TASKS.list()
    const names = list.keys.map(k => k.name).sort()
    expect(names).toEqual(['app-a', 'app-b'])
  })

  it('handles empty cron registry', async () => {
    const list = await env.CRON_TASKS.list()
    expect(list.keys).toHaveLength(0)
  })
})
