import { CreditCard, TrendingUp, ArrowUpRight } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useUser } from '../hooks/useUser'
import { useUsageSummary } from '../hooks/useUsageSummary'
import { CreditsMeter } from '../components/CreditsMeter'
import { UsageTable } from '../components/UsageTable'
import { createCheckoutSession, createPortalSession } from '../lib/api'

function tierLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1)
}

export function BillingPage() {
  const { user, loading: userLoading } = useUser()
  const { summary, loading: usageLoading } = useUsageSummary()

  const loading = userLoading || usageLoading

  async function handleUpgrade() {
    try {
      const { url } = await createCheckoutSession()
      window.location.href = url
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create checkout session')
    }
  }

  async function handleManage() {
    try {
      const { url } = await createPortalSession()
      window.location.href = url
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to open billing portal')
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Billing</h2>

      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-muted/30" />
          ))}
        </div>
      )}

      {!loading && (
        <div className="space-y-6">
          {/* Plan + Credits row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CreditCard className="h-4 w-4" />
                  <span className="text-xs font-medium">Current Plan</span>
                </div>
                {user?.subscriptionTier === 'free' ? (
                  <button
                    onClick={handleUpgrade}
                    className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    Upgrade
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                ) : (
                  <button
                    onClick={handleManage}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
                  >
                    Manage
                  </button>
                )}
              </div>
              <p className="text-2xl font-semibold">
                {tierLabel(user?.subscriptionTier ?? 'free')}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {user?.subscriptionTier === 'free'
                  ? '500 credits/month included'
                  : user?.subscriptionTier === 'starter'
                    ? '1,600 credits/month included'
                    : '4,250 credits/month included'}
              </p>
            </div>

            <div className="rounded-lg border border-border p-6">
              {summary ? (
                <CreditsMeter credits={summary.credits} />
              ) : (
                <p className="text-sm text-muted-foreground">No billing data available.</p>
              )}
            </div>
          </div>

          {/* Usage by integration chart */}
          {summary && summary.usageByIntegration.length > 0 && (
            <div className="rounded-lg border border-border p-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-4">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-medium">Usage by Integration (30 days)</span>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.usageByIntegration} layout="vertical">
                    <XAxis
                      type="number"
                      tick={{ fill: '#a1a1aa', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fill: '#a1a1aa', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18181b',
                        border: '1px solid rgba(63,63,70,0.5)',
                        borderRadius: '0.5rem',
                        color: '#fafafa',
                        fontSize: 13,
                      }}
                      formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
                    />
                    <Bar dataKey="totalCost" fill="#818cf8" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Recent usage table */}
          {summary && (
            <div className="rounded-lg border border-border p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">
                Recent API Usage
              </h3>
              <UsageTable entries={summary.recentUsage} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
