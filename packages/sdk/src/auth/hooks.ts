/**
 * Auth Hooks for DeepSpace SDK
 *
 * Drop-in replacements for the Clerk hooks that storage code depends on.
 * These wrap Better Auth's useSession to provide a compatible API.
 */

import { useSession } from './client'

/**
 * Returns auth state compatible with what storage/context.tsx expects.
 * Replaces `useAuth()` from @clerk/clerk-react.
 */
export function useAuth() {
  const session = useSession()

  return {
    isLoaded: !session.isPending,
    isSignedIn: !!session.data?.user,
    userId: session.data?.user?.id ?? null,
    sessionId: session.data?.session?.id ?? null,
  }
}

/**
 * Returns user data compatible with what storage/context.tsx expects.
 * Replaces `useUser()` / `useClerkUser()` from @clerk/clerk-react.
 */
export function useUser() {
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
