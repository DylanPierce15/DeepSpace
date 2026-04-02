/**
 * DeepSpace Dispatch Worker
 *
 * Routes requests from *.app.space and custom domains to per-app user workers
 * via Workers for Platforms.
 *
 * Also handles scheduled cron triggers for deployed apps.
 *
 * Routing:
 *   1. Custom domains: hostname → HOSTNAME_MAP KV lookup → app name
 *   2. Subdomains: {app}.app.space → extract "app" from subdomain
 */

import { Hono } from 'hono'
import { verifyInternalSignature, signInternalPayload, buildInternalPayload } from '@deep-space/auth'

// ============================================================================
// Types
// ============================================================================

interface Env {
  /** Workers for Platforms dispatch namespace */
  USER_APPS: { get(name: string): { fetch(request: Request): Promise<Response> } }
  /** KV: custom hostname → app name mappings */
  HOSTNAME_MAP: KVNamespace
  /** KV: cron task registry per app */
  CRON_TASKS: KVNamespace
  /** HMAC secret for internal auth (cron triggers) */
  INTERNAL_STORAGE_HMAC_SECRET?: string
  /** Analytics Engine for traffic monitoring */
  MINIAPP_ANALYTICS?: AnalyticsEngineDataset
}

export interface CronTask {
  name: string
  intervalMinutes?: number
  schedule?: string
  timezone?: string
  lastRun: number
}

interface CronConfig {
  ownerUserId: string
  tasks: CronTask[]
}

// ============================================================================
// Constants
// ============================================================================

const PRIMARY_DOMAIN = 'app.space'

export const RESERVED_SUBDOMAINS = new Set([
  'www',
  'api',
  'auth',
  'console',
  'platform',
  'admin',
  'dashboard',
  'mail',
  'docs',
  'blog',
  'status',
  'cdn',
  'assets',
  'static',
  'ws',
  'wss',
])

// ============================================================================
// Helpers
// ============================================================================

export function extractAppFromSubdomain(hostname: string): string | null {
  if (hostname.endsWith(`.${PRIMARY_DOMAIN}`)) {
    const parts = hostname.split('.')
    // subdomain.app.space = 3 parts
    if (parts.length >= 3) {
      const subdomain = parts[0]
      if (subdomain && !RESERVED_SUBDOMAINS.has(subdomain)) {
        return subdomain
      }
    }
  }
  return null
}

export function isRootDomain(hostname: string): boolean {
  return hostname === PRIMARY_DOMAIN || hostname === `www.${PRIMARY_DOMAIN}`
}

// ============================================================================
// Cron Handling
// ============================================================================

export function shouldRunTask(task: CronTask, nowMs: number): boolean {
  if (task.intervalMinutes != null) {
    const intervalMs = task.intervalMinutes * 60_000
    return nowMs - task.lastRun >= intervalMs
  }
  if (task.schedule) {
    // Simple cron matching — for production, use a proper cron parser
    // For now, interval-based tasks are the primary use case
    return false
  }
  return false
}

async function triggerCron(
  env: Env,
  appName: string,
  taskName: string,
  ownerUserId: string,
): Promise<void> {
  if (!env.INTERNAL_STORAGE_HMAC_SECRET) return

  try {
    const worker = env.USER_APPS.get(appName)
    const body = JSON.stringify({ task: taskName, userId: ownerUserId })
    const { timestamp, signature } = await signInternalPayload({
      secret: env.INTERNAL_STORAGE_HMAC_SECRET,
      payload: body,
    })

    await worker.fetch(
      new Request(`https://${appName}.${PRIMARY_DOMAIN}/internal/cron`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-timestamp': timestamp,
          'x-internal-signature': signature,
        },
        body,
      }),
    )
  } catch (e) {
    console.error(`[Dispatch] Cron trigger failed for ${appName}/${taskName}:`, e)
  }
}

async function handleScheduled(env: Env): Promise<void> {
  const nowMs = Date.now()
  const list = await env.CRON_TASKS.list()

  for (const key of list.keys) {
    const appName = key.name
    const raw = await env.CRON_TASKS.get(appName)
    if (!raw) continue

    const config: CronConfig = JSON.parse(raw)
    let changed = false

    for (const task of config.tasks) {
      if (shouldRunTask(task, nowMs)) {
        await triggerCron(env, appName, task.name, config.ownerUserId)
        task.lastRun = nowMs
        changed = true
      }
    }

    if (changed) {
      await env.CRON_TASKS.put(appName, JSON.stringify(config))
    }
  }
}

// ============================================================================
// Hono App
// ============================================================================

const app = new Hono<{ Bindings: Env }>()

app.all('*', async (c) => {
  const url = new URL(c.req.url)
  const hostname = url.hostname

  // Root domain → redirect to main site
  if (isRootDomain(hostname)) {
    return c.redirect('https://deep.space', 302)
  }

  // Try subdomain routing first
  let appName = extractAppFromSubdomain(hostname)

  // Fall back to custom domain KV lookup
  if (!appName) {
    appName = await c.env.HOSTNAME_MAP.get(hostname)
  }

  if (!appName) {
    return c.json({ error: 'App not found' }, 404)
  }

  // Track analytics
  c.env.MINIAPP_ANALYTICS?.writeDataPoint({
    blobs: [appName, hostname, url.pathname],
    doubles: [1],
  })

  // Dispatch to per-app worker
  try {
    const worker = c.env.USER_APPS.get(appName)
    return worker.fetch(c.req.raw)
  } catch (e) {
    console.error(`[Dispatch] Failed to route to ${appName}:`, e)
    return c.json({ error: 'App unavailable' }, 502)
  }
})

// ============================================================================
// Export with cron handler
// ============================================================================

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduled(env))
  },
}
