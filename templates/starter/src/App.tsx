import { useState, useEffect, type ReactNode } from 'react'
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { DeepSpaceAuthProvider, useAuth, AuthOverlay } from '@deepspace/sdk/auth'
import { RecordProvider, RecordScope, useUser } from '@deepspace/sdk/storage'
import { getGlobalDOSchemas } from '@deepspace/sdk-worker'
import type { CollectionSchema } from '@deepspace/types'
import { APP_NAME, SCOPE_ID, SHARED_CONNECTIONS, ROLES, ROLE_CONFIG, type Role } from './constants'
import { schemas } from './schemas'
import { HomePage } from './pages/HomePage'
import { TestPage } from './pages/TestPage'
import { MessagingPage } from './pages/MessagingPage'

// ============================================================================
// Shared scope config
// ============================================================================

const sharedScopes: Array<{ roomId: string; schemas: CollectionSchema[] }> =
  SHARED_CONNECTIONS
    .map((conn) => ({
      roomId: `${conn.type}:${conn.instanceId ?? conn.type}`,
      schemas: getGlobalDOSchemas(conn.type),
    }))
    .filter((s) => s.schemas.length > 0)

// ============================================================================
// Navigation
// ============================================================================

function Navigation() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)

  const userRole = (user?.role ?? 'anonymous') as Role | 'anonymous'
  const roleConfig = ROLE_CONFIG[userRole as Role] ?? { title: 'Anonymous', badgeVariant: 'secondary' }

  useEffect(() => { setMobileMenuOpen(false) }, [location.pathname])

  const navItems: Array<{ path: string; label: string }> = [
    { path: '/home', label: 'Home' },
    { path: '/test', label: 'Test' },
    { path: '/messaging', label: 'Messaging' },
  ]

  return (
    <>
      <nav
        data-testid="app-navigation"
        className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-xl"
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/home" className="text-base font-semibold text-foreground tracking-tight">
            {APP_NAME}
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right side: role badge + user/sign-in + hamburger */}
          <div className="flex items-center gap-2.5">
            <span
              data-testid="nav-role-badge"
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                roleConfig.badgeVariant === 'warning'
                  ? 'bg-warning/20 text-warning'
                  : roleConfig.badgeVariant === 'default'
                    ? 'bg-primary/20 text-primary'
                    : 'bg-secondary text-muted-foreground'
              }`}
            >
              {roleConfig.title}
            </span>

            {isSignedIn && user ? (
              <div className="flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-2.5 py-1">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                  {user.name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <span data-testid="nav-user-name" className="hidden text-sm text-muted-foreground sm:inline">
                  {user.name || user.email}
                </span>
              </div>
            ) : (
              <button
                data-testid="nav-sign-in-button"
                onClick={() => setShowAuthModal(true)}
                className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Sign In
              </button>
            )}

            {/* Hamburger (mobile) */}
            <button
              className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="border-t border-border bg-card/95 backdrop-blur-xl md:hidden">
            <div className="px-4 py-2">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`block w-full rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Auth modal — closeable overlay */}
      {showAuthModal && (
        <AuthOverlay onClose={() => setShowAuthModal(false)} />
      )}
    </>
  )
}

// ============================================================================
// Protected Route
// ============================================================================

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles: Role[]
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user } = useUser()
  if (user?.role === 'admin') return <>{children}</>
  const userRole = (user?.role ?? ROLES.VIEWER) as Role
  if (!allowedRoles.includes(userRole)) return <Navigate to="/home" replace />
  return <>{children}</>
}

// ============================================================================
// App Shell
// ============================================================================

function AppShell() {
  const { isLoaded } = useAuth()

  if (!isLoaded) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#0a0f1a',
          color: 'rgba(255,255,255,0.55)',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        Loading...
      </div>
    )
  }

  return (
    <RecordProvider allowAnonymous>
      <RecordScope
        roomId={SCOPE_ID}
        schemas={schemas}
        appId={APP_NAME}
        sharedScopes={sharedScopes}
      >
        <div className="flex min-h-screen flex-col bg-background">
          <Navigation />
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/test" element={<TestPage />} />
              <Route path="/messaging" element={<MessagingPage />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          </main>
        </div>
      </RecordScope>
    </RecordProvider>
  )
}

// ============================================================================
// App (entry)
// ============================================================================

export function App() {
  return (
    <DeepSpaceAuthProvider>
      <AppShell />
    </DeepSpaceAuthProvider>
  )
}
