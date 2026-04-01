export function AppsPage() {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Your Apps</h2>
      <div className="rounded-lg border border-zinc-800 p-12 text-center text-zinc-500">
        <p className="mb-4">No apps deployed yet.</p>
        <p className="text-sm">
          Run <code className="bg-zinc-800 px-2 py-1 rounded text-zinc-300">npx create-deepspace-app my-app</code> to get started.
        </p>
      </div>
    </div>
  )
}
