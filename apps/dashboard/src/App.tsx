import { Routes, Route } from 'react-router-dom'
import { useAuth } from 'deepspace'
import { LogIn } from 'lucide-react'
import { AppsPage } from './pages/AppsPage'
import { AppDetailPage } from './pages/AppDetailPage'
import { BillingPage } from './pages/BillingPage'
import { SettingsPage } from './pages/SettingsPage'
import { Sidebar } from './components/Sidebar'

function SignInScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="w-80 space-y-6 text-center">
        <h1 className="text-2xl font-semibold text-foreground">DeepSpace Console</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to manage your deployed apps.
        </p>
        <div className="space-y-3">
          <a
            href="/api/auth/social-redirect?provider=github"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            <LogIn className="h-4 w-4" />
            Continue with GitHub
          </a>
          <a
            href="/api/auth/social-redirect?provider=google"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <LogIn className="h-4 w-4" />
            Continue with Google
          </a>
        </div>
      </div>
    </div>
  )
}

export function App() {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
      </div>
    )
  }

  if (!isSignedIn) {
    return <SignInScreen />
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <Routes>
          <Route path="/" element={<AppsPage />} />
          <Route path="/apps/:appName" element={<AppDetailPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}
