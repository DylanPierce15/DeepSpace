# Top Navigation Bar

Horizontal nav with search and user menu

A horizontal top navigation bar with logo, nav links, search input, notification bell, and user dropdown menu. Good for simpler apps or mobile-first designs.

## Dependencies

None

## Files

Copy from `src/` in this directory to the app:

- `Topbar.tsx` → `src/components/Topbar.tsx`

## Wiring

1. Import: import Topbar, { type NavItem } from './components/Topbar'
2. Define items: const navItems: NavItem[] = [{ id: 'home', label: 'Home', path: '/' }]
3. Use: <Topbar logo={...} navItems={navItems} activeId={...} onNavigate={...} user={...} />
4. Optional: showSearch, onSearch, notificationCount, onNotificationClick

## Patterns

- `NavItem: { id, label, path?, icon?, badge? }`
- `logo → ReactNode for brand area`
- `userMenuItems → [{ id, label, onClick, danger? }]`
- `sticky={true} → fixed with blur effect`
