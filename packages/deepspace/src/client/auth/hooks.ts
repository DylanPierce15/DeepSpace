/**
 * Auth Hooks for DeepSpace SDK
 *
 * Drop-in replacements for the Clerk hooks that storage code depends on.
 * These wrap Better Auth's useSession to provide a compatible API.
 */

import { useEffect, useRef } from 'react'
import { useSession } from './client'

/**
 * Returns auth state compatible with what storage/context.tsx expects.
 * Replaces `useAuth()` from @clerk/clerk-react.
 */
export function useAuth() {
  const session = useSession()

  const isSignedIn = !!session.data?.user
  const userId = session.data?.user?.id ?? null
  const prevSignedIn = useRef<boolean | null>(null)

  useEffect(() => {
    if (session.isPending) return
    if (prevSignedIn.current !== isSignedIn) {
      if (isSignedIn) {
        console.log(`[ds:auth] signed in as ${session.data?.user?.name ?? userId}`)
      } else if (prevSignedIn.current !== null) {
        console.log('[ds:auth] signed out')
      }
      prevSignedIn.current = isSignedIn
    }
  }, [isSignedIn, session.isPending, session.data?.user?.name, userId])

  return {
    isLoaded: !session.isPending,
    isSignedIn,
    userId,
    sessionId: session.data?.session?.id ?? null,
  }
}

/**
 * Returns user data compatible with what storage/context.tsx expects.
 * Replaces `useUser()` / `useClerkUser()` from @clerk/clerk-react.
 */
export function useAuthUser() {
  const session = useSession()
  const user = session.data?.user ?? null

  return {
    isLoaded: !session.isPending,
    isSignedIn: !!user,
    user: user
      ? {
          id: user.id,
          fullName: user.name ?? null,
          firstName: user.name?.split(' ')[0] ?? null,
          lastName: user.name?.split(' ').slice(1).join(' ') || null,
          emailAddresses: user.email
            ? [{ emailAddress: user.email }]
            : [],
          imageUrl: user.image ?? null,
          primaryEmailAddress: user.email
            ? { emailAddress: user.email }
            : null,
        }
      : null,
  }
}
