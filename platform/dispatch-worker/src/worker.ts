/**
 * App.space Dispatch Worker
 *
 * Routes requests from *.app.space, *.spaces.site (legacy), AND custom domains
 * to the appropriate user worker.
 *
 * Also handles internal endpoints:
 *   POST /internal/og-screenshot — takes a screenshot of a deployed site
 *     and stores it in R2 for OG image serving.
 *
 * Routing methods:
 *   1. Custom domains: Looks up hostname in HOSTNAME_MAP KV
 *      e.g., spacestest.com → KV lookup → "deeptasks"
 *
 *   2. Subdomains: Extracts app name from subdomain
 *      e.g., deepsnake.app.space → "deepsnake"
 *      e.g., deepsnake.spaces.site → "deepsnake" (legacy, still supported)
 *
 * Ported from Miyagi3 `apps/miniapp-sync/dispatch/worker.ts`. The Clerk-specific
 * `/internal/widget-screenshot` handler was dropped during the port — DeepSpace
 * uses Better Auth and the screenshot-via-fake-window.parent trick does not
 * apply. Everything else is preserved.
 */

import { isReservedSubdomain } from './reservedSubdomains'
import puppeteer from '@cloudflare/puppeteer'
import { verifyInternalSignature, signInternalPayload } from 'deepspace/worker'

/** Primary domain for deployed miniapps */
const PRIMARY_DOMAIN = 'app.space'
/** Legacy domain — still routes correctly but not used for new deployments */
const LEGACY_DOMAIN = 'spaces.site'

/** Domains that support subdomain-based routing */
const PLATFORM_DOMAINS = [PRIMARY_DOMAIN, LEGACY_DOMAIN] as const

interface Env {
  // Workers for Platforms dispatch namespace
  USER_APPS: { get(name: string): { fetch(request: Request): Promise<Response> } }
  // KV namespace for custom hostname → app mappings
  HOSTNAME_MAP: KVNamespace
  // KV namespace for cron task registry
  CRON_TASKS: KVNamespace
  // Browser Rendering for OG screenshots
  BROWSER: Fetcher
  // R2 bucket for OG images
  OG_IMAGES: R2Bucket
  // HMAC secret for internal auth
  INTERNAL_STORAGE_HMAC_SECRET?: string
  // Analytics Engine for traffic monitoring (optional — not available in local dev)
  MINIAPP_ANALYTICS?: AnalyticsEngineDataset
}

/** Shape of a cron config stored in KV per app */
interface CronConfig {
  ownerUserId: string
  tasks: Array<{
    name: string
    /** Interval mode: run every N minutes from last execution */
    intervalMinutes?: number
    /** Cron mode: 5-field cron expression (minute hour day-of-month month day-of-week) */
    schedule?: string
    /** IANA timezone for cron expression (e.g. "America/New_York") */
    timezone?: string
    lastRun: number
  }>
}

/**
 * Check if the hostname is a root platform domain (e.g., app.space or spaces.site)
 */
function isRootDomain(hostname: string): boolean {
  return PLATFORM_DOMAINS.some(d => hostname === d || hostname === `www.${d}`)
}

/**
 * Extract app name from a platform subdomain.
 * Returns null if hostname is not a platform subdomain.
 */
function extractAppFromSubdomain(hostname: string): string | null {
  for (const domain of PLATFORM_DOMAINS) {
    if (hostname.endsWith(`.${domain}`)) {
      const parts = hostname.split('.')
      // At least 3 parts for subdomain.domain.tld (or subdomain.app.space)
      if (parts.length >= 3) {
        return parts[0]
      }
    }
  }
  return null
}

/**
 * Check if hostname is a platform domain (root or subdomain)
 */
function isPlatformDomain(hostname: string): boolean {
  return PLATFORM_DOMAINS.some(d => hostname === d || hostname.endsWith(`.${d}`))
}

/**
 * Write a traffic data point to Analytics Engine.
 * Non-blocking — called via ctx.waitUntil().
 */
async function writeTrafficEvent(
  analytics: AnalyticsEngineDataset,
  request: Request,
  appName: string,
  statusCode: number,
): Promise<void> {
  const cf = (request as any).cf as { country?: string } | undefined
  const ua = request.headers.get('user-agent') || ''
  const referrer = request.headers.get('referer') || ''
  let referrerOrigin = ''
  try {
    if (referrer) referrerOrigin = new URL(referrer).origin
  } catch {
    referrerOrigin = referrer.slice(0, 256)
  }

  // Hash the IP for privacy-friendly unique visitor counting
  const ip = request.headers.get('cf-connecting-ip') || ''
  let hashedIp = ''
  if (ip) {
    const encoded = new TextEncoder().encode(ip + appName)
    const hash = await crypto.subtle.digest('SHA-256', encoded)
    hashedIp = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
  }

  analytics.writeDataPoint({
    indexes: [appName],
    blobs: [
      appName,                                   // blob1
      cf?.country || 'XX',                       // blob2
      request.method,                            // blob3
      ua.slice(0, 256),                          // blob4
      referrerOrigin,                            // blob5
      request.headers.get('sec-fetch-mode') || '',  // blob6
      hashedIp,                                  // blob7
    ],
    doubles: [statusCode],
  })
}

// ============================================================================
// Cron Expression Matcher (zero dependencies)
// ============================================================================

/**
 * Parse a single cron field into the set of valid integer values.
 * Supports: * (all), N (literal), N-M (range), N-M/S (range with step), * /S (every S), N,M,... (list)
 */
function parseCronField(field: string, min: number, max: number): Set<number> {
  const result = new Set<number>()

  for (const part of field.split(',')) {
    const trimmed = part.trim()

    if (trimmed === '*') {
      for (let i = min; i <= max; i++) result.add(i)
      continue
    }

    // */step
    const allStep = trimmed.match(/^\*\/(\d+)$/)
    if (allStep) {
      const step = parseInt(allStep[1], 10)
      for (let i = min; i <= max; i += step) result.add(i)
      continue
    }

    // range or range/step: N-M or N-M/S
    const rangeMatch = trimmed.match(/^(\d+)-(\d+)(\/(\d+))?$/)
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10)
      const end = parseInt(rangeMatch[2], 10)
      const step = rangeMatch[4] ? parseInt(rangeMatch[4], 10) : 1
      for (let i = start; i <= end; i += step) result.add(i)
      continue
    }

    // literal number
    const num = parseInt(trimmed, 10)
    if (!isNaN(num) && num >= min && num <= max) {
      result.add(num)
    }
  }

  return result
}

/**
 * Check if the current time (in the given IANA timezone) matches a 5-field cron expression.
 *
 * Fields: minute hour day-of-month month day-of-week
 * Day-of-week: 0=Sunday, 6=Saturday (standard cron)
 *
 * Uses Intl.DateTimeFormat for timezone conversion — no dependencies, works in CF Workers.
 */
function cronMatches(expression: string, timezone: string, now?: Date): boolean {
  const date = now || new Date()

  // Convert to target timezone using Intl.DateTimeFormat
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false,
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map(p => [p.type, p.value])
  )

  const minute = parseInt(parts.minute, 10)
  const hour = parseInt(parts.hour, 10) % 24 // Guard: some envs report midnight as 24
  const dayOfMonth = parseInt(parts.day, 10)
  const month = parseInt(parts.month, 10)
  // Map weekday abbreviation to 0-6 (Sun-Sat)
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const dayOfWeek = weekdayMap[parts.weekday] ?? 0

  const fields = expression.trim().split(/\s+/)
  if (fields.length !== 5) return false

  const [cronMin, cronHour, cronDom, cronMonth, cronDow] = fields

  return (
    parseCronField(cronMin, 0, 59).has(minute) &&
    parseCronField(cronHour, 0, 23).has(hour) &&
    parseCronField(cronDom, 1, 31).has(dayOfMonth) &&
    parseCronField(cronMonth, 1, 12).has(month) &&
    parseCronField(cronDow, 0, 6).has(dayOfWeek)
  )
}

/**
 * CRON_TASKS KV keys come in two shapes:
 *   - `cron:{appName}` — written by DeepSpace's deploy-worker
 *   - `{appName}`      — written by Miyagi's legacy deployer
 * The dispatcher accepts both so a single running worker can serve both
 * platforms' apps during the cross-over period.
 */
function cronKeyToAppName(keyName: string): string {
  return keyName.startsWith('cron:') ? keyName.slice(5) : keyName
}

export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const now = Date.now()
    let list: KVNamespaceListResult<unknown>

    try {
      list = await env.CRON_TASKS.list()
    } catch (err) {
      console.error('[CRON] Failed to list CRON_TASKS KV:', err)
      return
    }

    for (const key of list.keys) {
      let config: CronConfig | null
      try {
        config = await env.CRON_TASKS.get(key.name, 'json') as CronConfig | null
      } catch (err) {
        console.error(`[CRON] Failed to read config for ${key.name}:`, err)
        continue
      }

      if (!config?.tasks) continue

      const appName = cronKeyToAppName(key.name)

      for (const task of config.tasks) {
        let shouldFire = false

        if (task.schedule && task.timezone) {
          // Cron expression mode: check if current time in timezone matches the expression.
          // Dedup: only fire if lastRun is older than 60s (dispatch runs every minute).
          const elapsed = now - (task.lastRun || 0)
          if (elapsed >= 60_000 && cronMatches(task.schedule, task.timezone)) {
            shouldFire = true
          }
        } else if (task.intervalMinutes) {
          // Interval mode: fire every N minutes from last execution
          const elapsed = now - (task.lastRun || 0)
          if (elapsed >= task.intervalMinutes * 60_000) {
            shouldFire = true
          }
        }

        if (shouldFire) {
          // Optimistic: update lastRun BEFORE triggering to prevent double-fires.
          // If the task fails, it won't retry until the next full interval / next cron match.
          // Handlers should be idempotent regardless.
          task.lastRun = now
          try {
            await env.CRON_TASKS.put(key.name, JSON.stringify(config))
          } catch (err) {
            console.error(`[CRON] Failed to update lastRun for ${key.name}/${task.name}:`, err)
            continue
          }

          ctx.waitUntil(
            triggerCronTask(env, appName, task.name, config.ownerUserId)
              .catch(err => console.error(`[CRON] ${appName}/${task.name} failed:`, err))
          )
        }
      }
    }
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const hostname = url.hostname

    // Internal endpoints (HMAC-authenticated)
    if (url.pathname === '/internal/og-screenshot' && request.method === 'POST') {
      return handleOgScreenshot(request, env)
    }

    let appName: string | null = null

    // Check if it's a root domain (app.space, spaces.site, www variants)
    if (isRootDomain(hostname)) {
      return new Response(generateLandingPage(), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    // Method 1: Extract from subdomain (for *.app.space or *.spaces.site)
    appName = extractAppFromSubdomain(hostname)

    // Method 2: Look up custom hostname in KV (for vanity domains like spacestest.com)
    if (!appName) {
      appName = await env.HOSTNAME_MAP.get(hostname)
      if (appName) {
        console.log(`Custom domain ${hostname} → app: ${appName} (from KV)`)
      }
    }

    // If we couldn't determine an app name, return 404
    if (!appName) {
      return new Response(`No app configured for ${hostname}`, { status: 404 })
    }

    // Reserved subdomains (only applies to platform domain subdomains)
    if (isPlatformDomain(hostname) && isReservedSubdomain(appName)) {
      return new Response('Reserved subdomain', { status: 403 })
    }

    try {
      // Get the user worker from the dispatch namespace
      const userWorker = env.USER_APPS.get(appName)

      // Forward the request to the user worker
      const response = await userWorker.fetch(request)

      // Track traffic (non-blocking — must never crash the request)
      if (env.MINIAPP_ANALYTICS) {
        try {
          ctx.waitUntil(writeTrafficEvent(env.MINIAPP_ANALYTICS, request, appName, response.status))
        } catch (trackErr) {
          console.error('Analytics tracking error:', trackErr)
        }
      }

      return response
    } catch (e) {
      console.error(`Error dispatching to ${appName}:`, e)

      // Track failed dispatch (non-blocking — must never crash the request)
      if (env.MINIAPP_ANALYTICS) {
        try {
          ctx.waitUntil(writeTrafficEvent(env.MINIAPP_ANALYTICS, request, appName, 404))
        } catch (trackErr) {
          console.error('Analytics tracking error:', trackErr)
        }
      }

      return new Response(`App "${appName}" not found or failed to load`, {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      })
    }
  },
}

// ============================================================================
// Cron Task Trigger
// ============================================================================

/**
 * Trigger a cron task on a user worker via HMAC-signed internal POST.
 */
async function triggerCronTask(
  env: Env,
  appName: string,
  taskName: string,
  ownerUserId: string
): Promise<void> {
  const secret = env.INTERNAL_STORAGE_HMAC_SECRET
  if (!secret) {
    throw new Error('INTERNAL_STORAGE_HMAC_SECRET not configured')
  }

  const payload = JSON.stringify({ taskName, ownerUserId })
  const { timestamp, signature } = await signInternalPayload({
    secret,
    payload,
  })

  const userWorker = env.USER_APPS.get(appName)
  const response = await userWorker.fetch(
    new Request('https://internal/internal/cron', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-timestamp': timestamp,
        'x-internal-signature': signature,
      },
      body: payload,
    })
  )

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`${appName}/${taskName} returned ${response.status}: ${errText}`)
  }

  console.log(`[CRON] ${appName}/${taskName} triggered successfully`)
}

// ============================================================================
// Shared Screenshot Helpers
// ============================================================================

/**
 * Verify HMAC internal auth on a request.
 * Returns the parsed body text on success, or a Response on failure.
 */
async function verifyInternalAuth(request: Request, env: Env): Promise<string | Response> {
  const secret = env.INTERNAL_STORAGE_HMAC_SECRET
  if (!secret) {
    return new Response('Internal auth not configured', { status: 500 })
  }

  const timestamp = request.headers.get('x-internal-timestamp')
  const signature = request.headers.get('x-internal-signature')
  if (!timestamp || !signature) {
    return new Response('Missing auth headers', { status: 401 })
  }

  const bodyText = await request.text()
  const verified = await verifyInternalSignature({
    secret,
    timestamp,
    signature,
    payload: bodyText,
  })

  if (!verified) {
    return new Response('Invalid signature', { status: 403 })
  }

  return bodyText
}

interface ScreenshotOptions {
  url: string
  viewport: { width: number; height: number }
  waitMs: number
  /** If set, runs evaluateOnNewDocument before navigating. Use a string to avoid serialization issues with minified worker code. */
  preScript?: string
  /** Query params to append to the URL */
  queryParams?: Record<string, string>
}

/**
 * Capture a screenshot using CF Browser Rendering.
 */
async function captureScreenshot(env: Env, options: ScreenshotOptions): Promise<Buffer> {
  const browser = await puppeteer.launch(env.BROWSER)
  const page = await browser.newPage()
  await page.setViewport(options.viewport)

  if (options.preScript) {
    await page.evaluateOnNewDocument(options.preScript)
  }

  const targetUrl = new URL(options.url)
  if (options.queryParams) {
    for (const [key, value] of Object.entries(options.queryParams)) {
      targetUrl.searchParams.set(key, value)
    }
  }

  await page.goto(targetUrl.toString(), { waitUntil: 'networkidle0', timeout: 30_000 })
  await new Promise(r => setTimeout(r, options.waitMs))

  const buffer = await page.screenshot({ type: 'png' }) as Buffer
  await browser.close()
  return buffer
}

// ============================================================================
// OG Screenshot Handler
// ============================================================================

/**
 * POST /internal/og-screenshot
 *
 * Accepts { url, appName } with HMAC internal auth.
 * Uses CF Browser Rendering to screenshot the deployed page at 1200×630,
 * then stores the PNG in R2 at og-images/{appName}/og-image.png.
 */
async function handleOgScreenshot(request: Request, env: Env): Promise<Response> {
  const authResult = await verifyInternalAuth(request, env)
  if (authResult instanceof Response) return authResult

  let body: { url: string; appName: string }
  try {
    body = JSON.parse(authResult)
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { url: pageUrl, appName } = body
  if (!pageUrl || !appName) {
    return new Response('Missing url or appName', { status: 400 })
  }

  try {
    const screenshotBuffer = await captureScreenshot(env, {
      url: pageUrl,
      viewport: { width: 1200, height: 630 },
      waitMs: 6000,
      queryParams: { '_og': '1' },
    })

    const r2Key = `og-images/${appName}/og-image.png`
    await env.OG_IMAGES.put(r2Key, screenshotBuffer, {
      httpMetadata: { contentType: 'image/png' },
    })

    console.log(`📸 OG screenshot stored: ${r2Key} (${screenshotBuffer.length} bytes)`)
    return Response.json({ success: true, key: r2Key, size: screenshotBuffer.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`❌ OG screenshot failed for ${appName}:`, msg)
    return Response.json({ success: false, error: msg }, { status: 500 })
  }
}

// ============================================================================
// Landing Page
// ============================================================================

function generateLandingPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>App.space · Site Hosting for Deep.Space</title>
  <link rel="icon" href="https://deep.space/miyagiring.png" type="image/png">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #000;
      color: #fff;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
    }

    /* Animated gradient background */
    .bg-gradient {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse at 20% 20%, rgba(167, 139, 250, 0.12) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 80%, rgba(139, 92, 246, 0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(88, 28, 135, 0.05) 0%, transparent 70%);
      animation: gradientShift 20s ease-in-out infinite;
    }

    @keyframes gradientShift {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }

    /* Header */
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: calc(env(safe-area-inset-top, 0px) + 16px) 24px 16px;
      position: relative;
      z-index: 10;
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .logo {
      width: 32px;
      height: 32px;
      filter: drop-shadow(0 0 8px rgba(167, 139, 250, 0.4));
      animation: logoPulse 4s ease-in-out infinite;
    }

    @keyframes logoPulse {
      0%, 100% { filter: drop-shadow(0 0 8px rgba(167, 139, 250, 0.4)); }
      50% { filter: drop-shadow(0 0 16px rgba(167, 139, 250, 0.4)) brightness(1.1); }
    }

    .logo-text {
      font-size: 15px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.95);
      letter-spacing: -0.02em;
    }

    .cta-button {
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 500;
      color: #000;
      background: rgba(255, 255, 255, 0.95);
      border: none;
      border-radius: 8px;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s ease;
      letter-spacing: 0.01em;
    }

    .cta-button:hover {
      background: rgba(255, 255, 255, 1);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(255, 255, 255, 0.2);
    }

    /* Main content */
    main {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0 24px;
      position: relative;
      z-index: 10;
      gap: 32px;
    }

    .hero-section {
      text-align: center;
      max-width: 540px;
    }

    .hero-title {
      font-size: clamp(28px, 5vw, 44px);
      font-weight: 300;
      color: rgba(255, 255, 255, 0.95);
      margin: 0 0 16px;
      letter-spacing: -0.03em;
      line-height: 1.15;
    }

    .hero-subtitle {
      font-size: clamp(14px, 2vw, 17px);
      font-weight: 400;
      color: rgba(255, 255, 255, 0.5);
      margin: 0 0 8px;
      letter-spacing: 0.01em;
      line-height: 1.6;
    }

    .hero-detail {
      font-size: clamp(12px, 1.5vw, 14px);
      font-weight: 400;
      color: rgba(255, 255, 255, 0.35);
      margin: 0;
      letter-spacing: 0.01em;
      line-height: 1.5;
    }

    .action-button {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 14px 28px;
      font-size: 15px;
      font-weight: 500;
      color: #000;
      background: rgba(255, 255, 255, 0.95);
      border: none;
      border-radius: 12px;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s ease;
      letter-spacing: 0.01em;
    }

    .action-button:hover {
      background: rgba(255, 255, 255, 1);
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(255, 255, 255, 0.15);
    }

    .action-button svg {
      width: 16px;
      height: 16px;
      transition: transform 0.2s ease;
    }

    .action-button:hover svg {
      transform: translateX(3px);
    }

    /* Footer */
    footer {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px 24px calc(env(safe-area-inset-bottom, 0px) + 24px);
      position: relative;
      z-index: 10;
    }

    .footer-content {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .badge {
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.15em;
      color: rgba(255, 255, 255, 0.3);
      text-transform: uppercase;
      padding: 3px 8px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.04);
    }

    .separator {
      color: rgba(255, 255, 255, 0.15);
      font-size: 10px;
    }

    .footer-link {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.35);
      text-decoration: none;
      transition: color 0.2s ease;
    }

    .footer-link:hover {
      color: rgba(255, 255, 255, 0.7);
    }

    /* Responsive */
    @media (max-width: 768px) {
      header {
        padding: calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px;
      }

      .logo-text {
        display: none;
      }

      main {
        padding: 0 16px;
        gap: 24px;
      }

      .hero-title {
        font-size: 28px;
      }

      .hero-subtitle {
        font-size: 14px;
      }

      footer {
        padding: 12px 16px calc(env(safe-area-inset-bottom, 0px) + 16px);
      }
    }

    @media (max-width: 480px) {
      header {
        padding: calc(env(safe-area-inset-top, 0px) + 8px) 12px 8px;
      }

      main {
        padding: 0 12px;
        gap: 20px;
      }

      .hero-title {
        font-size: 24px;
        margin-bottom: 12px;
      }

      .hero-subtitle {
        font-size: 13px;
      }

      .action-button {
        padding: 12px 24px;
        font-size: 14px;
      }

      .logo {
        width: 28px;
        height: 28px;
      }

      .cta-button {
        padding: 4px 8px;
        font-size: 11px;
        border-radius: 6px;
      }
    }

    /* Accessibility */
    @media (prefers-reduced-motion: reduce) {
      .bg-gradient,
      .logo {
        animation: none !important;
      }

      .cta-button,
      .action-button,
      .footer-link {
        transition: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="bg-gradient"></div>

  <header>
    <div class="logo-container">
      <img src="https://deep.space/miyagiring.png" alt="App.space" class="logo">
      <span class="logo-text">App.space</span>
    </div>
    <a href="https://deep.space" class="cta-button">Go to Deep.Space</a>
  </header>

  <main>
    <div class="hero-section">
      <h1 class="hero-title">Widget Hosting</h1>
      <p class="hero-subtitle">
        App.space hosts widgets and mini-apps created on Deep.Space. Each widget gets its own subdomain.
      </p>
      <p class="hero-detail">
        Looking for a specific widget? Visit its subdomain directly, like <strong>yourwidget.app.space</strong>
      </p>
    </div>

    <a href="https://deep.space" class="action-button">
      Build a Widget
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
      </svg>
    </a>
  </main>

  <footer>
    <div class="footer-content">
      <span class="badge">POWERED BY DEEP.SPACE</span>
      <span class="separator">•</span>
      <a href="https://deep.space/terms" class="footer-link">Terms</a>
      <span class="separator">•</span>
      <a href="https://deep.space/privacy" class="footer-link">Privacy</a>
    </div>
  </footer>
</body>
</html>`
}
