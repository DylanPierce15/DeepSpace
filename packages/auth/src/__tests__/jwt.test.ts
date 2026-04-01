import { describe, it, expect } from 'vitest'
import { generateKeyPair, exportSPKI, SignJWT } from 'jose'
import { verifyJwt } from '../jwtVerifier.js'
import type { JwtVerifierConfig } from '../types.js'

const ISSUER = 'https://auth.deep.space'

async function setup() {
  const { publicKey, privateKey } = await generateKeyPair('ES256')
  const publicKeyPem = await exportSPKI(publicKey)
  return { publicKeyPem, privateKey }
}

async function signToken(
  privateKey: CryptoKey,
  claims: Record<string, unknown> = {},
  options: { issuer?: string; expiresIn?: string; subject?: string } = {},
): Promise<string> {
  let builder = new SignJWT(claims)
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuedAt()
    .setIssuer(options.issuer ?? ISSUER)

  if (options.subject !== undefined) {
    builder = builder.setSubject(options.subject)
  }

  if (options.expiresIn) {
    builder = builder.setExpirationTime(options.expiresIn)
  } else {
    builder = builder.setExpirationTime('1h')
  }

  return builder.sign(privateKey)
}

describe('verifyJwt', () => {
  it('verifies a valid ES256 token successfully', async () => {
    const { publicKeyPem, privateKey } = await setup()
    const token = await signToken(privateKey, {}, { subject: 'user_123' })

    const config: JwtVerifierConfig = { publicKey: publicKeyPem, issuer: ISSUER }
    const outcome = await verifyJwt(config, token)

    expect(outcome.result).not.toBeNull()
    expect(outcome.error).toBeUndefined()
  })

  it('returns userId from sub claim', async () => {
    const { publicKeyPem, privateKey } = await setup()
    const token = await signToken(privateKey, {}, { subject: 'user_abc' })

    const config: JwtVerifierConfig = { publicKey: publicKeyPem, issuer: ISSUER }
    const outcome = await verifyJwt(config, token)

    expect(outcome.result?.userId).toBe('user_abc')
  })

  it('returns full claims object', async () => {
    const { publicKeyPem, privateKey } = await setup()
    const token = await signToken(
      privateKey,
      { email: 'test@deep.space', name: 'Test User' },
      { subject: 'user_456' },
    )

    const config: JwtVerifierConfig = { publicKey: publicKeyPem, issuer: ISSUER }
    const outcome = await verifyJwt(config, token)

    expect(outcome.result?.claims).toMatchObject({
      sub: 'user_456',
      email: 'test@deep.space',
      name: 'Test User',
      iss: ISSUER,
    })
    expect(outcome.result?.claims.exp).toBeTypeOf('number')
    expect(outcome.result?.claims.iat).toBeTypeOf('number')
  })

  it('rejects expired tokens', async () => {
    const { publicKeyPem, privateKey } = await setup()
    // Issue a token that expired 1 hour ago
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setIssuer(ISSUER)
      .setSubject('user_expired')
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(privateKey)

    const config: JwtVerifierConfig = { publicKey: publicKeyPem, issuer: ISSUER, clockSkewMs: 0 }
    const outcome = await verifyJwt(config, token)

    expect(outcome.result).toBeNull()
    expect(outcome.error).toBeDefined()
  })

  it('rejects tokens with wrong issuer', async () => {
    const { publicKeyPem, privateKey } = await setup()
    const token = await signToken(privateKey, {}, { subject: 'user_iss', issuer: 'https://evil.example.com' })

    const config: JwtVerifierConfig = { publicKey: publicKeyPem, issuer: ISSUER }
    const outcome = await verifyJwt(config, token)

    expect(outcome.result).toBeNull()
    expect(outcome.error).toBeDefined()
  })

  it('rejects tokens missing sub claim', async () => {
    const { publicKeyPem, privateKey } = await setup()
    // Build a token without calling setSubject
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256' })
      .setIssuedAt()
      .setIssuer(ISSUER)
      .setExpirationTime('1h')
      .sign(privateKey)

    const config: JwtVerifierConfig = { publicKey: publicKeyPem, issuer: ISSUER }
    const outcome = await verifyJwt(config, token)

    expect(outcome.result).toBeNull()
    expect(outcome.error).toBeDefined()
  })

  it('returns null result for null token input', async () => {
    const { publicKeyPem } = await setup()
    const config: JwtVerifierConfig = { publicKey: publicKeyPem, issuer: ISSUER }

    const outcome = await verifyJwt(config, null)
    expect(outcome.result).toBeNull()
    expect(outcome.error).toBeUndefined()
  })

  it('returns null result for undefined token input', async () => {
    const { publicKeyPem } = await setup()
    const config: JwtVerifierConfig = { publicKey: publicKeyPem, issuer: ISSUER }

    const outcome = await verifyJwt(config, undefined)
    expect(outcome.result).toBeNull()
    expect(outcome.error).toBeUndefined()
  })

  describe('wildcard authorized party matching', () => {
    it('accepts azp matching a wildcard pattern', async () => {
      const { publicKeyPem, privateKey } = await setup()
      const token = await signToken(
        privateKey,
        { azp: 'https://myapp.app.space' },
        { subject: 'user_azp' },
      )

      const config: JwtVerifierConfig = {
        publicKey: publicKeyPem,
        issuer: ISSUER,
        authorizedParties: ['https://*.app.space'],
      }
      const outcome = await verifyJwt(config, token)

      expect(outcome.result).not.toBeNull()
      expect(outcome.result?.userId).toBe('user_azp')
    })

    it('accepts azp matching the root domain of a wildcard', async () => {
      const { publicKeyPem, privateKey } = await setup()
      const token = await signToken(
        privateKey,
        { azp: 'https://app.space' },
        { subject: 'user_root' },
      )

      const config: JwtVerifierConfig = {
        publicKey: publicKeyPem,
        issuer: ISSUER,
        authorizedParties: ['https://*.app.space'],
      }
      const outcome = await verifyJwt(config, token)

      expect(outcome.result).not.toBeNull()
    })

    it('rejects azp not matching any authorized party', async () => {
      const { publicKeyPem, privateKey } = await setup()
      const token = await signToken(
        privateKey,
        { azp: 'https://evil.example.com' },
        { subject: 'user_bad_azp' },
      )

      const config: JwtVerifierConfig = {
        publicKey: publicKeyPem,
        issuer: ISSUER,
        authorizedParties: ['https://*.app.space'],
      }
      const outcome = await verifyJwt(config, token)

      expect(outcome.result).toBeNull()
      expect(outcome.error).toBeDefined()
    })

    it('accepts tokens without azp when authorizedParties is configured', async () => {
      const { publicKeyPem, privateKey } = await setup()
      const token = await signToken(privateKey, {}, { subject: 'user_no_azp' })

      const config: JwtVerifierConfig = {
        publicKey: publicKeyPem,
        issuer: ISSUER,
        authorizedParties: ['https://*.app.space'],
      }
      const outcome = await verifyJwt(config, token)

      expect(outcome.result).not.toBeNull()
    })

    it('accepts azp matching an exact authorized party', async () => {
      const { publicKeyPem, privateKey } = await setup()
      const token = await signToken(
        privateKey,
        { azp: 'https://specific.app.space' },
        { subject: 'user_exact' },
      )

      const config: JwtVerifierConfig = {
        publicKey: publicKeyPem,
        issuer: ISSUER,
        authorizedParties: ['https://specific.app.space'],
      }
      const outcome = await verifyJwt(config, token)

      expect(outcome.result).not.toBeNull()
    })
  })
})
