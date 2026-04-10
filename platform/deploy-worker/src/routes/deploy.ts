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
import { validateCronConfig, buildCronKVEntry } from '../lib/cron-validation'

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
  const cronConfigJson = formData.get('cronConfig') as string | null
  const doManifestJson = formData.get('doManifest') as string | null

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

  // Parse and validate optional cron config
  let parsedCronConfig: ReturnType<typeof validateCronConfig> | null = null
  if (cronConfigJson) {
    let rawCron: unknown
    try {
      rawCron = JSON.parse(cronConfigJson)
    } catch {
      return c.json({ error: 'Invalid cronConfig JSON' }, 400)
    }
    parsedCronConfig = validateCronConfig(rawCron)
    if (!parsedCronConfig.success) {
      return c.json({ error: `Invalid cron config: ${parsedCronConfig.error}` }, 400)
    }
  }

  // Parse optional DO manifest
  let doManifest: Array<{ binding: string; className: string; sqlite: boolean }> | undefined
  if (doManifestJson) {
    try {
      doManifest = JSON.parse(doManifestJson)
    } catch {
      return c.json({ error: 'Invalid doManifest JSON' }, 400)
    }
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

  // Mint the long-lived app-owner JWT via the auth-worker. Baked into the
  // deployed worker as APP_OWNER_JWT for server-side LLM / integration calls
  // that run without a user context (cron, DO alarms, autonomous agents).
  // Runs after all input validation so bad requests never touch the auth
  // worker, and immediately before deploy so transient auth-worker outages
  // surface a targeted error instead of halfway-initialized state.
  // See auth-worker `/api/auth/mint-app-token`.
  const callerBearer = c.req.header('Authorization') ?? ''
  if (!callerBearer.startsWith('Bearer ')) {
    return c.json({ error: 'Missing caller JWT for token minting' }, 401)
  }
  // Use the AUTH_WORKER service binding rather than the public HTTPS URL.
  // Cloudflare blocks Worker→Worker subrequests on *.workers.dev with error
  // 1042 ("error code: 1042"), so HTTPS calls between deploy-worker and
  // auth-worker fail even though external curl works fine. Service bindings
  // route the request internally and avoid the constraint entirely.
  let mintRes: Response
  try {
    mintRes = await c.env.AUTH_WORKER.fetch('https://auth-worker/api/auth/mint-app-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: callerBearer,
      },
      body: JSON.stringify({ appName }),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return c.json(
      {
        error:
          'Could not reach auth worker to mint APP_OWNER_JWT. Auth worker may be ' +
          `down — retry in a moment. (${msg})`,
      },
      503,
    )
  }
  if (!mintRes.ok) {
    const err = await mintRes.text().catch(() => '')
    const hint =
      mintRes.status === 401
        ? 'Your login may have expired — run `deepspace login` and retry.'
        : 'Retry in a moment; if this persists, the auth worker is unhealthy.'
    return c.json(
      { error: `Failed to mint APP_OWNER_JWT (auth worker ${mintRes.status}): ${err}. ${hint}` },
      mintRes.status === 401 ? 401 : 502,
    )
  }
  const { token: appOwnerJwt } = (await mintRes.json()) as { token?: string }
  if (!appOwnerJwt) {
    return c.json({ error: 'Auth worker returned empty APP_OWNER_JWT — contact support.' }, 502)
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
      authWorkerUrl: c.env.AUTH_WORKER_URL,
      hmacSecret: c.env.INTERNAL_HMAC_SECRET,
      platformIdentitySecret: c.env.PLATFORM_IDENTITY_SECRET,
      appOwnerJwt,
      doManifest,
    },
  )

  if (!result.success) {
    return c.json({ error: result.error ?? 'Deploy failed' }, 500)
  }

  // Register cron tasks in dispatch worker's KV (or clean up if no tasks)
  const cronKvKey = `cron:${appName}`
  if (parsedCronConfig?.success && parsedCronConfig.data.tasks.length > 0) {
    const kvEntry = buildCronKVEntry(parsedCronConfig.data, userId)
    await c.env.CRON_TASKS.put(cronKvKey, JSON.stringify(kvEntry))
    console.log(`[deploy] Registered ${kvEntry.tasks.length} cron task(s) for ${appName}`)
  } else {
    // No cron tasks — remove any previously registered config
    await c.env.CRON_TASKS.delete(cronKvKey)
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
    return c.json({ error: result.error ?? 'Delete failed' }, 500)
  }

  // Remove cron tasks and app registry entry
  await c.env.CRON_TASKS.delete(`cron:${appName}`)
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

  const meta = (await obj.json()) as Record<string, unknown>
  return c.json({ deployed: true, ...meta })
})

export default deploy
