/**
 * Floating dismissible guest banner for DeepSpace apps.
 *
 * Shows a non-intrusive prompt for signed-out users to sign in or sign up.
 * Dismiss state is persisted in sessionStorage so it stays hidden for the
 * duration of the browsing session.
 *
 * Ported from Miyagi3's GuestBanner, adapted for Better Auth:
 * - Removed isWidgetContext() check (no widget concept in DeepSpace)
 * - Removed useMobileBlocked() dependency
 * - Removed useAuthLauncher() — buttons call optional onSignIn/onSignUp
 *   callbacks (e.g. to open the AuthOverlay or navigate to an auth page)
 */

import React, { useEffect, useState } from 'react'
import { useAuth } from './hooks'

const DEFAULT_ACCENT = '#818cf8'
const DEFAULT_STORAGE_KEY = 'deepspace-guest-banner-dismissed'
const DEFAULT_MESSAGE = "You're browsing as a guest. Sign in to unlock all features."

export interface GuestBannerProps {
  message?: string
  storageKey?: string
  /** Called when the user clicks "Sign In". */
  onSignIn?: () => void
  /** Called when the user clicks "Sign Up". */
  onSignUp?: () => void
}

export function GuestBanner({
  message = DEFAULT_MESSAGE,
  storageKey = DEFAULT_STORAGE_KEY,
  onSignIn,
  onSignUp,
}: GuestBannerProps): React.ReactElement | null {
  const { isLoaded, isSignedIn } = useAuth()
  const [mounted, setMounted] = useState(false)

  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return sessionStorage.getItem(storageKey) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (isLoaded && !isSignedIn && !dismissed) {
      requestAnimationFrame(() => setMounted(true))
    }
  }, [dismissed, isLoaded, isSignedIn])

  if (!isLoaded || isSignedIn || dismissed) return null

  const handleDismiss = (): void => {
    try {
      sessionStorage.setItem(storageKey, '1')
    } catch {
      // best effort
    }
    setDismissed(true)
  }

  return (
    <>
      <style>{`
        @keyframes ds-guest-banner-in {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 540px) {
          .ds-guest-banner {
            top: 52px !important;
            padding: 10px 14px !important;
            gap: 10px !important;
            flex-wrap: wrap !important;
          }
          .ds-guest-banner-dot { display: none !important; }
          .ds-guest-banner-msg { font-size: 13px !important; }
          .ds-guest-banner-actions { gap: 6px !important; }
          .ds-guest-banner-actions button { padding: 6px 12px !important; font-size: 12px !important; }
        }
      `}</style>
      <div
        className="ds-guest-banner"
        role="banner"
        data-testid="guest-banner"
        style={{
          position: 'fixed',
          top: 12,
          left: 12,
          right: 12,
          marginLeft: 'auto',
          marginRight: 'auto',
          zIndex: 99998,
          maxWidth: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '14px 18px',
          borderRadius: 14,
          fontFamily:
            "var(--theme-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
          fontSize: 14,
          lineHeight: 1.45,
          color: 'var(--theme-text, rgba(255,255,255,0.92))',
          background: 'var(--theme-panel-bg, rgba(15, 23, 42, 0.82))',
          border: '1px solid var(--theme-panel-border, rgba(255,255,255,0.1))',
          boxShadow:
            'var(--theme-component-shadow, 0 8px 32px rgba(0,0,0,0.35)), 0 0 0 0.5px rgba(255,255,255,0.04) inset',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          opacity: mounted ? 1 : 0,
          animation: mounted
            ? 'ds-guest-banner-in 0.35s cubic-bezier(0.25, 1, 0.5, 1) forwards'
            : 'none',
          pointerEvents: mounted ? 'auto' : 'none',
        }}
      >
        <div
          className="ds-guest-banner-dot"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: `var(--theme-accent, ${DEFAULT_ACCENT})`,
            flexShrink: 0,
            boxShadow: `0 0 8px var(--theme-accent, ${DEFAULT_ACCENT})`,
          }}
        />

        <span
          className="ds-guest-banner-msg"
          style={{
            flex: 1,
            minWidth: 0,
            fontWeight: 500,
            color: 'var(--theme-text-secondary, rgba(255,255,255,0.7))',
          }}
        >
          {message}
        </span>

        <div
          className="ds-guest-banner-actions"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            data-testid="guest-banner-signup"
            onClick={onSignUp}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '7px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              color: 'var(--theme-accent-contrast, #fff)',
              background: `var(--theme-accent, ${DEFAULT_ACCENT})`,
              border: 'none',
              transition: 'filter 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = 'brightness(1.15)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = 'brightness(1)'
            }}
          >
            Sign Up
          </button>

          <button
            type="button"
            data-testid="guest-banner-signin"
            onClick={onSignIn}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '7px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              color: 'var(--theme-text-secondary, rgba(255,255,255,0.65))',
              background: 'var(--theme-button-bg, rgba(255,255,255,0.07))',
              border: '1px solid var(--theme-button-border, rgba(255,255,255,0.1))',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                'var(--theme-button-hover, rgba(255,255,255,0.12))'
              e.currentTarget.style.color = 'var(--theme-text, rgba(255,255,255,0.92))'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                'var(--theme-button-bg, rgba(255,255,255,0.07))'
              e.currentTarget.style.color =
                'var(--theme-text-secondary, rgba(255,255,255,0.65))'
            }}
          >
            Sign In
          </button>

          <button
            className="ds-guest-banner-dismiss"
            data-testid="guest-banner-dismiss"
            onClick={handleDismiss}
            aria-label="Dismiss banner"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--theme-text-tertiary, rgba(255,255,255,0.35))',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              borderRadius: 6,
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--theme-text, rgba(255,255,255,0.9))'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color =
                'var(--theme-text-tertiary, rgba(255,255,255,0.35))'
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </>
  )
}
