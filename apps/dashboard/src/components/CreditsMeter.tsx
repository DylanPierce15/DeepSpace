import type { UserCredits } from '../lib/types'

export function CreditsMeter({ credits }: { credits: UserCredits }) {
  const total = credits.subscriptionCredits + credits.bonusCredits + credits.purchasedCredits
  const max = Math.max(total, 1) // avoid division by zero

  const segments = [
    { label: 'Subscription', value: credits.subscriptionCredits, color: 'bg-primary' },
    { label: 'Bonus', value: credits.bonusCredits, color: 'bg-success' },
    { label: 'Purchased', value: credits.purchasedCredits, color: 'bg-info' },
  ].filter((s) => s.value > 0)

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-2xl font-semibold">{credits.credits.toFixed(0)}</span>
        <span className="text-sm text-muted-foreground">credits remaining</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden flex">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={`${seg.color} h-full transition-all`}
            style={{ width: `${(seg.value / max) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex gap-4 mt-2">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={`h-2 w-2 rounded-full ${seg.color}`} />
            <span>{seg.label}: {seg.value.toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
