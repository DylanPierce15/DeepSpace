/**
 * Auth Hooks for DeepSpace SDK
 *
 * Drop-in replacements for the Clerk hooks that storage code depends on.
 * These wrap Better Auth's useSession to provide a compatible API.
 *
 * In dev mode, supports test users via localStorage:
 *   localStorage.setItem('__dev_user_id', 'test-user-1')
 *   localStorage.setItem('__dev_user_name', 'Test User')
 *   localStorage.setItem('__dev_user_email', 'test@test.local')
 * This bypasses Better Auth entirely — useful for Playwright tests
 * that need multiple users without real accounts.
 */

import { useSession } from './client'

function getDevUser(): { id: string; name: string; email: string } | null {
  if (typeof window === 'undefined') return null
  const id = localStorage.getItem('__dev_user_id')
  if (!id) return null
  return {
    id,
    name: localStorage.getItem('__dev_user_name') ?? id,
    email: localStorage.getItem('__dev_user_email') ?? `${id}@test.local`,
  }
}

/**
 * Returns auth state compatible with what storage/context.tsx expects.
 */
export function useAuth() {
  const devUser = getDevUser()
  const session = useSession()

  if (devUser) {
    return {
      isLoaded: true,
      isSignedIn: true,
      userId: devUser.id,
      sessionId: `dev-${devUser.id}`,
    }
  }

  const isSignedIn = !!session.data?.user
  const userId = session.data?.user?.id ?? null

  return {
    isLoaded: !session.isPending,
    isSignedIn,
    userId,
    sessionId: session.data?.session?.id ?? null,
  }
}

/**
 * Returns user data compatible with what storage/context.tsx expects.
 */
export function useAuthUser() {
  const devUser = getDevUser()
  const session = useSession()

  if (devUser) {
    return {
      isLoaded: true,
      isSignedIn: true,
      user: {
        id: devUser.id,
        fullName: devUser.name,
        firstName: devUser.name.split(' ')[0],
        lastName: devUser.name.split(' ').slice(1).join(' ') || null,
        emailAddresses: [{ emailAddress: devUser.email }],
        imageUrl: null,
        primaryEmailAddress: { emailAddress: devUser.email },
      },
    }
  }

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
