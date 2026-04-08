/**
 * DeepSpace Platform Worker
 *
 * Hosts global DOs shared across all apps:
 *   - conv:{convId}       → per-conversation RecordRoom (messages, reactions)
 *   - dir:{appId}         → cross-app directory (conversations, communities, posts)
 *   - workspace:default   → cross-app shared business data
 *
 * App-specific DOs (app:{appId}) live in each app's own worker.
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  verifyJwt,
  verifyInternalSignature,
  RecordRoom,
  getGlobalDOSchemas,
  createScopedR2Handler,
  computeHmacHex,
  timingSafeEqualHex,
} from 'deepspace/worker'
import type { JwtVerifierConfig, VerifiedAuth, ScopedR2Handler } from 'deepspace/worker'

// =============================================================================
// Global RecordRoom DO — all cross-app schemas baked in
// =============================================================================

/** All schemas for workspace, conversation, and directory scopes. */
const GLOBAL_SCHEMAS = [
  ...getGlobalDOSchemas('workspace'),
  ...getGlobalDOSchemas('conv'),
  ...getGlobalDOSchemas('dir'),
]

export class GlobalRecordRoom extends RecordRoom {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env, GLOBAL_SCHEMAS)
  }
}

// =============================================================================
// Types
// =============================================================================

interface Env {
  RECORD_ROOMS: DurableObjectNamespace
  SCHEMA_REGISTRY: R2Bucket
  APP_FILES: R2Bucket
  AUTH_JWT_PUBLIC_KEY: string
  AUTH_JWT_ISSUER: string
  AUTH_JWT_AUDIENCE?: string
  AUTH_JWT_CLOCK_SKEW_MS?: string
  INTERNAL_STORAGE_HMAC_SECRET?: string
  PLATFORM_IDENTITY_SECRET: string
}

// =============================================================================
// Helpers
// =============================================================================

function getJwtConfig(env: Env): JwtVerifierConfig {
  return {
    publicKey: env.AUTH_JWT_PUBLIC_KEY,
    issuer: env.AUTH_JWT_ISSUER,
    audience: env.AUTH_JWT_AUDIENCE,
    clockSkewMs: env.AUTH_JWT_CLOCK_SKEW_MS ? parseInt(env.AUTH_JWT_CLOCK_SKEW_MS) : undefined,
  }
}

function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)
  return new URL(request.url).searchParams.get('token')
}

async function authenticate(request: Request, env: Env): Promise<VerifiedAuth | null> {
  const token = extractToken(request)
  if (!token) return null
  return (await verifyJwt(getJwtConfig(env), token)).result
}

function routeToRecordRoom(
  request: Request,
  env: Env,
  auth: VerifiedAuth | null,
  scopeId: string,
): Promise<Response> {
  const doUrl = new URL(request.url)
  if (auth) doUrl.searchParams.set('userId', auth.userId)
  doUrl.searchParams.delete('token')
  const stub = env.RECORD_ROOMS.get(env.RECORD_ROOMS.idFromName(decodeURIComponent(scopeId)))
  return stub.fetch(new Request(doUrl.toString(), request))
}

// =============================================================================
// Hono App
// =============================================================================

const app = new Hono<{ Bindings: Env }>()
app.use('*', cors())

// ── Health ──────────────────────────────────────────────────────────────────

app.get('/api/health', (c) =>
  c.json({ status: 'ok', service: 'deepspace-platform', timestamp: Date.now() }),
)

// ── App Registry (R2-backed metadata) ───────────────────────────────────────

app.put('/api/app-registry/:appId', async (c) => {
  const auth = await authenticate(c.req.raw, c.env)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)
  const appId = c.req.param('appId')
  const meta = (await c.req.json()) as Record<string, unknown>
  await c.env.SCHEMA_REGISTRY.put(
    `app-registry/${appId}.json`,
    JSON.stringify({ ...meta, appId, updatedAt: new Date().toISOString() }),
    { httpMetadata: { contentType: 'application/json' } },
  )
  return c.json({ success: true })
})

app.get('/api/app-registry/:appId', async (c) => {
  const appId = c.req.param('appId')
  const obj = await c.env.SCHEMA_REGISTRY.get(`app-registry/${appId}.json`)
  if (!obj) return c.json({ error: 'Not found' }, 404)
  return new Response(obj.body, { headers: { 'Content-Type': 'application/json' } })
})

app.get('/api/app-registry', async (c) => {
  const list = await c.env.SCHEMA_REGISTRY.list({ prefix: 'app-registry/' })
  return c.json({ apps: list.objects.map((o) => o.key.replace('app-registry/', '').replace('.json', '')) })
})

// ── Internal Tools (HMAC service-to-service auth) ───────────────────────────

app.all('/internal/tools/:scopeId/:action{.+}', async (c) => {
  if (!c.env.INTERNAL_STORAGE_HMAC_SECRET) {
    return c.json({ error: 'Internal auth not configured' }, 500)
  }
  const bodyText = await c.req.text()
  const verified = await verifyInternalSignature({
    secret: c.env.INTERNAL_STORAGE_HMAC_SECRET,
    timestamp: c.req.header('x-internal-timestamp'),
    signature: c.req.header('x-internal-signature'),
    payload: bodyText,
  })
  if (!verified) return c.json({ error: 'Unauthorized: invalid HMAC signature' }, 401)

  const scopeId = decodeURIComponent(c.req.param('scopeId'))
  const action = c.req.param('action')
  let userId: string | undefined
  try { userId = JSON.parse(bodyText).userId } catch { /* ignore */ }

  const stub = c.env.RECORD_ROOMS.get(c.env.RECORD_ROOMS.idFromName(scopeId))
  const doUrl = new URL(c.req.url)
  doUrl.pathname = `/api/tools/${action}`
  if (userId) doUrl.searchParams.set('userId', userId)
  doUrl.searchParams.set('appAction', 'true')
  return stub.fetch(new Request(doUrl.toString(), { method: c.req.method, headers: c.req.raw.headers, body: bodyText }))
})

// ── Scoped R2 files (service-binding from app workers) ────────────────────────

const fileHandlers: Record<string, ScopedR2Handler> = {}

function getFilesHandler(appName: string): ScopedR2Handler {
  if (!fileHandlers[appName]) {
    fileHandlers[appName] = createScopedR2Handler({
      resolvePrefix(scope, ctx) {
        if (scope === 'app') return { prefix: `apps/${appName}/` }
        if (!ctx.userId) return { error: 'Authentication required for user files' }
        return { prefix: `apps/${appName}/users/${ctx.userId}/` }
      },
    })
  }
  return fileHandlers[appName]
}

app.all('/internal/files/*', async (c) => {
  const identityToken = c.req.header('x-app-identity-token')
  const appName = c.req.header('x-app-name')

  if (!identityToken || !appName) {
    return c.json({ error: 'Missing app identity' }, 401)
  }

  const expected = await computeHmacHex(c.env.PLATFORM_IDENTITY_SECRET, appName)
  const valid = await timingSafeEqualHex(identityToken, expected)
  if (!valid) {
    return c.json({ error: 'Invalid app identity token' }, 403)
  }

  const userId = c.req.header('x-user-id') || null

  // Rewrite /internal/files/... → /api/files/...
  const url = new URL(c.req.url)
  url.pathname = url.pathname.replace('/internal/files', '/api/files')

  const handler = getFilesHandler(appName)
  return handler(c.req.raw, url, c.env.APP_FILES, { userId })
})

// ── WebSocket → global RecordRoom DOs (conv, dir, workspace) ────────────────

app.get('/ws/:scopeId', async (c) => {
  const auth = await authenticate(c.req.raw, c.env)
  const scopeId = c.req.param('scopeId')
  return routeToRecordRoom(c.req.raw, c.env, auth, scopeId)
})

// ── API passthrough to RecordRoom ───────────────────────────────────────────

app.all('/api/*', async (c) => {
  const scopeId = c.req.query('scopeId')
  if (!scopeId) return c.json({ error: 'scopeId query parameter required' }, 400)
  const auth = await authenticate(c.req.raw, c.env)
  return routeToRecordRoom(c.req.raw, c.env, auth, scopeId)
})

export default app
