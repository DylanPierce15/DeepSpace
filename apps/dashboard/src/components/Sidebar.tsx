import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Apps' },
  { to: '/billing', label: 'Billing' },
  { to: '/settings', label: 'Settings' },
]

export function Sidebar() {
  return (
    <aside className="w-60 border-r border-zinc-800 p-4 flex flex-col gap-1">
      <h1 className="text-lg font-semibold mb-6 px-3">DeepSpace Console</h1>
      {links.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `px-3 py-2 rounded-md text-sm transition-colors ${
              isActive
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`
          }
        >
          {label}
        </NavLink>
      ))}
    </aside>
  )
}
