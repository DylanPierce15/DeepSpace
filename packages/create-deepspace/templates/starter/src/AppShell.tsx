/**
 * AppShell — Provider wiring and layout chrome.
 *
 * Separated from App.tsx so React Fast Refresh handles component
 * updates without re-executing mount side-effects. App.tsx only
 * contains the page-level routes and navigation.
 */

import { DeepSpaceAuthProvider, useAuth } from 'deepspace'
import { RecordProvider, RecordScope } from 'deepspace'
import { ToastProvider } from './components/ui'
import { APP_NAME, SCOPE_ID } from './constants'
import { schemas } from './schemas'
import App from './App'

export default function AppShell() {
  return (
    <ToastProvider>
      <DeepSpaceAuthProvider>
        <AuthGate />
      </DeepSpaceAuthProvider>
    </ToastProvider>
  )
}

function AuthGate() {
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
      <RecordScope roomId={SCOPE_ID} schemas={schemas} appId={APP_NAME}>
        <App />
      </RecordScope>
    </RecordProvider>
  )
}
