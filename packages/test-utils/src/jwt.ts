/**
 * JWT test utilities — generates signed ES256 tokens for testing
 * auth-protected routes without a real auth-worker.
 *
 * Call `generateTestKeyPair()` once in your vitest config to get a
 * PEM public key (bind as AUTH_JWT_PUBLIC_KEY) and use `signTestJwt()`
 * in tests to produce valid Bearer tokens.
 */

import { exportSPKI, generateKeyPair, SignJWT } from 'jose'

export interface TestKeyPair {
  publicKeyPem: string
  privateKey: CryptoKey
}

let _cachedKeyPair: TestKeyPair | null = null

/**
 * Lazily generate an ES256 key pair (cached per process).
 * In vitest-pool-workers the code runs inside workerd so we use
 * SubtleCrypto which is available on all edge runtimes.
 */
export async function getTestKeyPair(): Promise<TestKeyPair> {
  if (_cachedKeyPair) return _cachedKeyPair

  const { publicKey, privateKey } = await generateKeyPair('ES256')
  const publicKeyPem = await exportSPKI(publicKey)

  _cachedKeyPair = { publicKeyPem, privateKey }
  return _cachedKeyPair
}

export interface TestJwtOptions {
  userId?: string
  email?: string
  name?: string
  image?: string
  issuer?: string
  audience?: string
  expiresIn?: string
}

/**
 * Sign a test JWT. The token will be verifiable by @deep-space/auth's
 * `verifyJwt()` when the matching public key is set in env.
 */
export async function signTestJwt(
  privateKey: CryptoKey,
  opts: TestJwtOptions = {},
): Promise<string> {
  const {
    userId = 'test-user-001',
    email = 'test@deep.space',
    name = 'Test User',
    image = null,
    issuer = 'https://auth.test.deep.space',
    audience = 'https://api.deep.space',
    expiresIn = '5m',
  } = opts

  const jwt = new SignJWT({
    name,
    email,
    ...(image ? { image } : {}),
  })
    .setProtectedHeader({ alg: 'ES256' })
    .setSubject(userId)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)

  return jwt.sign(privateKey)
}
