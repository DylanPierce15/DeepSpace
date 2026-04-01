/**
 * Full-page frosted-glass auth overlay for deployed DeepSpace apps.
 *
 * Inline email/password form — no redirects needed since we control auth.
 * The app renders normally behind the overlay so users can peek through.
 *
 * Ported from Miyagi3's AuthOverlay, adapted for Better Auth.
 */

import React, { useState } from 'react'
import { useAuth } from './hooks'
import { signIn, signUp } from './client'

type Mode = 'sign-in' | 'sign-up'

export function AuthOverlay(): React.ReactElement | null {
  const { isLoaded, isSignedIn } = useAuth()
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isLoaded || isSignedIn) return null

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

          <form onSubmit={handleSubmit} style={{ textAlign: 'left' as const }}>
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
          </form>

          <button
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
          </button>

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
