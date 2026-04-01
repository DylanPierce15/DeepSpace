/**
 * JWT Verification for DeepSpace
 *
 * Replaces Clerk's verifyToken with jose-based ES256 JWT verification.
 * Compatible with Cloudflare Workers (jose runs on edge runtimes).
 */

import { importSPKI, jwtVerify } from 'jose'
import type { JwtVerifierConfig, VerifyResult, VerifyOutcome, JwtClaims } from './types.js'
import { decodeJwtPayload, normalizeArray } from './utils.js'

const DEFAULT_CLOCK_SKEW_MS = 5_000

/**
 * Check if azp matches any pattern in authorizedParties.
 * Supports wildcards like "https://*.app.space"
 */
function matchesAuthorizedParty(
  azp: string | null | undefined,
  patterns: string[],
): boolean {
  // Tokens without azp are valid (e.g., server-issued tokens)
  if (!azp) return true

  for (const pattern of patterns) {
    if (pattern === azp) return true

    if (pattern.includes('*')) {
      const escaped: string = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      const regexPattern: string = escaped.replace(/\*/g, '[^/]*')
      const regex: RegExp = new RegExp(`^${regexPattern}$`)
      if (regex.test(azp)) return true

      // "*.example.com" also allows "example.com"
      if (pattern.includes('*.')) {
        const rootPattern: string = pattern.replace('*.', '')
        if (rootPattern === azp) return true
      }
    }
  }

  return false
}

// Cache imported keys to avoid re-importing on every request
const keyCache = new Map<string, CryptoKey>()

async function getPublicKey(pem: string): Promise<CryptoKey> {
  const cached = keyCache.get(pem)
  if (cached) return cached
  // .dev.vars stores PEM with literal \n — replace with actual newlines
  const normalized = pem.replace(/\\n/g, '\n')
  const key = await importSPKI(normalized, 'ES256')
  keyCache.set(pem, key)
  return key
}

/**
 * Verify a DeepSpace JWT token.
 *
 * @param config - Verification configuration (public key, issuer, audience)
 * @param token - The JWT string to verify
 * @returns VerifyOutcome with either the verified result or error details
 */
export async function verifyJwt(
  config: JwtVerifierConfig,
  token: string | null | undefined,
): Promise<VerifyOutcome> {
  if (!token) {
    return { result: null }
  }

  try {
    const publicKey = await getPublicKey(config.publicKey)

    const audience = normalizeArray(config.audience)
    const clockTolerance = Math.floor(
      (config.clockSkewMs ?? DEFAULT_CLOCK_SKEW_MS) / 1000,
    )

    const { payload } = await jwtVerify(token, publicKey, {
      issuer: config.issuer,
      audience: audience && audience.length === 1 ? audience[0] : audience,
      clockTolerance,
    })

    const claims = payload as JwtClaims

    if (!claims.sub) {
      throw new Error('JWT verification succeeded but subject claim is missing')
    }

    // Check authorized parties if configured
    const authorizedParties = normalizeArray(config.authorizedParties)
    if (authorizedParties) {
      const azp = claims.azp
      if (!matchesAuthorizedParty(azp, authorizedParties)) {
        throw new Error(
          `Authorized party '${azp}' does not match any allowed pattern`,
        )
      }
    }

    return {
      result: {
        userId: claims.sub,
        claims,
      },
    }
  } catch (error) {
    return {
      result: null,
      error,
      debug: decodeJwtPayload(token),
    }
  }
}
