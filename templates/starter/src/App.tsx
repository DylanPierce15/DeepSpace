import { useState, useEffect, type ReactNode } from 'react'
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { DeepSpaceAuthProvider, useAuth, AuthOverlay } from '@deepspace/sdk/auth'
import { RecordProvider, RecordScope, useUser } from '@deepspace/sdk/storage'
import { getGlobalDOSchemas } from '@deepspace/sdk-worker'
import type { CollectionSchema } from '@deepspace/types'
import { APP_NAME, SCOPE_ID, SHARED_CONNECTIONS, ROLES, ROLE_CONFIG, type Role } from './constants'
import { schemas } from './schemas'
import { HomePage } from './pages/HomePage'

// ============================================================================
// Shared scope config — built from SHARED_CONNECTIONS at module level
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
  const { user } = useUser()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const userRole = (user?.role ?? ROLES.VIEWER) as Role
  const roleConfig = ROLE_CONFIG[userRole] ?? ROLE_CONFIG[ROLES.VIEWER]

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const navItems: Array<{ path: string; label: string; roles: Role[] }> = [
    { path: '/home', label: 'Home', roles: [ROLES.VIEWER, ROLES.MEMBER, ROLES.ADMIN] },
    // Add more nav items here:
    // { path: '/items', label: 'Items', roles: [ROLES.MEMBER, ROLES.ADMIN] },
  ]

  const isAdmin = user?.role === 'admin'
  const visibleNavItems = isAdmin
    ? navItems
    : navItems.filter((item) => item.roles.includes(userRole))

  return (
    <nav
      data-testid="app-navigation"
      className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* App name */}
        <Link to="/home" className="text-base font-semibold text-foreground tracking-tight">
          {APP_NAME}
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          {visibleNavItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* User info + role badge + hamburger */}
        <div className="flex items-center gap-2.5">
          {/* Role badge */}
          <span
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

          {/* User pill */}
          {user && (
            <div className="flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-2.5 py-1">
              {user.imageUrl ? (
                <img src={user.imageUrl} alt="" className="h-6 w-6 rounded-full" />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                  {user.name?.[0]?.toUpperCase() ?? '?'}
                </div>
              )}
              <span data-testid="nav-user-name" className="hidden text-sm text-muted-foreground sm:inline">
                {user.name || user.email}
              </span>
            </div>
          )}

          {/* Hamburger (mobile) */}
          <button
            className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="border-t border-border bg-card/95 backdrop-blur-xl md:hidden">
          <div className="px-4 py-2">
            {visibleNavItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`block w-full rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </nav>
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
  const { user, isLoading } = useUser()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (user?.role === 'admin') return <>{children}</>

  const userRole = (user?.role ?? ROLES.VIEWER) as Role
  if (!allowedRoles.includes(userRole)) {
    return <Navigate to="/home" replace />
  }

  return <>{children}</>
}

// ============================================================================
// Root Redirect
// ============================================================================

function RootRedirect() {
  return <Navigate to="/home" replace />
}

// ============================================================================
// App Shell
// ============================================================================

function AppShell() {
  const { isLoaded, isSignedIn } = useAuth()

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
    <>
      {!isSignedIn && <AuthOverlay />}
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
                <Route path="/" element={<RootRedirect />} />
                <Route path="/home" element={<HomePage />} />
                {/* Add more routes here:
                <Route
                  path="/admin/*"
                  element={
                    <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                      <AdminPage />
                    </ProtectedRoute>
                  }
                />
                */}
                <Route path="*" element={<Navigate to="/home" replace />} />
              </Routes>
            </main>
          </div>
        </RecordScope>
      </RecordProvider>
    </>
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
