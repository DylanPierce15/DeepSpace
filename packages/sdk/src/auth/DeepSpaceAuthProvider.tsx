/**
 * DeepSpace Auth Provider
 *
 * Wraps the app with auth context. Replaces SpacesAuthProvider (Clerk).
 * Better Auth handles sessions via cookies — no complex satellite
 * domain setup or provider configuration needed.
 */

import React from 'react'

interface DeepSpaceAuthProviderProps {
  children: React.ReactNode
}

/**
 * Auth provider for DeepSpace apps.
 *
 * Better Auth uses cookie-based sessions, so there's no provider
 * state to manage. This component exists for API compatibility
 * and as a place to add auth-related context in the future.
 */
export function DeepSpaceAuthProvider({ children }: DeepSpaceAuthProviderProps) {
  return <>{children}</>
}
