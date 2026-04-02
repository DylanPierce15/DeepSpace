import { useUser } from 'deepspace'

export function HomePage() {
  const { user, isSignedIn } = useUser()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-20">
        <div className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight">
            {isSignedIn ? `Welcome, ${user?.fullName ?? 'there'}` : 'Welcome'}
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Your DeepSpace app is running.
          </p>
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-3 text-lg font-semibold">Get started</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                  src/schemas.ts
                </code>{' '}
                — Define your data collections
              </li>
              <li>
                <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                  src/pages/
                </code>{' '}
                — Add pages and routes
              </li>
              <li>
                <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                  src/actions/
                </code>{' '}
                — Add server actions
              </li>
            </ul>
          </section>

          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-3 text-lg font-semibold">Resources</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a
                  href="https://docs.deep.space"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Documentation
                </a>
              </li>
              <li>
                <a
                  href="https://deep.space/examples"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Examples
                </a>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
