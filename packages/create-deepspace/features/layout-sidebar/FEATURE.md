# Sidebar Layout

App shell with collapsible sidebar and main content area

A complete app shell layout with responsive sidebar navigation. Features mobile drawer, desktop collapse/expand, and compound component pattern for flexible composition. Includes NavItem component for navigation links with icons and badges.

## Dependencies

None

## Files

Copy from `src/` in this directory to the app:

- `AppShell.tsx` → `src/components/AppShell.tsx`

## Wiring

1. Import: import AppShell, { NavItem, useSidebar } from './components/AppShell'
2. Wrap your app content with <AppShell>
3. Use compound components: AppShell.Sidebar, AppShell.Main, AppShell.Header, etc.
4. See usage example below

## Patterns

- `<AppShell> wraps entire layout`
- `<AppShell.Sidebar> → collapsible sidebar`
- `<AppShell.Main> → main content area`
- `<NavItem icon={...} label='Home' active /> for nav links`
- `useSidebar() → { isCollapsed, toggleCollapse }`
