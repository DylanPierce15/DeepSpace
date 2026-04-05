import { Rocket, Terminal } from 'lucide-react'
import { useApps } from '../hooks/useApps'
import { AppCard } from '../components/AppCard'

export function AppsPage() {
  const { apps, loading, error } = useApps()

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Your Apps</h2>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-lg border border-border bg-muted/30"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {!loading && !error && apps.length === 0 && (
        <div className="rounded-lg border border-border p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <Rocket className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="mb-2 text-foreground font-medium">No apps deployed yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Create and deploy your first DeepSpace app to see it here.
          </p>
          <div className="inline-flex items-center gap-2 rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground">
            <Terminal className="h-4 w-4" />
            <code>npx create-deepspace my-app</code>
          </div>
        </div>
      )}

      {!loading && !error && apps.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {apps.map((app) => (
            <AppCard key={app.appId} app={app} />
          ))}
        </div>
      )}
    </div>
  )
}
