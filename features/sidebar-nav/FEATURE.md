# Sidebar Navigation

Collapsible sidebar with routing, role filtering, mobile drawer, and persistent collapse state

Replaces the default top-bar Navigation with a collapsible sidebar. Role-based nav filtering, localStorage collapse persistence, raised content panel layout (.app-shell + .app-content), and mobile overlay drawer. CSS is auto-appended to styles.css by the installer.

## Dependencies

None

## Files

Copy from `src/` in this directory to the app:

- `AppSidebar.tsx` → `src/components/AppSidebar.tsx`

## Wiring

1. Delete the inline Navigation function and its mobile menu from App.tsx. Keep the isChromeless variable and LANDING_PAGE_ROUTE.
2. Import { AppSidebar, SidebarMobileHeader, type SidebarNavItem } from './components/AppSidebar' and lucide-react icons for nav items. Build NAV_ITEMS: SidebarNavItem[] from the routes the app already has.
3. Replace the layout below isLoading: {!isChromeless && <SidebarMobileHeader appName={APP_NAME} onOpenMenu={openMobile} />}, then a flex wrapper with className={isChromeless ? 'flex-1 min-h-0' : 'app-shell flex-1 min-h-0'} containing {!isChromeless && <AppSidebar ... logoHref={LANDING_PAGE_ROUTE ?? undefined} />} and <main className={isChromeless ? 'flex-1 overflow-hidden' : 'app-content overflow-y-auto'}>. Add mobile open/close state (useState + useCallback).
4. Clean up unused imports from the old Navigation (useNavigate, NotificationBell, Badge if unused elsewhere).

## Patterns

- `SidebarNavItem: { path, label, icon: ReactNode, roles: Role[] }`
- `AppSidebar: appName, navItems, isMobileOpen, onMobileClose, logoHref? → pass LANDING_PAGE_ROUTE ?? undefined when landing page is installed`
- `SidebarMobileHeader: appName, onOpenMenu`
- `.app-shell → flex row shell; .app-content → raised panel with border-radius + border`
- `Mobile (<=768px): sidebar becomes overlay drawer; .app-shell padding removed; .app-content full-bleed`
