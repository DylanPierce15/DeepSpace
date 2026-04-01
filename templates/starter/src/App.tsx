import { DeepSpaceAuthProvider, useAuth, AuthOverlay } from '@deepspace/sdk/auth'
import { RecordProvider } from '@deepspace/sdk/storage'
import { Routes, Route, Navigate } from 'react-router-dom'
import { schemas } from './schemas'
import { HomePage } from './pages/HomePage'

function AppShell() {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#0a0f1a',
        color: 'rgba(255,255,255,0.55)',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}>
        Authenticating...
      </div>
    )
  }

  return (
    <>
      {!isSignedIn && <AuthOverlay />}
      <RecordProvider schemas={schemas} allowAnonymous>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </RecordProvider>
    </>
  )
}

export function App() {
  return (
    <DeepSpaceAuthProvider>
      <AppShell />
    </DeepSpaceAuthProvider>
  )
}
