import type { CronContext } from 'deepspace/worker'

/**
 * Cron Handler
 *
 * Tasks are declared in cron.json. This file implements the handler.
 * The platform calls handler() on schedule.
 *
 * Two scheduling modes (each task uses one):
 *
 * 1. Interval mode — { "name": "...", "intervalMinutes": 60 }
 *    Runs every N minutes from last execution.
 *    Examples: 1440 = daily, 60 = hourly, 30 = every 30 min, 10080 = weekly
 *
 * 2. Cron expression mode — { "name": "...", "schedule": "0 9 * * 1-5", "timezone": "America/New_York" }
 *    Standard 5-field cron (minute hour day-of-month month day-of-week).
 *    Examples:
 *      "0 12 * * *"    = noon every day
 *      "*/15 * * * *"  = every 15 minutes
 *      "0 9 * * 1-5"  = 9 AM weekdays
 *      "0 0 1 * *"    = midnight on the 1st of each month
 */
export async function handler(taskName: string, ctx: CronContext): Promise<void> {
  switch (taskName) {
    case 'my-scheduled-task':
      await myScheduledTask(ctx)
      break
  }
}

async function myScheduledTask(ctx: CronContext): Promise<void> {
  // Example: check if today's record exists, create if not
  // const today = new Date().toISOString().split('T')[0]
  // const existing = await ctx.records.query('my_collection', { where: { date: today } })
  // if (existing.length > 0) return
  //
  // Optionally call an integration (billed to app owner):
  // const result = await ctx.integrations.call('generate-text', { model: 'gpt-4o', prompt: '...' })
  //
  // Store result (integration responses return fields directly, e.g. result.text):
  // await ctx.records.create('my_collection', { date: today, content: result.text })
}
