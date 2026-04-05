/**
 * Auth helper components for DeepSpace SDK
 *
 * Conditional rendering based on auth state, plus a display name hook.
 * Ported from Miyagi3's authButtons.tsx, adapted from Clerk to Better Auth.
 */

import type { ReactNode } from 'react'
import { useAuth, useAuthUser } from './hooks'

/**
 * Renders children only when the user is signed in.
 */
export function SignedIn({ children }: { children: ReactNode }): React.ReactElement | null {
  const { isLoaded, isSignedIn } = useAuth()
  if (!isLoaded || !isSignedIn) return null
  return <>{children}</>
}

/**
 * Renders children only when the user is signed out.
 */
export function SignedOut({ children }: { children: ReactNode }): React.ReactElement | null {
  const { isLoaded, isSignedIn } = useAuth()
  if (!isLoaded || isSignedIn) return null
  return <>{children}</>
}

/**
 * Auth-aware container that shows different content based on auth state.
 *
 * When signed in, renders `children`.
 * When signed out, renders `fallback` (defaults to a sign-in prompt).
 */
export interface AuthGateProps {
  /** Content to show when signed in */
  children: ReactNode
  /** Content to show when signed out (defaults to sign-in prompt) */
  fallback?: ReactNode
  /** Custom message for the default sign-in prompt */
  signInMessage?: string
}

export function AuthGate({
  children,
  fallback,
  signInMessage = 'Sign in to continue',
}: AuthGateProps): React.ReactElement {
  const defaultFallback = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        padding: '2rem',
      }}
    >
      <p style={{ color: '#888' }}>{signInMessage}</p>
    </div>
  )

  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>{fallback ?? defaultFallback}</SignedOut>
    </>
  )
}

/**
 * Returns the current user's display name.
 *
 * Resolution order: fullName -> firstName -> email prefix -> 'User'.
 * Returns null when no user is signed in.
 */
export function useDisplayName(): string | null {
  const { user } = useAuthUser()
  if (!user) return null
  return (
    user.fullName ||
    user.firstName ||
    user.primaryEmailAddress?.emailAddress?.split('@')[0] ||
    'User'
  )
}
