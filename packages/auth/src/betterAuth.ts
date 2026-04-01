/**
 * Better Auth configuration factory for DeepSpace
 *
 * Provides pre-configured Better Auth instances for Cloudflare Workers + D1.
 */

import { betterAuth } from 'better-auth'
import { organization, twoFactor } from 'better-auth/plugins'

export interface DeepSpaceAuthConfig {
  /** D1 database binding */
  database: D1Database
  /** Base URL for the auth worker (e.g. "https://auth.deep.space") */
  baseURL: string
  /** Secret for session signing */
  secret: string
  /** Google OAuth credentials (optional) */
  google?: { clientId: string; clientSecret: string }
  /** GitHub OAuth credentials (optional) */
  github?: { clientId: string; clientSecret: string }
  /** Enable email/password authentication */
  emailAndPassword?: boolean
  /** Trusted origins for CORS */
  trustedOrigins?: string[]
}

/**
 * Create a Better Auth instance configured for DeepSpace.
 *
 * This is called per-request in the auth worker since D1 bindings
 * are request-scoped in Cloudflare Workers.
 */
export function createDeepSpaceAuth(config: DeepSpaceAuthConfig) {
  const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {}

  if (config.google) {
    socialProviders.google = config.google
  }
  if (config.github) {
    socialProviders.github = config.github
  }

  return betterAuth({
    database: config.database,
    baseURL: config.baseURL,
    secret: config.secret,
    emailAndPassword: {
      enabled: config.emailAndPassword ?? true,
    },
    socialProviders,
    trustedOrigins: config.trustedOrigins ?? [
      'https://deep.space',
      'https://*.deep.space',
      'https://*.app.space',
      'http://localhost:*',
    ],
    plugins: [organization(), twoFactor()],
  })
}

export type DeepSpaceAuth = ReturnType<typeof createDeepSpaceAuth>
