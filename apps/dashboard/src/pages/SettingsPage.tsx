export function SettingsPage() {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Settings</h2>
      <div className="space-y-6">
        <section className="rounded-lg border border-zinc-800 p-6">
          <h3 className="font-medium mb-4">OAuth Providers</h3>
          <p className="text-sm text-zinc-500">Configure authentication providers for your deployed apps.</p>
        </section>
        <section className="rounded-lg border border-zinc-800 p-6">
          <h3 className="font-medium mb-4">Custom Domains</h3>
          <p className="text-sm text-zinc-500">Map custom domains to your deployed apps.</p>
        </section>
      </div>
    </div>
  )
}
