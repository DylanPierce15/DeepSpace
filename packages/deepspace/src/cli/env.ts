/**
 * DeepSpace environment configuration.
 *
 * Shared between `dev`, `test`, and `deploy` commands.
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseSafeResponse } from '../shared/safe-response'

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
  const { data, ok, status } = await parseSafeResponse<{ publicKey?: string }>(res)
  if (!ok || !data.publicKey) {
    throw new Error(`Failed to fetch JWT public key (${status})`)
  }
  return data.publicKey
}

/**
 * Write .dev.vars for an app, pointing to the specified environment's workers.
 */
export async function writeDevVars(
  appDir: string,
  env: EnvName,
  ownerId: string,
): Promise<void> {
  const urls = ENVS[env]
  const publicKey = await fetchPublicKey(urls.auth)

  const devVars = [
    `AUTH_JWT_PUBLIC_KEY=${publicKey}`,
    `AUTH_JWT_ISSUER=${urls.auth}/api/auth`,
    `AUTH_WORKER_URL=${urls.auth}`,
    `OWNER_USER_ID=${ownerId}`,
    `INTERNAL_STORAGE_HMAC_SECRET=dev-${Date.now()}`,
  ].join('\n')

  writeFileSync(join(appDir, '.dev.vars'), devVars + '\n')
}
