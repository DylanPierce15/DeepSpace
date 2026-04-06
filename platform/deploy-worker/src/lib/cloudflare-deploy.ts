/**
 * Cloudflare Workers for Platforms deployment via REST API.
 *
 * 3-step flow (same as Miyagi3's miniapp-deployer):
 * 1. Create asset upload session (send SHA-256 manifest)
 * 2. Upload assets in buckets (base64-encoded)
 * 3. Deploy worker with completion token + bindings
 */

const CF_API = 'https://api.cloudflare.com/client/v4'
const DISPATCH_NAMESPACE = 'spaces-apps'

export interface DeployConfig {
  accountId: string
  apiToken: string
}

export interface AssetEntry {
  /** Path relative to dist root, e.g. "/index.html" */
  path: string
  /** SHA-256 hash, first 32 hex chars */
  hash: string
  /** File size in bytes */
  size: number
  /** Base64-encoded content */
  contentBase64: string
}

export interface DOManifestEntry {
  binding: string
  className: string
  sqlite: boolean
}

export interface WorkerBindings {
  appName: string
  ownerUserId: string
  jwtPublicKey: string
  jwtIssuer: string
  authWorkerUrl: string
  hmacSecret?: string
  doManifest?: DOManifestEntry[]
}

export interface DeployResult {
  success: boolean
  versionId?: string
  error?: string
}

/**
 * Compute SHA-256 hash of content (first 32 hex chars), matching CF's manifest format.
 */
export async function sha256Hex32(content: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', content)
  return Array.from(new Uint8Array(hash))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Deploy a worker with static assets to the WfP dispatch namespace.
 */
export async function deployToWfP(
  cfg: DeployConfig,
  scriptName: string,
  workerJs: string,
  assets: AssetEntry[],
  bindings: WorkerBindings,
): Promise<DeployResult> {
  const { accountId, apiToken } = cfg
  const base = `${CF_API}/accounts/${accountId}`
  const headers = { Authorization: `Bearer ${apiToken}` }

  try {
    // ── Resolve DO manifest ─────────────────────────────────────
    const doManifest: DOManifestEntry[] = bindings.doManifest ?? [
      { binding: 'RECORD_ROOMS', className: 'AppRecordRoom', sqlite: true },
    ]

    // ── Check if DO migration is needed ──────────────────────────
    // Diff manifest against existing bindings to find new SQLite classes.
    const bindingsRes = await fetch(
      `${base}/workers/dispatch/namespaces/${DISPATCH_NAMESPACE}/scripts/${scriptName}/bindings`,
      { headers },
    )
    let needsMigration = true
    let newSqliteClasses: string[] = doManifest.filter(e => e.sqlite).map(e => e.className)
    console.log(`[deploy] DO manifest: ${JSON.stringify(doManifest)}`)
    console.log(`[deploy] Bindings check: ${bindingsRes.status}`)
    if (bindingsRes.ok) {
      const bindingsData = (await bindingsRes.json()) as { result?: Array<{ type: string; name: string }> }
      console.log(`[deploy] Existing bindings: ${JSON.stringify(bindingsData.result)}`)
      const existingDOBindings = new Set(
        bindingsData.result
          ?.filter((b) => b.type === 'durable_object_namespace')
          .map((b) => b.name) ?? []
      )
      newSqliteClasses = doManifest
        .filter(e => e.sqlite && !existingDOBindings.has(e.binding))
        .map(e => e.className)
      needsMigration = newSqliteClasses.length > 0
      console.log(`[deploy] Existing DO bindings: ${[...existingDOBindings].join(', ')}`)
    }
    console.log(`[deploy] needsMigration=${needsMigration}, newSqliteClasses=${newSqliteClasses.join(', ')}`)

    // ── Step 1: Create asset upload session ─────────────────────
    const manifest: Record<string, { hash: string; size: number }> = {}
    for (const a of assets) {
      manifest[a.path] = { hash: a.hash, size: a.size }
    }

    console.log('[deploy] Manifest:', JSON.stringify(manifest))

    const sessionRes = await fetch(
      `${base}/workers/dispatch/namespaces/${DISPATCH_NAMESPACE}/scripts/${scriptName}/assets-upload-session`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifest }),
      },
    )

    if (!sessionRes.ok) {
      const err = await sessionRes.text()
      return { success: false, error: `Upload session failed (${sessionRes.status}): ${err}` }
    }

    const sessionData = (await sessionRes.json()) as {
      success: boolean
      result: { jwt: string; buckets?: string[][] }
    }
    let completionToken = sessionData.result.jwt
    const buckets = sessionData.result.buckets ?? []
    console.log('[deploy] Session created, buckets:', buckets.length, 'assets:', assets.length)

    // ── Step 2: Upload assets in buckets ────────────────────────
    const hashToAsset = new Map<string, AssetEntry>()
    for (const a of assets) hashToAsset.set(a.hash, a)

    for (const bucket of buckets) {
      const form = new FormData()
      for (const hash of bucket) {
        const asset = hashToAsset.get(hash)
        if (!asset) continue
        const mimeType = getMimeType(asset.path)
        form.append(hash, new Blob([asset.contentBase64], { type: mimeType }), hash)
      }

      console.log('[deploy] Uploading bucket with', bucket.length, 'hashes:', bucket)

      const uploadRes = await fetch(
        `${base}/workers/assets/upload?base64=true`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${completionToken}` },
          body: form,
        },
      )

      const uploadBody = await uploadRes.text()
      console.log('[deploy] Upload response:', uploadRes.status, uploadBody.substring(0, 500))

      if (!uploadRes.ok) {
        return { success: false, error: `Asset upload failed (${uploadRes.status}): ${uploadBody}` }
      }

      // Update completion token if provided
      if (uploadRes.status === 201) {
        try {
          const data = JSON.parse(uploadBody) as { result?: { jwt?: string } }
          if (data.result?.jwt) completionToken = data.result.jwt
        } catch { /* not JSON */ }
      }
    }

    // ── Step 3: Deploy worker with metadata ─────────────────────
    // Build DO bindings dynamically from manifest
    const doBindingsList = doManifest.map(entry => ({
      type: 'durable_object_namespace',
      name: entry.binding,
      class_name: entry.className,
    }))

    // Compute migration tag: v{N} where N = number of sqlite classes
    const allSqliteClasses = doManifest.filter(e => e.sqlite).map(e => e.className)
    const migrationTag = `v${allSqliteClasses.length}`

    const metadata: Record<string, unknown> = {
      main_module: 'index.js',
      compatibility_date: '2025-01-01',
      compatibility_flags: ['nodejs_compat'],
      tags: [`user-${bindings.ownerUserId}`],
      ...(needsMigration && {
        migrations: {
          tag: migrationTag,
          new_sqlite_classes: newSqliteClasses,
        },
      }),
      assets: {
        jwt: completionToken,
        config: {
          not_found_handling: 'single-page-application',
          run_worker_first: ['/api/*', '/ws/*', '/internal/*'],
        },
      },
      bindings: [
        { type: 'assets', name: 'ASSETS' },
        ...doBindingsList,
        { type: 'r2_bucket', name: 'FILES', bucket_name: 'deepspace-user-files' },
        { type: 'service', name: 'PLATFORM_WORKER', service: 'deepspace-platform-worker' },
        { type: 'service', name: 'API_WORKER', service: 'deepspace-api' },
        { type: 'plain_text', name: 'APP_NAME', text: bindings.appName },
        { type: 'plain_text', name: 'OWNER_USER_ID', text: bindings.ownerUserId },
        { type: 'secret_text', name: 'AUTH_JWT_PUBLIC_KEY', text: bindings.jwtPublicKey },
        { type: 'secret_text', name: 'AUTH_JWT_ISSUER', text: bindings.jwtIssuer },
        { type: 'plain_text', name: 'AUTH_WORKER_URL', text: bindings.authWorkerUrl },
        ...(bindings.hmacSecret
          ? [{ type: 'secret_text', name: 'INTERNAL_STORAGE_HMAC_SECRET', text: bindings.hmacSecret }]
          : []),
      ],
    }

    const deployForm = new FormData()
    deployForm.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
      'metadata',
    )
    deployForm.append(
      'index.js',
      new Blob([workerJs], { type: 'application/javascript+module' }),
      'index.js',
    )

    console.log('[deploy] Deploying worker with metadata:', JSON.stringify(metadata).substring(0, 500))

    const deployRes = await fetch(
      `${base}/workers/dispatch/namespaces/${DISPATCH_NAMESPACE}/scripts/${scriptName}`,
      { method: 'PUT', headers, body: deployForm },
    )

    const deployBody = await deployRes.text()
    console.log('[deploy] Deploy response:', deployRes.status, deployBody.substring(0, 500))

    if (!deployRes.ok) {
      return { success: false, error: `Worker deploy failed (${deployRes.status}): ${deployBody}` }
    }

    const deployData = JSON.parse(deployBody) as { result?: { id?: string } }
    return { success: true, versionId: deployData.result?.id }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Delete a worker from the WfP dispatch namespace.
 */
function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    webp: 'image/webp',
    avif: 'image/avif',
    xml: 'application/xml',
    txt: 'text/plain',
    map: 'application/json',
  }
  return map[ext] || 'application/octet-stream'
}

export async function deleteFromWfP(
  cfg: DeployConfig,
  scriptName: string,
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(
    `${CF_API}/accounts/${cfg.accountId}/workers/dispatch/namespaces/${DISPATCH_NAMESPACE}/scripts/${scriptName}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${cfg.apiToken}` },
    },
  )
  const body = (await res.json()) as { success: boolean; errors?: Array<{ message: string }> }
  if (!body.success) {
    return { success: false, error: body.errors?.[0]?.message ?? 'Unknown error' }
  }
  return { success: true }
}
