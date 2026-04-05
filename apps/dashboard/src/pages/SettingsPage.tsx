import { User, Shield, LogOut } from 'lucide-react'
import { useAuthUser, signOut } from 'deepspace'

export function SettingsPage() {
  const { user } = useAuthUser()

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Settings</h2>

      <div className="space-y-6">
        {/* Profile */}
        <section className="rounded-lg border border-border p-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-4">
            <User className="h-4 w-4" />
            <h3 className="text-sm font-medium">Profile</h3>
          </div>
          <div className="flex items-center gap-4">
            {user?.imageUrl ? (
              <img
                src={user.imageUrl}
                alt=""
                className="h-16 w-16 rounded-full"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-lg font-medium text-muted-foreground">
                {user?.firstName?.[0] ?? '?'}
              </div>
            )}
            <div>
              <p className="font-medium text-foreground">{user?.fullName ?? 'User'}</p>
              <p className="text-sm text-muted-foreground">
                {user?.primaryEmailAddress?.emailAddress ?? ''}
              </p>
            </div>
          </div>
        </section>

        {/* Auth info */}
        <section className="rounded-lg border border-border p-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-4">
            <Shield className="h-4 w-4" />
            <h3 className="text-sm font-medium">Authentication</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Your apps authenticate via ES256 JWTs issued by the DeepSpace auth service.
            Tokens are short-lived (5 minutes) and automatically refreshed.
          </p>
          <p className="text-sm text-muted-foreground">
            Session cookies are managed by Better Auth. Sign out below to clear your session.
          </p>
        </section>

        {/* Sign out */}
        <section className="rounded-lg border border-border p-6">
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </section>
      </div>
    </div>
  )
}
