import { NavLink } from 'react-router-dom'
import { Rocket, CreditCard, Settings, LogOut } from 'lucide-react'
import { useAuthUser, signOut } from 'deepspace'

const links = [
  { to: '/', label: 'Apps', icon: Rocket },
  { to: '/billing', label: 'Billing', icon: CreditCard },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const { user } = useAuthUser()

  return (
    <aside className="w-60 border-r border-border flex flex-col">
      <div className="p-4">
        <h1 className="text-lg font-semibold px-3 mb-6">DeepSpace Console</h1>
        <nav className="flex flex-col gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="mt-auto border-t border-border p-4">
        <div className="flex items-center gap-3 px-1 mb-3">
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt=""
              className="h-8 w-8 rounded-full"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
              {user?.firstName?.[0] ?? '?'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {user?.fullName ?? 'User'}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user?.primaryEmailAddress?.emailAddress ?? ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="flex w-full items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
