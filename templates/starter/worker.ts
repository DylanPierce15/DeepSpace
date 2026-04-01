/**
 * Site Worker — Hono-based Cloudflare Worker for DeepSpace apps.
 *
 * Deployed per-app via Workers for Platforms. Handles:
 *   - Auth proxy → auth-worker (same-origin cookies)
 *   - WebSocket proxy to platform-worker (RecordRoom)
 *   - Server actions (app-defined, bypass user RBAC)
 *   - Scoped R2 file storage
 *   - McAPI proxy (integrations)
 *   - HMAC-authenticated cron
 *   - Platform worker proxy
 *   - Static asset serving with SPA fallback
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  verifyJwt,
  verifyInternalSignature,
  buildInternalPayload,
  signInternalPayload,
} from '@deepspace/auth'
import type { JwtVerifierConfig, VerifyResult } from '@deepspace/auth'
import {
  createScopedR2Handler,
  handleMcAPIProxy,
  type ScopedR2Handler,
} from '@deepspace/sdk-worker'
import type { ActionHandler, ActionTools, ActionResult } from '@deepspace/types'
import { actions } from './src/actions/index.js'
import { handleCron } from './src/cron.js'

// =============================================================================
// Types
// =============================================================================

interface Env {
  ASSETS: Fetcher
  FILES: R2Bucket
  PLATFORM_WORKER: Fetcher
  AUTH_JWT_PUBLIC_KEY: string
  AUTH_JWT_ISSUER: string
  AUTH_WORKER_URL: string
  APP_NAME: string
  OWNER_USER_ID: string
  INTERNAL_STORAGE_HMAC_SECRET: string
}

type AppContext = { Bindings: Env; Variables: { auth: VerifyResult | null } }

// =============================================================================
// App
// =============================================================================

const app = new Hono<AppContext>()

// CORS for API routes
app.use('/api/*', cors())

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

function jwtConfig(env: Env): JwtVerifierConfig {
  return { publicKey: env.AUTH_JWT_PUBLIC_KEY, issuer: env.AUTH_JWT_ISSUER }
}

async function resolveAuth(
  req: Request,
  env: Env,
): Promise<VerifyResult | null> {
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null

  if (!token) return null

  const outcome = await verifyJwt(jwtConfig(env), token)
  return outcome.result
}

// ---------------------------------------------------------------------------
// Auth proxy → auth-worker (same-origin cookies)
// ---------------------------------------------------------------------------

app.all('/api/auth/*', async (c) => {
  const url = new URL(c.req.url)
  const authUrl = new URL(url.pathname + url.search, c.env.AUTH_WORKER_URL)

  const res = await fetch(authUrl.toString(), {
    method: c.req.method,
    headers: c.req.raw.headers,
    body: c.req.method !== 'GET' && c.req.method !== 'HEAD'
      ? c.req.raw.body
      : undefined,
  })

  // Forward the response including set-cookie headers
  // Rewrite cookie domain so it's same-origin with the app
  const headers = new Headers(res.headers)
  const setCookie = headers.get('set-cookie')
  if (setCookie) {
    // Remove Domain= attribute so cookie defaults to current host (same-origin)
    const rewritten = setCookie.replace(/;\s*Domain=[^;]*/gi, '')
    headers.set('set-cookie', rewritten)
  }

  return new Response(res.body, {
    status: res.status,
    headers,
  })
})

// ---------------------------------------------------------------------------
// WebSocket proxy → platform-worker
// ---------------------------------------------------------------------------

app.get('/ws/:roomId', async (c) => {
  const url = new URL(c.req.url)
  return c.env.PLATFORM_WORKER.fetch(
    new Request(url.toString(), c.req.raw),
  )
})

// ---------------------------------------------------------------------------
// Server actions
// ---------------------------------------------------------------------------

app.post('/api/actions/:name', async (c) => {
  const auth = await resolveAuth(c.req.raw, c.env)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)

  const name = c.req.param('name')
  const action = actions[name]
  if (!action) return c.json({ error: 'Action not found' }, 404)

  const params = await c.req.json<Record<string, unknown>>()
  const tools = createActionTools(c.env, auth.userId)
  const result = await action({ userId: auth.userId, params, tools })
  return c.json(result)
})

// ---------------------------------------------------------------------------
// Scoped R2 files
// ---------------------------------------------------------------------------

const r2Handler: Record<string, ScopedR2Handler> = {}

function getR2Handler(env: Env): ScopedR2Handler {
  if (!r2Handler[env.APP_NAME]) {
    r2Handler[env.APP_NAME] = createScopedR2Handler({
      resolvePrefix(scope, ctx) {
        if (scope === 'app') {
          return { prefix: `apps/${env.APP_NAME}/` }
        }
        if (!ctx.userId) {
          return { error: 'Authentication required for user files' }
        }
        return { prefix: `apps/${env.APP_NAME}/users/${ctx.userId}/` }
      },
    })
  }
  return r2Handler[env.APP_NAME]
}

app.all('/api/files/*', async (c) => {
  const auth = await resolveAuth(c.req.raw, c.env)
  const handler = getR2Handler(c.env)
  const url = new URL(c.req.url)
  return handler(c.req.raw, url, c.env.FILES, {
    userId: auth?.userId ?? null,
  })
})

// ---------------------------------------------------------------------------
// McAPI proxy → api-worker
// ---------------------------------------------------------------------------

app.all('/api/mcapi/*', async (c) => {
  const url = new URL(c.req.url)
  return handleMcAPIProxy(c.req.raw, url)
})

// ---------------------------------------------------------------------------
// Internal cron (HMAC-authenticated)
// ---------------------------------------------------------------------------

app.post('/internal/cron', async (c) => {
  const body = await c.req.text()
  const payload = buildInternalPayload(body)
  const signature = c.req.header('x-internal-signature') ?? ''
  const timestamp = c.req.header('x-internal-timestamp') ?? ''

  const valid = await verifyInternalSignature({
    secret: c.env.INTERNAL_STORAGE_HMAC_SECRET,
    payload,
    signature,
    timestamp,
  })

  if (!valid) return c.json({ error: 'Forbidden' }, 403)

  const parsed = JSON.parse(body)
  await handleCron(parsed)
  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Platform worker proxy
// ---------------------------------------------------------------------------

app.all('/platform/*', async (c) => {
  return c.env.PLATFORM_WORKER.fetch(c.req.raw)
})

// ---------------------------------------------------------------------------
// Static assets (SPA fallback)
// ---------------------------------------------------------------------------

app.get('*', async (c) => {
  const response = await c.env.ASSETS.fetch(c.req.raw)
  if (response.status === 404) {
    const url = new URL(c.req.url)
    url.pathname = '/index.html'
    return c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw))
  }
  return response
})

// =============================================================================
// Action Tools — proxy to platform-worker with app trust
// =============================================================================

function createActionTools(env: Env, userId: string): ActionTools {
  const scopeId = `app:${env.APP_NAME}`

  async function toolRequest(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<ActionResult> {
    const payload = body ? JSON.stringify(body) : '{}'
    const { timestamp, signature } = await signInternalPayload({
      secret: env.INTERNAL_STORAGE_HMAC_SECRET,
      payload: buildInternalPayload(body),
    })

    const res = await env.PLATFORM_WORKER.fetch(
      new Request(`https://internal/platform/api/tools/${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
          'x-app-action': 'true',
          'x-internal-timestamp': timestamp,
          'x-internal-signature': signature,
        },
        body: payload,
      }),
    )

    return res.json() as Promise<ActionResult>
  }

  return {
    create(sid, collection, data) {
      return toolRequest('POST', 'records/create', { scopeId: sid, collection, data })
    },
    update(sid, collection, recordId, data) {
      return toolRequest('POST', 'records/update', { scopeId: sid, collection, recordId, data })
    },
    remove(sid, collection, recordId) {
      return toolRequest('POST', 'records/delete', { scopeId: sid, collection, recordId })
    },
    get(sid, collection, recordId) {
      return toolRequest('POST', 'records/get', { scopeId: sid, collection, recordId })
    },
    query(sid, collection, options) {
      return toolRequest('POST', 'records/query', { scopeId: sid, collection, ...options })
    },
  }
}

export default app
