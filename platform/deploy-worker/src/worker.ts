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

app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

export default app
