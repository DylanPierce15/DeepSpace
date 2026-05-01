/**
 * App — global providers + shell.
 *
 * Generouted renders this around all routes.
 * Providers → auth gate → nav + page outlet.
 */

import { Suspense, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { DeepSpaceAuthProvider, useAuth } from 'deepspace'
import { RecordProvider, RecordScope } from 'deepspace'
import { ToastProvider } from '../components/ui'
import Navigation from '../components/Navigation'
import { APP_NAME, SCOPE_ID } from '../constants'
import { schemas } from '../schemas'
import { StudioProvider } from '../hooks'

export default function App() {
  return (
    <ToastProvider>
      <DeepSpaceAuthProvider>
        <AuthGate>
          <StudioProvider>
            <div
              className="bg-surface overflow-hidden flex flex-col"
              style={{ height: '100dvh' }}
            >
              <Navigation />
              <main className="flex-1 overflow-y-auto min-h-0">
                <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>}>
                  <Outlet />
                </Suspense>
              </main>
            </div>
          </StudioProvider>
        </AuthGate>
      </DeepSpaceAuthProvider>
    </ToastProvider>
  )
}

function AuthGate({ children }: { children: ReactNode }) {
  const { isLoaded } = useAuth()

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface text-content-muted">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-primary-muted border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <div>Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <RecordProvider allowAnonymous>
      <RecordScope roomId={SCOPE_ID} schemas={schemas} appId={APP_NAME}>
        {children}
      </RecordScope>
    </RecordProvider>
  )
}
