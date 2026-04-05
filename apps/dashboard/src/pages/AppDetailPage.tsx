import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ExternalLink,
  Trash2,
  Activity,
  AlertTriangle,
  Cpu,
  Zap,
} from 'lucide-react'
import { useAppAnalytics } from '../hooks/useAppAnalytics'
import { AnalyticsChart } from '../components/AnalyticsChart'
import { undeployApp } from '../lib/api'

const periods = ['1h', '6h', '24h', '7d', '30d'] as const

export function AppDetailPage() {
  const { appName } = useParams<{ appName: string }>()
  const navigate = useNavigate()
  const [period, setPeriod] = useState<string>('24h')
  const [undeploying, setUndeploying] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const { analytics, loading, error } = useAppAnalytics(appName!, period)

  async function handleUndeploy() {
    setUndeploying(true)
    try {
      await undeployApp(appName!)
      navigate('/')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to undeploy')
      setUndeploying(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-2xl font-semibold">{appName}</h2>
            <a
              href={`https://${appName}.app.space`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {appName}.app.space
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
        <button
          onClick={() => setShowConfirm(true)}
          className="flex items-center gap-2 rounded-lg border border-destructive/30 px-3 py-1.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Undeploy
        </button>
      </div>

      {/* Undeploy confirmation */}
      {showConfirm && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-foreground mb-3">
            Are you sure you want to undeploy <strong>{appName}</strong>? This will remove the app
            and all its data.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleUndeploy}
              disabled={undeploying}
              className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {undeploying ? 'Undeploying...' : 'Confirm Undeploy'}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Summary cards */}
      {analytics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Activity className="h-4 w-4" />
              <span className="text-xs font-medium">Requests</span>
            </div>
            <p className="text-2xl font-semibold">
              {analytics.totals.requests.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium">Errors</span>
            </div>
            <p className="text-2xl font-semibold">
              {analytics.totals.errors.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Zap className="h-4 w-4" />
              <span className="text-xs font-medium">Subrequests</span>
            </div>
            <p className="text-2xl font-semibold">
              {analytics.totals.subrequests.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Cpu className="h-4 w-4" />
              <span className="text-xs font-medium">CPU p50 / p99</span>
            </div>
            <p className="text-2xl font-semibold">
              {analytics.cpuTime.p50.toFixed(1)}
              <span className="text-sm text-muted-foreground font-normal">
                {' '}/ {analytics.cpuTime.p99.toFixed(1)} ms
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Period selector */}
      <div className="flex items-center gap-1 mb-4">
        {periods.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              period === p
                ? 'bg-muted text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Chart */}
      {loading && (
        <div className="h-72 animate-pulse rounded-lg border border-border bg-muted/20" />
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {analytics && analytics.timeseries.length > 0 && (
        <div className="rounded-lg border border-border p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">
            Requests & Errors
          </h3>
          <AnalyticsChart data={analytics.timeseries} period={period} />
        </div>
      )}

      {analytics && analytics.timeseries.length === 0 && !loading && (
        <div className="rounded-lg border border-border p-12 text-center">
          <Activity className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No traffic data for the selected period.
          </p>
        </div>
      )}
    </div>
  )
}
