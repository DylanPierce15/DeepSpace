/**
 * Full-page frosted-glass auth overlay for deployed DeepSpace apps.
 *
 * Supports OAuth (GitHub, Google) and email/password sign-in.
 * The app renders normally behind the overlay so users can peek through.
 *
 * Ported from Miyagi3's AuthOverlay, adapted for Better Auth.
 */

import React, { useState } from 'react'
import { useAuth } from './hooks'
import { signIn, signUp } from './client'

type Mode = 'sign-in' | 'sign-up'

interface AuthOverlayProps {
  /** Called when the user clicks the close button. If omitted, overlay is not closeable. */
  onClose?: () => void
  /** Which OAuth providers to show. Defaults to both. */
  providers?: Array<'github' | 'google'>
  /** Whether to show email/password form. Defaults to true. */
  showEmailPassword?: boolean
}

export function AuthOverlay({
  onClose,
  providers = ['github', 'google'],
  showEmailPassword = true,
}: AuthOverlayProps = {}): React.ReactElement | null {
  const { isLoaded, isSignedIn } = useAuth()
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isLoaded || isSignedIn) return null

  const handleSocial = (provider: 'github' | 'google') => {
    setLoading(true)
    window.location.href = `/api/auth/social-redirect?provider=${provider}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'sign-up') {
        const result = await signUp.email({ email, password, name })
        if (result.error) {
          setError(result.error.message ?? 'Sign up failed')
          setLoading(false)
          return
        }
      } else {
        const result = await signIn.email({ email, password })
        if (result.error) {
          setError(result.error.message ?? 'Sign in failed')
          setLoading(false)
          return
        }
      }
      // On success, Better Auth sets a session cookie and useSession refreshes
      // The overlay will unmount when isSignedIn becomes true
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @keyframes ds-auth-overlay-in {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
        @keyframes ds-auth-card-in {
          from { opacity: 0; transform: translateY(16px) scale(0.97) }
          to   { opacity: 1; transform: translateY(0) scale(1) }
        }
        .ds-auth-input {
          display: block;
          width: 100%;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          color: rgba(255,255,255,0.92);
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s ease;
        }
        .ds-auth-input:focus {
          border-color: rgba(129,140,248,0.6);
        }
        .ds-auth-input::placeholder {
          color: rgba(255,255,255,0.35);
        }
        @media (max-width: 480px) {
          .ds-auth-card { margin: 16px !important; padding: 28px 22px !important }
        }
      `}</style>

      <div
        data-testid="auth-overlay"
        onClick={onClose ? (e) => { if (e.target === e.currentTarget) onClose() } : undefined}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          opacity: 0,
          animation: 'ds-auth-overlay-in 0.4s ease forwards',
        }}
      >
        <div
          className="ds-auth-card"
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 380,
            margin: 24,
            padding: '36px 32px',
            borderRadius: 18,
            background: 'rgba(15, 23, 42, 0.88)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 16px 48px rgba(0, 0, 0, 0.4), 0 0 0 0.5px rgba(255, 255, 255, 0.04) inset',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            textAlign: 'center' as const,
            opacity: 0,
            animation: 'ds-auth-card-in 0.45s cubic-bezier(0.25, 1, 0.5, 1) 0.08s forwards',
          }}
        >
          {onClose && (
            <button
              data-testid="auth-overlay-close"
              onClick={onClose}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
              }}
              aria-label="Close"
            >
              ✕
            </button>
          )}
          <div style={{
            fontSize: 22,
            fontWeight: 700,
            lineHeight: 1.3,
            color: 'rgba(255, 255, 255, 0.95)',
            marginBottom: 8,
          }}>
            {mode === 'sign-in' ? 'Sign in to DeepSpace' : 'Create your account'}
          </div>

          <div style={{
            fontSize: 14,
            lineHeight: 1.5,
            color: 'rgba(255, 255, 255, 0.55)',
            marginBottom: 24,
          }}>
            {mode === 'sign-in' ? 'Sync your data across devices' : 'Get started with DeepSpace'}
          </div>

          {providers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: showEmailPassword ? 20 : 0 }}>
              {providers.includes('github') && (
                <button
                  type="button"
                  onClick={() => handleSocial('github')}
                  disabled={loading}
                  className="ds-auth-social-btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '11px 16px',
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    cursor: loading ? 'wait' : 'pointer',
                    color: '#fff',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    boxSizing: 'border-box' as const,
                    transition: 'background 0.15s ease, border-color 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                  Continue with GitHub
                </button>
              )}
              {providers.includes('google') && (
                <button
                  type="button"
                  onClick={() => handleSocial('google')}
                  disabled={loading}
                  className="ds-auth-social-btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '11px 16px',
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    cursor: loading ? 'wait' : 'pointer',
                    color: '#fff',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    boxSizing: 'border-box' as const,
                    transition: 'background 0.15s ease, border-color 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Continue with Google
                </button>
              )}
            </div>
          )}

          {providers.length > 0 && showEmailPassword && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 20,
              color: 'rgba(255,255,255,0.25)',
              fontSize: 12,
            }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
              or
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            </div>
          )}

          {showEmailPassword && <form onSubmit={handleSubmit} style={{ textAlign: 'left' as const }}>
            {mode === 'sign-up' && (
              <div style={{ marginBottom: 12 }}>
                <input
                  className="ds-auth-input"
                  type="text"
                  placeholder="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <input
                className="ds-auth-input"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div style={{ marginBottom: error ? 12 : 20 }}>
              <input
                className="ds-auth-input"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              />
            </div>

            {error && (
              <div style={{
                fontSize: 13,
                color: '#f87171',
                marginBottom: 16,
                textAlign: 'center' as const,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'block',
                width: '100%',
                padding: '12px 20px',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
                fontFamily: 'inherit',
                textAlign: 'center' as const,
                cursor: loading ? 'wait' : 'pointer',
                color: '#fff',
                background: '#7c87f5',
                border: 'none',
                boxSizing: 'border-box' as const,
                opacity: loading ? 0.7 : 1,
                transition: 'filter 0.15s ease, transform 0.15s ease',
              }}
              onMouseEnter={e => {
                if (!loading) {
                  e.currentTarget.style.filter = 'brightness(1.1)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.filter = 'brightness(1)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              {loading ? 'Please wait...' : mode === 'sign-in' ? 'Sign in' : 'Sign up'}
            </button>
          </form>}

          {showEmailPassword && <button
            onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setError('') }}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px 20px',
              marginTop: 10,
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'inherit',
              textAlign: 'center' as const,
              cursor: 'pointer',
              color: 'rgba(255, 255, 255, 0.55)',
              background: 'transparent',
              border: 'none',
              boxSizing: 'border-box' as const,
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.85)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
          >
            {mode === 'sign-in' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>}

          <div style={{
            marginTop: 20,
            fontSize: 11,
            color: 'rgba(255, 255, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" opacity="0.5">
              <circle cx="12" cy="12" r="10" />
            </svg>
            Powered by DeepSpace
          </div>
        </div>
      </div>
    </>
  )
}
