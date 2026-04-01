/**
 * Deploy routes — handles app deployment and teardown.
 *
 * POST /api/deploy/:appName — deploy an app (multipart: worker.js + assets)
 * DELETE /api/deploy/:appName — undeploy an app
 * GET /api/deploy/:appName — get deploy status
 */

import { Hono } from 'hono'
import type { Env } from '../worker'
import { authMiddleware } from '../middleware/auth'
import { deployToWfP, deleteFromWfP, sha256Hex32, type AssetEntry } from '../lib/cloudflare-deploy'

const deploy = new Hono<Env>()

// ============================================================================
// POST /api/deploy/:appName — deploy app
// ============================================================================

deploy.post('/:appName', authMiddleware, async (c) => {
  const appName = c.req.param('appName').toLowerCase().replace(/[^a-z0-9-]/g, '-')
  const userId = c.get('userId')

  if (!appName || appName.length < 2 || appName.length > 63) {
    return c.json({ error: 'App name must be 2-63 characters, lowercase alphanumeric with hyphens' }, 400)
  }

  // Check ownership: either new app or user owns it
  const registryKey = `app-registry/${appName}.json`
  const existing = await c.env.APP_REGISTRY.get(registryKey)
  if (existing) {
    const meta = (await existing.json()) as { ownerUserId?: string }
    if (meta.ownerUserId && meta.ownerUserId !== userId) {
      return c.json({ error: 'App name is owned by another user' }, 403)
    }
  }

  // Parse multipart form
  const formData = await c.req.formData()
  const workerFile = formData.get('worker') as File | null
  const assetsJson = formData.get('assets') as string | null

  if (!workerFile) {
    return c.json({ error: 'Missing "worker" field (bundled worker.js)' }, 400)
  }
  if (!assetsJson) {
    return c.json({ error: 'Missing "assets" field (JSON array of asset entries)' }, 400)
  }

  const workerJs = await workerFile.text()

  // Parse assets: array of { path, contentBase64 }
  let rawAssets: Array<{ path: string; contentBase64: string }>
  try {
    rawAssets = JSON.parse(assetsJson)
  } catch {
    return c.json({ error: 'Invalid assets JSON' }, 400)
  }

  // Build asset entries with hashes
  const assets: AssetEntry[] = []
  for (const raw of rawAssets) {
    const bytes = Uint8Array.from(atob(raw.contentBase64), (ch) => ch.charCodeAt(0))
    const hash = await sha256Hex32(bytes.buffer)
    assets.push({
      path: raw.path.startsWith('/') ? raw.path : '/' + raw.path,
      hash,
      size: bytes.length,
      contentBase64: raw.contentBase64,
    })
  }

  // Deploy
  const result = await deployToWfP(
    {
      accountId: c.env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: c.env.CLOUDFLARE_API_TOKEN,
    },
    appName,
    workerJs,
    assets,
    {
      appName,
      ownerUserId: userId,
      jwtPublicKey: c.env.DEPLOY_JWT_PUBLIC_KEY_PEM,
      jwtIssuer: c.env.AUTH_JWT_ISSUER,
      hmacSecret: c.env.INTERNAL_HMAC_SECRET,
    },
  )

  if (!result.success) {
    return c.json({ error: result.error }, 500)
  }

  // Update app registry
  await c.env.APP_REGISTRY.put(
    registryKey,
    JSON.stringify({
      appId: appName,
      ownerUserId: userId,
      deployedAt: new Date().toISOString(),
      versionId: result.versionId,
    }),
    { httpMetadata: { contentType: 'application/json' } },
  )

  return c.json({
    success: true,
    url: `https://${appName}.app.space`,
    versionId: result.versionId,
  })
})

// ============================================================================
// DELETE /api/deploy/:appName — undeploy app
// ============================================================================

deploy.delete('/:appName', authMiddleware, async (c) => {
  const appName = c.req.param('appName')
  const userId = c.get('userId')

  // Check ownership
  const registryKey = `app-registry/${appName}.json`
  const existing = await c.env.APP_REGISTRY.get(registryKey)
  if (!existing) {
    return c.json({ error: 'App not found' }, 404)
  }

  const meta = (await existing.json()) as { ownerUserId?: string }
  if (meta.ownerUserId && meta.ownerUserId !== userId) {
    return c.json({ error: 'Not authorized to delete this app' }, 403)
  }

  const result = await deleteFromWfP(
    {
      accountId: c.env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: c.env.CLOUDFLARE_API_TOKEN,
    },
    appName,
  )

  if (!result.success) {
    return c.json({ error: result.error }, 500)
  }

  // Remove from registry
  await c.env.APP_REGISTRY.delete(registryKey)

  return c.json({ success: true })
})

// ============================================================================
// GET /api/deploy/:appName — deploy status
// ============================================================================

deploy.get('/:appName', authMiddleware, async (c) => {
  const appName = c.req.param('appName')
  const registryKey = `app-registry/${appName}.json`
  const obj = await c.env.APP_REGISTRY.get(registryKey)

  if (!obj) {
    return c.json({ deployed: false })
  }

  const meta = await obj.json()
  return c.json({ deployed: true, ...meta })
})

export default deploy
