/**
 * Shared test helpers for platform-worker tests.
 */

import { env } from 'cloudflare:test'
import { importPKCS8, SignJWT } from 'jose'

// ── Constants ────────────────────────────────────────────────────────────────

export const TEST_ISSUER = 'https://auth.test.deep.space'
export const TEST_AUDIENCE = 'https://api.deep.space'

// ── JWT signing ──────────────────────────────────────────────────────────────

interface TestEnvBindings {
  TEST_PRIVATE_KEY_PEM: string
  SCHEMA_REGISTRY: R2Bucket
}

function getEnv(): TestEnvBindings {
  return env as unknown as TestEnvBindings
}

/**
 * Sign a test JWT using the static ES256 key pair baked into vitest config.
 */
export async function signJwt(overrides: {
  sub?: string
  issuer?: string
  audience?: string
  expiresIn?: string
} = {}): Promise<string> {
  const pem = getEnv().TEST_PRIVATE_KEY_PEM
  const privateKey = await importPKCS8(pem, 'ES256')

  return new SignJWT({ name: 'Test User', email: 'test@deep.space' })
    .setProtectedHeader({ alg: 'ES256' })
    .setSubject(overrides.sub ?? 'test-user-001')
    .setIssuer(overrides.issuer ?? TEST_ISSUER)
    .setAudience(overrides.audience ?? TEST_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(overrides.expiresIn ?? '5m')
    .sign(privateKey)
}

// ── R2 cleanup ───────────────────────────────────────────────────────────────

/**
 * Delete all objects in the SCHEMA_REGISTRY R2 bucket under app-registry/.
 * Call in beforeEach() when isolated storage is disabled.
 */
export async function cleanRegistry(): Promise<void> {
  const bucket = getEnv().SCHEMA_REGISTRY
  const listed = await bucket.list({ prefix: 'app-registry/' })
  for (const obj of listed.objects) {
    await bucket.delete(obj.key)
  }
}
