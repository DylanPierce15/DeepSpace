/**
 * DeepSpace Auth Provider
 *
 * Wraps the app with auth context. Replaces SpacesAuthProvider (Clerk).
 * Better Auth handles sessions via cookies — no complex satellite
 * domain setup or provider configuration needed.
 */

import React, { useEffect, useRef } from 'react'
import { useSession } from './client'

interface DeepSpaceAuthProviderProps {
  children: React.ReactNode
}

/** Logs auth state transitions once. */
function AuthLogger() {
  const session = useSession()
  const isSignedIn = !!session.data?.user
  const prevSignedIn = useRef<boolean | null>(null)

  useEffect(() => {
    if (session.isPending) return
    if (prevSignedIn.current !== isSignedIn) {
      if (isSignedIn) {
        console.log(`[ds:auth] signed in as ${session.data?.user?.name ?? session.data?.user?.id}`)
      } else if (prevSignedIn.current !== null) {
        console.log('[ds:auth] signed out')
      }
      prevSignedIn.current = isSignedIn
    }
  }, [isSignedIn, session.isPending, session.data?.user?.name, session.data?.user?.id])

  return null
}

/**
 * Auth provider for DeepSpace apps.
 *
 * Better Auth uses cookie-based sessions, so there's no provider
 * state to manage. This component exists for API compatibility
 * and as a place to add auth-related context in the future.
 */
export function DeepSpaceAuthProvider({ children }: DeepSpaceAuthProviderProps) {
  return (
    <>
      <AuthLogger />
      {children}
    </>
  )
}
