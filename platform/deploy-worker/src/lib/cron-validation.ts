/**
 * Cron config validation for deploy-time task registration.
 *
 * Validates the cron.json structure that apps include to register scheduled tasks.
 * The validated config is written to the dispatch worker's CRON_TASKS KV namespace
 * so it can poll and trigger tasks on schedule.
 *
 * Mirrors the Miyagi3 cronJsonSchema rules without requiring a Zod dependency.
 */

// ============================================================================
// Types
// ============================================================================

export interface CronTask {
  name: string
  intervalMinutes?: number
  schedule?: string
  timezone?: string
}

export interface CronConfig {
  tasks: CronTask[]
}

/** Stored in KV under key `cron:{appName}` */
export interface CronTaskKVEntry {
  ownerUserId: string
  tasks: Array<CronTask & { lastRun: number }>
}

export type ValidationResult = {
  success: true
  data: CronConfig
} | {
  success: false
  error: string
}

// ============================================================================
// Validation
// ============================================================================

const TASK_NAME_RE = /^[a-z0-9-]+$/

/**
 * Validate a raw cron config object (parsed from JSON).
 *
 * Rules (matching Miyagi3):
 * - tasks: array of 1-20 items (empty array is allowed for "no cron tasks")
 * - task.name: 1-64 chars, lowercase alphanumeric + hyphens
 * - task.intervalMinutes: integer 1-10080 (1 min to 1 week), optional
 * - task.schedule: cron expression string, max 128 chars, optional
 * - task.timezone: IANA timezone string, max 64 chars, optional
 * - Each task must have either intervalMinutes OR (schedule + timezone), not both/neither
 *
 * An empty tasks array is treated as "no cron tasks" and returns success
 * (the caller should skip KV write in that case).
 */
export function validateCronConfig(raw: unknown): ValidationResult {
  if (raw == null || typeof raw !== 'object') {
    return { success: false, error: 'Cron config must be a JSON object' }
  }

  const obj = raw as Record<string, unknown>

  if (!Array.isArray(obj.tasks)) {
    return { success: false, error: 'Cron config must have a "tasks" array' }
  }

  const tasks: CronTask[] = obj.tasks

  if (tasks.length > 20) {
    return { success: false, error: 'Maximum 20 cron tasks per app' }
  }

  const seenNames = new Set<string>()

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    const prefix = `tasks[${i}]`

    if (task == null || typeof task !== 'object') {
      return { success: false, error: `${prefix}: must be an object` }
    }

    // name
    if (typeof task.name !== 'string' || task.name.length < 1) {
      return { success: false, error: `${prefix}.name: required, must be a non-empty string` }
    }
    if (task.name.length > 64) {
      return { success: false, error: `${prefix}.name: maximum 64 characters` }
    }
    if (!TASK_NAME_RE.test(task.name)) {
      return { success: false, error: `${prefix}.name: must be lowercase alphanumeric with hyphens` }
    }
    if (seenNames.has(task.name)) {
      return { success: false, error: `${prefix}.name: duplicate task name "${task.name}"` }
    }
    seenNames.add(task.name)

    // intervalMinutes
    const hasInterval = task.intervalMinutes != null
    if (hasInterval) {
      if (typeof task.intervalMinutes !== 'number' || !Number.isInteger(task.intervalMinutes)) {
        return { success: false, error: `${prefix}.intervalMinutes: must be a whole number` }
      }
      if (task.intervalMinutes < 1 || task.intervalMinutes > 10080) {
        return { success: false, error: `${prefix}.intervalMinutes: must be between 1 and 10080 (1 week)` }
      }
    }

    // schedule + timezone
    const hasSchedule = task.schedule != null
    const hasTimezone = task.timezone != null
    if (hasSchedule) {
      if (typeof task.schedule !== 'string' || task.schedule.length > 128) {
        return { success: false, error: `${prefix}.schedule: must be a string, max 128 characters` }
      }
    }
    if (hasTimezone) {
      if (typeof task.timezone !== 'string' || task.timezone.length > 64) {
        return { success: false, error: `${prefix}.timezone: must be a string, max 64 characters` }
      }
    }

    // Either intervalMinutes OR (schedule + timezone), not both or neither
    const hasSchedulePair = hasSchedule && hasTimezone
    if (hasInterval && hasSchedulePair) {
      return { success: false, error: `${prefix}: must have either intervalMinutes OR schedule+timezone, not both` }
    }
    if (!hasInterval && !hasSchedulePair) {
      return { success: false, error: `${prefix}: must have either intervalMinutes OR schedule+timezone` }
    }
  }

  // Return cleaned data
  const cleanedTasks: CronTask[] = tasks.map((t) => {
    const clean: CronTask = { name: t.name }
    if (t.intervalMinutes != null) clean.intervalMinutes = t.intervalMinutes
    if (t.schedule != null) clean.schedule = t.schedule
    if (t.timezone != null) clean.timezone = t.timezone
    return clean
  })

  return { success: true, data: { tasks: cleanedTasks } }
}

/**
 * Build a KV entry from a validated cron config and owner user ID.
 */
export function buildCronKVEntry(config: CronConfig, ownerUserId: string): CronTaskKVEntry {
  return {
    ownerUserId,
    tasks: config.tasks.map((t) => ({
      ...t,
      lastRun: 0,
    })),
  }
}
