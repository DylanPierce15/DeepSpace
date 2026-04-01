/**
 * Better Auth Client for DeepSpace
 *
 * Creates a typed Better Auth client that communicates with the auth-worker.
 * This is the single source of truth for client-side auth state.
 */

import { createAuthClient } from 'better-auth/react'
import { organizationClient, twoFactorClient } from 'better-auth/client/plugins'
import { getAuthUrl } from '@deepspace/config'

export const authClient = createAuthClient({
  baseURL: getAuthUrl(),
  plugins: [organizationClient(), twoFactorClient()],
})

export const {
  useSession,
  signIn,
  signUp,
  signOut,
  useActiveOrganization,
  useListOrganizations,
} = authClient
