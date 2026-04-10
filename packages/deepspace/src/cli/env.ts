/**
 * DeepSpace environment configuration.
 *
 * Shared between `dev`, `test`, and `deploy` commands.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseToml } from 'smol-toml'

export const ENVS = {
  dev: {
    auth: 'https://deepspace-auth.eudaimonicincorporated.workers.dev',
    api: 'https://deepspace-api.eudaimonicincorporated.workers.dev',
    deploy: 'https://deepspace-deploy.eudaimonicincorporated.workers.dev',
  },
  prod: {
    auth: 'https://deepspace-auth.eudaimonicincorporated.workers.dev',
    api: 'https://deepspace-api.eudaimonicincorporated.workers.dev',
    deploy: 'https://deepspace-deploy.eudaimonicincorporated.workers.dev',
  },
} as const

export type EnvName = keyof typeof ENVS

/**
 * Fetch the JWT public key from an auth worker's /api/auth/jwks endpoint.
 */
export async function fetchPublicKey(authUrl: string): Promise<string> {
  const res = await fetch(`${authUrl}/api/auth/jwks`)
  if (!res.ok) {
    throw new Error(`Failed to fetch JWT public key (${res.status})`)
  }
  const data = (await res.json()) as { publicKey?: string }
  if (!data.publicKey) {
    throw new Error('JWKS response missing publicKey')
  }
  return data.publicKey
}

/**
 * Read the app name from the app's wrangler.toml.
 * `deepspace dev` runs in an app directory; the name is required.
 */
function readAppName(appDir: string): string {
  const wranglerPath = join(appDir, 'wrangler.toml')
  if (!existsSync(wranglerPath)) {
    throw new Error('No wrangler.toml found. Are you in a DeepSpace app directory?')
  }
  const parsed = parseToml(readFileSync(wranglerPath, 'utf-8')) as { name?: string }
  if (!parsed.name) {
    throw new Error('wrangler.toml has no `name` field')
  }
  return parsed.name
}

/**
 * Mint a long-lived app-owner JWT from the auth worker.
 *
 * The caller passes their own short-lived user JWT (obtained via
 * `ensureToken()` from auth.ts) and the target env's auth URL. The auth
 * worker verifies the caller, signs a 10-year owner-scoped token bound to
 * `appName`, and returns it. This same token is used in dev (written into
 * `.dev.vars`) and in production (injected as a secret at deploy time).
 */
export async function mintAppOwnerJwt(
  authUrl: string,
  callerJwt: string,
  appName: string,
): Promise<string> {
  const res = await fetch(`${authUrl}/api/auth/mint-app-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${callerJwt}`,
    },
    body: JSON.stringify({ appName }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Failed to mint APP_OWNER_JWT (${res.status}): ${err}`)
  }
  const body = (await res.json()) as { token?: string; error?: string }
  if (!body.token) {
    throw new Error(`Auth worker returned no token: ${body.error ?? 'unknown error'}`)
  }
  return body.token
}

/**
 * Write .dev.vars for an app, pointing to the specified environment's workers.
 *
 * Includes a freshly-minted `APP_OWNER_JWT` so server-side code in the app
 * (DO alarms, cron handlers, autonomous agents) can call the API worker
 * proxy without any further auth plumbing. Uses the same flow as production:
 * the auth-worker mints the token, we store it as an env var.
 */
export async function writeDevVars(
  appDir: string,
  env: EnvName,
  ownerId: string,
  callerJwt: string,
): Promise<void> {
  const urls = ENVS[env]
  const publicKey = await fetchPublicKey(urls.auth)
  const appName = readAppName(appDir)
  const appOwnerJwt = await mintAppOwnerJwt(urls.auth, callerJwt, appName)

  const devVars = [
    `AUTH_JWT_PUBLIC_KEY=${publicKey}`,
    `AUTH_JWT_ISSUER=${urls.auth}/api/auth`,
    `AUTH_WORKER_URL=${urls.auth}`,
    `API_WORKER_URL=${urls.api}`,
    `OWNER_USER_ID=${ownerId}`,
    `APP_OWNER_JWT=${appOwnerJwt}`,
    `INTERNAL_STORAGE_HMAC_SECRET=dev-${Date.now()}`,
  ].join('\n')

  writeFileSync(join(appDir, '.dev.vars'), devVars + '\n')
}
