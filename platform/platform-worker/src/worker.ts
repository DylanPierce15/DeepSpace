/**
 * DeepSpace Platform Worker
 *
 * Hono-based universal data layer for all deployed apps.
 * Routes WebSocket connections and API requests to RecordRoom Durable Objects.
 *
 * Scope conventions:
 *   - "app:{appId}"     → app-wide shared data (channels, settings, items)
 *   - "conv:{convId}"   → per-conversation (messages, reactions)
 *   - "dir:{appId}"     → cross-app discoverable directory (conversations, communities)
 *   - "workspace:default" → cross-app shared business data
 *
 * Schemas are baked into each app's worker at deploy time — no R2 schema
 * registry or runtime registration needed.
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { verifyJwt, verifyInternalSignature } from '@deepspace/auth'
import type { JwtVerifierConfig, VerifiedAuth } from '@deepspace/auth'

// Re-export Durable Object class for wrangler
export { SharedRecordRoom } from './record-room-stub.js'

// ============================================================================
// Types
// ============================================================================

interface Env {
  RECORD_ROOMS: DurableObjectNamespace
  SCHEMA_REGISTRY: R2Bucket
  AUTH_JWT_PUBLIC_KEY: string
  AUTH_JWT_ISSUER: string
  AUTH_JWT_AUDIENCE?: string
  AUTH_JWT_AUTHORIZED_PARTIES?: string
  AUTH_JWT_CLOCK_SKEW_MS?: string
  INTERNAL_STORAGE_HMAC_SECRET?: string
}

interface AuthContext extends VerifiedAuth {}

// ============================================================================
// Helpers
// ============================================================================

function getJwtConfig(env: Env): JwtVerifierConfig {
  return {
    publicKey: env.AUTH_JWT_PUBLIC_KEY,
    issuer: env.AUTH_JWT_ISSUER,
    audience: env.AUTH_JWT_AUDIENCE,
    authorizedParties: env.AUTH_JWT_AUTHORIZED_PARTIES?.split(','),
    clockSkewMs: env.AUTH_JWT_CLOCK_SKEW_MS
      ? parseInt(env.AUTH_JWT_CLOCK_SKEW_MS)
      : undefined,
  }
}

function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  return new URL(request.url).searchParams.get('token')
}

async function authenticate(
  request: Request,
  env: Env,
): Promise<AuthContext | null> {
  const token = extractToken(request)
  if (!token) return null
  const outcome = await verifyJwt(getJwtConfig(env), token)
  return outcome.result
}

function routeToRecordRoom(
  request: Request,
  env: Env,
  auth: AuthContext | null,
  scopeId: string,
): Promise<Response> {
  const doUrl = new URL(request.url)
  if (auth) {
    doUrl.searchParams.set('userId', auth.userId)
  }
  doUrl.searchParams.delete('token')

  const stub = env.RECORD_ROOMS.get(
    env.RECORD_ROOMS.idFromName(decodeURIComponent(scopeId)),
  )
  return stub.fetch(new Request(doUrl.toString(), request))
}

// ============================================================================
// Hono App
// ============================================================================

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors())

// ── Health ────────────────────────────────────────────────────────────────

app.get('/api/health', (c) =>
  c.json({ status: 'ok', service: 'deepspace-platform', timestamp: Date.now() }),
)

// ── App Registry (R2-backed metadata) ────────────────────────────────────

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
  return new Response(obj.body, {
    headers: { 'Content-Type': 'application/json' },
  })
})

app.get('/api/app-registry', async (c) => {
  const list = await c.env.SCHEMA_REGISTRY.list({ prefix: 'app-registry/' })
  const apps = list.objects.map((o) =>
    o.key.replace('app-registry/', '').replace('.json', ''),
  )
  return c.json({ apps })
})

// ── Internal Tools (HMAC service-to-service auth) ────────────────────────

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

  if (!verified) {
    return c.json({ error: 'Unauthorized: invalid HMAC signature' }, 401)
  }

  const scopeId = decodeURIComponent(c.req.param('scopeId'))
  const action = c.req.param('action')

  let userId: string | undefined
  try {
    userId = JSON.parse(bodyText).userId
  } catch {
    // Body may not be JSON
  }

  const stub = c.env.RECORD_ROOMS.get(c.env.RECORD_ROOMS.idFromName(scopeId))

  const doUrl = new URL(c.req.url)
  doUrl.pathname = `/api/tools/${action}`
  if (userId) doUrl.searchParams.set('userId', userId)
  doUrl.searchParams.set('appAction', 'true')

  return stub.fetch(
    new Request(doUrl.toString(), {
      method: c.req.method,
      headers: c.req.raw.headers,
      body: bodyText,
    }),
  )
})

// ── WebSocket (per-scope, supports anonymous for conv/dir) ───────────────

app.get('/ws/:scopeId', async (c) => {
  // Auth is optional — the RecordRoom's RBAC handles permissions per role.
  // Anonymous connections get whatever role the schema assigns to unauthed users.
  const auth = await authenticate(c.req.raw, c.env)
  const scopeId = c.req.param('scopeId')
  return routeToRecordRoom(c.req.raw, c.env, auth, scopeId)
})

// ── API passthrough to RecordRoom ────────────────────────────────────────

app.all('/api/*', async (c) => {
  const scopeId = c.req.query('scopeId')
  if (!scopeId) {
    return c.json({ error: 'scopeId query parameter required' }, 400)
  }

  let request = c.req.raw
  if (c.req.header('X-App-Action') === 'true') {
    const doUrl = new URL(request.url)
    doUrl.searchParams.set('appAction', 'true')
    request = new Request(doUrl.toString(), request)
  }

  const auth = await authenticate(request, c.env)
  return routeToRecordRoom(request, c.env, auth, scopeId)
})

// ============================================================================
// Export
// ============================================================================

export default app
