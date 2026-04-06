/**
 * App Worker — Hono-based Cloudflare Worker for DeepSpace apps.
 *
 * Each app owns its RecordRoom DOs. Schemas are baked in at deploy time.
 *
 * Handles:
 *   - WebSocket → app's own RecordRoom DO (real-time data)
 *   - Auth proxy → auth-worker (same-origin cookies)
 *   - Server actions (app-defined, bypass user RBAC)
 *   - Scoped R2 file storage
 *   - HMAC-authenticated cron
 *   - Static asset serving with SPA fallback
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  verifyJwt,
  verifyInternalSignature,
  buildInternalPayload,
  signInternalPayload,
} from 'deepspace/worker'
import type { JwtVerifierConfig, VerifyResult } from 'deepspace/worker'
import {
  RecordRoom,
  YjsRoom,
  CanvasRoom,
  MediaRoom,
  PresenceRoom,
  createScopedR2Handler,
  type ScopedR2Handler,
} from 'deepspace/worker'
import type { ActionTools, ActionResult, DOManifest, DOBindings } from 'deepspace/worker'
import { actions } from './src/actions/index.js'
import { handleCron } from './src/cron.js'
import { schemas } from './src/schemas.js'

// =============================================================================
// DO Manifest — declares all Durable Objects for dynamic deploy bindings
// =============================================================================

export const __DO_MANIFEST__ = [
  { binding: 'RECORD_ROOMS', className: 'AppRecordRoom', sqlite: true },
  { binding: 'YJS_ROOMS', className: 'AppYjsRoom', sqlite: true },
  { binding: 'CANVAS_ROOMS', className: 'AppCanvasRoom', sqlite: true },
  { binding: 'MEDIA_ROOMS', className: 'AppMediaRoom', sqlite: true },
  { binding: 'PRESENCE_ROOMS', className: 'AppPresenceRoom', sqlite: true },
] as const satisfies DOManifest

// =============================================================================
// Durable Objects — extend to customize behavior
// =============================================================================

export class AppRecordRoom extends RecordRoom {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env, schemas, { ownerUserId: env.OWNER_USER_ID })
  }
}

export class AppYjsRoom extends YjsRoom {}
export class AppCanvasRoom extends CanvasRoom {}
export class AppMediaRoom extends MediaRoom {}
export class AppPresenceRoom extends PresenceRoom {}

// =============================================================================
// Types
// =============================================================================

interface Env extends DOBindings<typeof __DO_MANIFEST__> {
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

type AppContext = { Bindings: Env }

// =============================================================================
// App
// =============================================================================

const app = new Hono<AppContext>()
app.use('/api/*', cors())

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function jwtConfig(env: Env): JwtVerifierConfig {
  return { publicKey: env.AUTH_JWT_PUBLIC_KEY, issuer: env.AUTH_JWT_ISSUER }
}

async function resolveAuth(req: Request, env: Env): Promise<VerifyResult | null> {
  const header = req.headers.get('Authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return null
  return (await verifyJwt(jwtConfig(env), token)).result
}

// ---------------------------------------------------------------------------
// Social OAuth redirect + code exchange
// ---------------------------------------------------------------------------

/** Redirect to auth worker for social sign-in */
app.get('/api/auth/social-redirect', (c) => {
  const provider = c.req.query('provider')
  if (!provider) return c.json({ error: 'Missing provider' }, 400)

  const appOrigin = new URL(c.req.url).origin
  const authOrigin = new URL(c.env.AUTH_WORKER_URL).origin

  return c.redirect(
    `${authOrigin}/login/social?provider=${encodeURIComponent(provider)}&returnTo=${encodeURIComponent(appOrigin)}`,
  )
})

/** OAuth complete — exchange one-time code for session, redirect to app */
app.get('/api/auth/oauth-complete', async (c) => {
  const code = c.req.query('code')
  const appOrigin = new URL(c.req.url).origin

  if (!code) {
    return c.redirect(appOrigin)
  }

  // Exchange code for session token
  const res = await fetch(`${c.env.AUTH_WORKER_URL}/api/auth/exchange-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })

  if (!res.ok) {
    return c.redirect(appOrigin)
  }

  const { sessionToken } = (await res.json()) as { sessionToken: string }

  return new Response(null, {
    status: 302,
    headers: {
      Location: appOrigin,
      'Set-Cookie': `__Secure-better-auth.session_token=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`,
    },
  })
})

// ---------------------------------------------------------------------------
// Auth proxy → auth-worker (same-origin cookies)
// ---------------------------------------------------------------------------

app.all('/api/auth/*', async (c) => {
  const url = new URL(c.req.url)
  const authUrl = new URL(url.pathname + url.search, c.env.AUTH_WORKER_URL)
  const res = await fetch(authUrl.toString(), {
    method: c.req.method,
    headers: c.req.raw.headers,
    body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? c.req.raw.body : undefined,
  })
  const headers = new Headers(res.headers)
  const setCookie = headers.get('set-cookie')
  if (setCookie) {
    headers.set('set-cookie', setCookie.replace(/;\s*Domain=[^;]*/gi, ''))
  }
  return new Response(res.body, { status: res.status, headers })
})

// ---------------------------------------------------------------------------
// WebSocket → app's RecordRoom DOs (each roomId = separate DO instance)
// ---------------------------------------------------------------------------

app.get('/ws/:roomId', async (c) => {
  const roomId = c.req.param('roomId')

  // Authenticate (optional — anonymous connections get limited RBAC)
  const token = new URL(c.req.url).searchParams.get('token')
  let auth: VerifyResult | null = null
  if (token) {
    auth = (await verifyJwt(jwtConfig(c.env), token)).result
  }

  console.log(`[ws] ${roomId} (user: ${auth?.userId ?? 'anon'})`)

  const doUrl = new URL(c.req.url)
  if (auth) doUrl.searchParams.set('userId', auth.userId)
  doUrl.searchParams.delete('token')

  const doId = c.env.RECORD_ROOMS.idFromName(roomId)
  const stub = c.env.RECORD_ROOMS.get(doId)
  return stub.fetch(new Request(doUrl.toString(), c.req.raw))
})

// ---------------------------------------------------------------------------
// WebSocket → YjsRoom DOs (collaborative documents)
// ---------------------------------------------------------------------------

app.get('/ws/yjs/:docId', async (c) => {
  const docId = c.req.param('docId')
  const token = new URL(c.req.url).searchParams.get('token')
  let auth: VerifyResult | null = null
  if (token) {
    auth = (await verifyJwt(jwtConfig(c.env), token)).result
  }
  const doUrl = new URL(c.req.url)
  if (auth) {
    doUrl.searchParams.set('userId', auth.userId)
    doUrl.searchParams.set('role', 'member')
  }
  doUrl.searchParams.delete('token')
  const doId = c.env.YJS_ROOMS.idFromName(docId)
  const stub = c.env.YJS_ROOMS.get(doId)
  return stub.fetch(new Request(doUrl.toString(), c.req.raw))
})

// ---------------------------------------------------------------------------
// WebSocket → CanvasRoom DOs (spatial canvas collaboration)
// ---------------------------------------------------------------------------

app.get('/ws/canvas/:docId', async (c) => {
  const docId = c.req.param('docId')
  const token = new URL(c.req.url).searchParams.get('token')
  let auth: VerifyResult | null = null
  if (token) {
    auth = (await verifyJwt(jwtConfig(c.env), token)).result
  }
  const doUrl = new URL(c.req.url)
  if (auth) {
    doUrl.searchParams.set('userId', auth.userId)
    doUrl.searchParams.set('role', 'member')
  }
  doUrl.searchParams.delete('token')
  const doId = c.env.CANVAS_ROOMS.idFromName(docId)
  const stub = c.env.CANVAS_ROOMS.get(doId)
  return stub.fetch(new Request(doUrl.toString(), c.req.raw))
})

// ---------------------------------------------------------------------------
// WebSocket → MediaRoom DOs (WebRTC signaling)
// ---------------------------------------------------------------------------

app.get('/ws/media/:roomId', async (c) => {
  const roomId = c.req.param('roomId')
  const token = new URL(c.req.url).searchParams.get('token')
  let auth: VerifyResult | null = null
  if (token) {
    auth = (await verifyJwt(jwtConfig(c.env), token)).result
  }
  const doUrl = new URL(c.req.url)
  if (auth) {
    doUrl.searchParams.set('userId', auth.userId)
    doUrl.searchParams.set('role', 'member')
  }
  doUrl.searchParams.delete('token')
  const doId = c.env.MEDIA_ROOMS.idFromName(roomId)
  const stub = c.env.MEDIA_ROOMS.get(doId)
  return stub.fetch(new Request(doUrl.toString(), c.req.raw))
})

// ---------------------------------------------------------------------------
// WebSocket → PresenceRoom DOs (real-time presence per scope)
// ---------------------------------------------------------------------------

app.get('/ws/presence/:scopeId', async (c) => {
  const scopeId = c.req.param('scopeId')
  const token = new URL(c.req.url).searchParams.get('token')
  let auth: VerifyResult | null = null
  if (token) {
    auth = (await verifyJwt(jwtConfig(c.env), token)).result
  }
  const doUrl = new URL(c.req.url)
  if (auth) {
    doUrl.searchParams.set('userId', auth.userId)
    if (auth.claims.name) doUrl.searchParams.set('userName', auth.claims.name)
    if (auth.claims.email) doUrl.searchParams.set('userEmail', auth.claims.email)
    if (auth.claims.image) doUrl.searchParams.set('userImageUrl', auth.claims.image)
  }
  doUrl.searchParams.delete('token')
  const doId = c.env.PRESENCE_ROOMS.idFromName(scopeId)
  const stub = c.env.PRESENCE_ROOMS.get(doId)
  return stub.fetch(new Request(doUrl.toString(), c.req.raw))
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

const r2Handlers: Record<string, ScopedR2Handler> = {}

function getR2Handler(env: Env): ScopedR2Handler {
  if (!r2Handlers[env.APP_NAME]) {
    r2Handlers[env.APP_NAME] = createScopedR2Handler({
      resolvePrefix(scope, ctx) {
        if (scope === 'app') return { prefix: `apps/${env.APP_NAME}/` }
        if (!ctx.userId) return { error: 'Authentication required for user files' }
        return { prefix: `apps/${env.APP_NAME}/users/${ctx.userId}/` }
      },
    })
  }
  return r2Handlers[env.APP_NAME]
}

app.all('/api/files/*', async (c) => {
  const auth = await resolveAuth(c.req.raw, c.env)
  return getR2Handler(c.env)(c.req.raw, new URL(c.req.url), c.env.FILES, { userId: auth?.userId ?? null })
})

// ---------------------------------------------------------------------------
// Internal cron (HMAC-authenticated)
// ---------------------------------------------------------------------------

app.post('/internal/cron', async (c) => {
  const body = await c.req.text()
  const valid = await verifyInternalSignature({
    secret: c.env.INTERNAL_STORAGE_HMAC_SECRET,
    payload: buildInternalPayload(body),
    signature: c.req.header('x-internal-signature') ?? '',
    timestamp: c.req.header('x-internal-timestamp') ?? '',
  })
  if (!valid) return c.json({ error: 'Forbidden' }, 403)
  await handleCron(JSON.parse(body))
  return c.json({ ok: true })
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
// Action Tools — route to app's own RecordRoom DO
// =============================================================================

function createActionTools(env: Env, userId: string): ActionTools {
  const scopeId = `app:${env.APP_NAME}`

  async function execTool(tool: string, params: Record<string, unknown>): Promise<ActionResult> {
    const doId = env.RECORD_ROOMS.idFromName(scopeId)
    const stub = env.RECORD_ROOMS.get(doId)
    const res = await stub.fetch(new Request('https://internal/api/tools/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
        'x-app-action': 'true',
      },
      body: JSON.stringify({ tool, params }),
    }))
    return res.json() as Promise<ActionResult>
  }

  return {
    create: (sid, collection, data) => execTool('records.create', { scopeId: sid, collection, data }),
    update: (sid, collection, recordId, data) => execTool('records.update', { scopeId: sid, collection, recordId, data }),
    remove: (sid, collection, recordId) => execTool('records.delete', { scopeId: sid, collection, recordId }),
    get: (sid, collection, recordId) => execTool('records.get', { scopeId: sid, collection, recordId }),
    query: (sid, collection, options) => execTool('records.query', { scopeId: sid, collection, ...options }),
  }
}

export default app
