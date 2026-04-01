/**
 * Auth types for DeepSpace SDK
 *
 * Replaces Clerk-specific types with provider-agnostic JWT verification types.
 */

// ============================================================================
// JWT Verification
// ============================================================================

export interface JwtVerifierConfig {
  /** PEM-encoded public key (ES256) for JWT verification */
  publicKey: string
  /** Expected issuer (e.g. "https://auth.deep.space") */
  issuer: string
  /** Expected audience (e.g. "https://api.deep.space") */
  audience?: string | string[]
  /** Allowed origins / authorized parties (supports wildcards like "https://*.app.space") */
  authorizedParties?: string[]
  /** Clock skew tolerance in milliseconds (default: 5000) */
  clockSkewMs?: number
}

export interface JwtClaims {
  sub: string
  iss?: string
  aud?: string | string[]
  azp?: string
  exp?: number
  iat?: number
  name?: string
  email?: string
  image?: string
  [key: string]: unknown
}

export interface VerifiedAuth {
  userId: string
  claims: JwtClaims
}

export interface VerifyResult extends VerifiedAuth {}

export interface TokenDebugInfo {
  iss?: string | null
  aud?: string | string[] | null
  azp?: string | null
  exp?: number | null
  iat?: number | null
}

export interface VerifyOutcome {
  result: VerifyResult | null
  debug?: TokenDebugInfo
  error?: unknown
}

// ============================================================================
// Internal Auth (HMAC)
// ============================================================================

export interface InternalSignature {
  timestamp: string
  signature: string
}

export interface VerifyInternalSignatureInput {
  secret: string | undefined
  timestamp: string | null | undefined
  signature: string | null | undefined
  payload: string
  maxSkewMs?: number
}

export interface SignInternalPayloadInput {
  secret: string
  payload: string
  timestamp?: string
}
