/**
 * DeepSpace Deploy Worker
 *
 * Handles app deployment to Workers for Platforms on behalf of authenticated users.
 * Isolated from other workers to scope the CLOUDFLARE_API_TOKEN secret.
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import deployRoutes from './routes/deploy'
import appsRoutes from './routes/apps'

export type Env = {
  Bindings: {
    APP_REGISTRY: R2Bucket
    CRON_TASKS: KVNamespace
    AUTH_JWT_PUBLIC_KEY: string
    AUTH_JWT_ISSUER: string
    CLOUDFLARE_API_TOKEN: string
    CLOUDFLARE_ACCOUNT_ID: string
    DEPLOY_JWT_PUBLIC_KEY_PEM: string
    AUTH_WORKER_URL: string
    INTERNAL_HMAC_SECRET: string
  }
  Variables: {
    userId: string
  }
}

const app = new Hono<Env>()

app.use(
  '*',
  cors({
    origin: ['https://deep.space', 'https://*.deep.space', 'https://*.app.space', 'http://localhost:*'],
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }),
)

app.get('/api/health', (c) =>
  c.json({ status: 'ok', service: 'deepspace-deploy', timestamp: new Date().toISOString() }),
)

app.route('/api/deploy', deployRoutes)
app.route('/api/apps', appsRoutes)

// Test seed endpoint — write fake app registry entries for local testing.
// Only functional in local dev (wrangler dev) where APP_REGISTRY is a local R2 bucket.
app.post('/_test/seed-app', async (c) => {
  const body = (await c.req.json()) as {
    appId: string
    ownerUserId: string
    deployedAt?: string
    versionId?: string
  }
  if (!body.appId || !body.ownerUserId) {
    return c.json({ error: 'appId and ownerUserId required' }, 400)
  }
  const entry = {
    appId: body.appId,
    ownerUserId: body.ownerUserId,
    deployedAt: body.deployedAt ?? new Date().toISOString(),
    versionId: body.versionId ?? 'test-version',
  }
  await c.env.APP_REGISTRY.put(
    `app-registry/${body.appId}.json`,
    JSON.stringify(entry),
    { httpMetadata: { contentType: 'application/json' } },
  )
  return c.json({ success: true, entry })
})

app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

export default app
