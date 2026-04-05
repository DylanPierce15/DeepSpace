import { Link } from 'react-router-dom'
import { Globe, Clock } from 'lucide-react'
import type { AppEntry } from '../lib/types'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function AppCard({ app }: { app: AppEntry }) {
  return (
    <Link
      to={`/apps/${app.appId}`}
      className="block rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-card/80"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-foreground">{app.appId}</h3>
        <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
          Live
        </span>
      </div>
      <div className="space-y-1.5 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5" />
          <span>{app.url}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          <span>Deployed {formatDate(app.deployedAt)}</span>
        </div>
      </div>
    </Link>
  )
}
