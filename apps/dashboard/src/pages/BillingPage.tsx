import { useState, useEffect } from 'react'
import { CreditCard, TrendingUp, ArrowUpRight, Coins, Check } from 'lucide-react'
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
import {
  createCheckoutSession,
  createPortalSession,
  upgradeSubscription,
  createCreditCheckout,
  fetchStripeConfig,
  fetchSubscriptionStatus,
  type StripeConfig,
  type SubscriptionStatus,
} from '../lib/api'

type Tier = 'free' | 'starter' | 'premium'

const TIER_ORDER: Record<Tier, number> = { free: 0, starter: 1, premium: 2 }

const PLANS: { tier: Tier; label: string; credits: number; features: string[] }[] = [
  {
    tier: 'free',
    label: 'Free',
    credits: 500,
    features: ['500 credits/month', '1 website deployment', '5 GB storage'],
  },
  {
    tier: 'starter',
    label: 'Starter',
    credits: 1600,
    features: [
      '1,600 credits/month',
      '4 website deployments',
      '15 GB storage',
      'Deepspace Agent access',
      'Library access',
    ],
  },
  {
    tier: 'premium',
    label: 'Premium',
    credits: 4250,
    features: [
      '4,250 credits/month',
      '10 website deployments',
      '30 GB storage',
      'Deepspace Agent access',
      'Library access',
      'Priority support',
      'Early beta access',
    ],
  },
]

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function BillingPage() {
  const { user, loading: userLoading } = useUser()
  const { summary, loading: usageLoading } = useUsageSummary()
  const [stripeConfig, setStripeConfig] = useState<StripeConfig | null>(null)
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null)
  const [processing, setProcessing] = useState<Tier | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const loading = userLoading || usageLoading

  useEffect(() => {
    fetchStripeConfig().then(setStripeConfig).catch(console.error)
    fetchSubscriptionStatus().then(setSubStatus).catch(console.error)
  }, [])

  const currentTier = ((subStatus?.currentTier ?? user?.subscriptionTier ?? 'free').toLowerCase()) as Tier
  const hasActiveSub = subStatus?.hasActiveSubscription ?? false

  async function handlePlanAction(tier: Tier) {
    if (!stripeConfig || tier === currentTier) return

    setProcessing(tier)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const isUpgrade = TIER_ORDER[tier] > TIER_ORDER[currentTier]

      if (tier === 'free' || !isUpgrade) {
        // Downgrade or cancel — go to Stripe Customer Portal
        const { url } = await createPortalSession()
        window.location.href = url
        return
      }

      if (hasActiveSub) {
        // Mid-cycle upgrade
        const priceId = tier === 'starter'
          ? stripeConfig.priceIds.starter_monthly
          : stripeConfig.priceIds.premium_monthly
        const result = await upgradeSubscription(priceId)
        setSuccessMsg(result.message)
        // Refresh status
        const newStatus = await fetchSubscriptionStatus()
        setSubStatus(newStatus)
      } else {
        // New subscription — redirect to Stripe Checkout
        const priceId = tier === 'starter'
          ? stripeConfig.priceIds.starter_monthly
          : stripeConfig.priceIds.premium_monthly
        const { url } = await createCheckoutSession(priceId)
        window.location.href = url
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setProcessing(null)
    }
  }

  async function handleBuyCredits() {
    setErrorMsg(null)
    try {
      const { url } = await createCreditCheckout()
      window.location.href = url
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create credit checkout')
    }
  }

  async function handleManage() {
    try {
      const { url } = await createPortalSession()
      window.location.href = url
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to open billing portal')
    }
  }

  function buttonLabel(tier: Tier): string {
    if (tier === currentTier) return 'Current Plan'
    if (tier === 'free') return 'Downgrade'
    if (TIER_ORDER[tier] > TIER_ORDER[currentTier]) {
      return hasActiveSub ? 'Upgrade' : 'Get Started'
    }
    return 'Downgrade'
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
          {/* Pending change notice */}
          {subStatus?.pendingTier && subStatus.pendingEffectiveDate && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-yellow-200">
              Your plan will change to <strong className="capitalize">{subStatus.pendingTier}</strong> on{' '}
              <strong>{new Date(subStatus.pendingEffectiveDate).toLocaleDateString()}</strong>
            </div>
          )}

          {/* Success / Error messages */}
          {successMsg && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 text-sm text-green-300">
              {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
              {errorMsg}
            </div>
          )}

          {/* Plan cards */}
          <div>
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <CreditCard className="h-4 w-4" />
              <span className="text-sm font-medium">Plans</span>
              {hasActiveSub && (
                <button
                  onClick={handleManage}
                  className="ml-auto rounded-md border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
                >
                  Manage Subscription
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PLANS.map((plan) => {
                const isCurrent = plan.tier === currentTier
                const priceCents = stripeConfig?.tierPriceCents?.[plan.tier] ?? 0

                return (
                  <div
                    key={plan.tier}
                    className={`rounded-lg border p-6 flex flex-col ${
                      isCurrent
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border hover:border-border/80'
                    }`}
                  >
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold">{plan.label}</h3>
                      <p className="text-2xl font-bold mt-1">
                        {priceCents === 0 ? 'Free' : <>{formatPrice(priceCents)}<span className="text-sm font-normal text-muted-foreground">/mo</span></>}
                      </p>
                    </div>

                    <ul className="space-y-2 mb-6 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => handlePlanAction(plan.tier)}
                      disabled={isCurrent || processing !== null}
                      className={`w-full rounded-md px-4 py-2 text-sm font-medium transition-all ${
                        isCurrent
                          ? 'bg-muted text-muted-foreground cursor-default'
                          : 'bg-primary text-primary-foreground hover:opacity-90'
                      }`}
                    >
                      {processing === plan.tier ? 'Processing...' : buttonLabel(plan.tier)}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Buy Credits */}
          <div className="rounded-lg border border-border p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Coins className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Buy Credits</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Purchase additional credits that carry over across billing cycles.
                </p>
              </div>
              <button
                onClick={handleBuyCredits}
                className="flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Buy Credits
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Credits meter */}
          {summary && (
            <div className="rounded-lg border border-border p-6">
              <CreditsMeter credits={summary.credits} />
            </div>
          )}

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
