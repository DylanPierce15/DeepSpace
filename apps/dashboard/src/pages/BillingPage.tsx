export function BillingPage() {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Billing</h2>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="rounded-lg border border-zinc-800 p-6">
          <p className="text-sm text-zinc-500 mb-1">Plan</p>
          <p className="text-lg font-medium">Free</p>
        </div>
        <div className="rounded-lg border border-zinc-800 p-6">
          <p className="text-sm text-zinc-500 mb-1">Credits Remaining</p>
          <p className="text-lg font-medium">500</p>
        </div>
        <div className="rounded-lg border border-zinc-800 p-6">
          <p className="text-sm text-zinc-500 mb-1">Usage This Period</p>
          <p className="text-lg font-medium">0</p>
        </div>
      </div>
    </div>
  )
}
