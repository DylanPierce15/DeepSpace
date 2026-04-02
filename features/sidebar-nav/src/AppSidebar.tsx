/**
 * AppSidebar — collapsible left navigation sidebar.
 *
 * Features:
 * - Collapsed (52px): icon-only with right-side tooltips
 * - Expanded (240px): icons + labels + user chip
 * - Mobile (<=768px): overlay drawer with backdrop
 * - Collapse state persisted to localStorage
 * - Role-based nav filtering via useUser()
 * - Active state via react-router-dom useLocation
 *
 * Icon alignment: 8px section padding + 36px icon box = icon center at 26px.
 * Collapsed width 52px → center at 26px. Icons stay fixed in place during
 * expand/collapse; only the sidebar width and label opacity animate.
 *
 * Nav items are passed via props so App.tsx controls the route list.
 *
 * Companion CSS (sidebar-nav.css) is auto-appended to styles.css
 * by the feature installer.
 */

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { PanelLeft, Zap, Menu } from 'lucide-react'
import { useUser } from 'deepspace'
import { ROLES, ROLE_CONFIG, type Role } from '../constants'

// ============================================================================
// Types
// ============================================================================

export interface SidebarNavItem {
  path: string
  label: string
  icon: ReactNode
  roles: Role[]
}

interface AppSidebarProps {
  appName: string
  navItems: SidebarNavItem[]
  isMobileOpen: boolean
  onMobileClose: () => void
  /** When set and sidebar is expanded, the logo links to this path (e.g. '/welcome'). */
  logoHref?: string
}

// ============================================================================
// localStorage helpers
// ============================================================================

const STORAGE_KEY = 'app-sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function writeCollapsed(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(value))
  } catch {
    // localStorage may be unavailable in sandboxed iframes
  }
}

// ============================================================================
// Mobile header — rendered outside the sidebar, visible only on mobile
// ============================================================================

interface MobileHeaderProps {
  appName: string
  onOpenMenu: () => void
}

export function SidebarMobileHeader({ appName, onOpenMenu }: MobileHeaderProps) {
  return (
    <div className="sidebar-mobile-header">
      <button
        type="button"
        className="sidebar-mobile-hamburger"
        onClick={onOpenMenu}
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>
      <span className="sidebar-mobile-title">{appName}</span>
    </div>
  )
}

// ============================================================================
// AppSidebar
// ============================================================================

export function AppSidebar({ appName, navItems, isMobileOpen, onMobileClose, logoHref }: AppSidebarProps) {
  const location = useLocation()
  const { user } = useUser()
  const isAdmin = user?.role === 'admin'

  const [isCollapsed, setIsCollapsed] = useState(readCollapsed)
  const [logoHovered, setLogoHovered] = useState(false)

  const sidebarWidth = isCollapsed ? 52 : 240

  const userRole = (user?.role ?? ROLES.VIEWER) as Role
  const roleConfig = ROLE_CONFIG[userRole] ?? ROLE_CONFIG[ROLES.VIEWER]

  const visibleNavItems = isAdmin
    ? navItems
    : navItems.filter(item => item.roles.includes(userRole))

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed(prev => {
      const next = !prev
      writeCollapsed(next)
      return next
    })
  }, [])

  // Close mobile drawer on route change
  useEffect(() => {
    onMobileClose()
  }, [location.pathname, onMobileClose])

  const handleLogoClick = () => {
    if (isMobileOpen) {
      onMobileClose()
    } else if (isCollapsed) {
      toggleCollapsed()
    }
  }

  const showTooltip = isCollapsed && !isMobileOpen

  const sidebarClasses = [
    'sidebar',
    isCollapsed ? 'collapsed' : '',
    isMobileOpen ? 'mobile-open' : '',
  ].filter(Boolean).join(' ')

  return (
    <>
      {isMobileOpen && (
        <div className="sidebar-mobile-backdrop" onClick={onMobileClose} />
      )}

      <nav
        className={sidebarClasses}
        style={{ width: sidebarWidth }}
      >
        {/* Logo row */}
        <div className="sidebar-logo-row">
          {isCollapsed && !isMobileOpen ? (
            <button
              type="button"
              className={`sidebar-logo-btn ${showTooltip ? 'sidebar-tooltip-right' : ''}`}
              onClick={handleLogoClick}
              data-tooltip={showTooltip ? 'Open Sidebar' : undefined}
              onMouseEnter={() => setLogoHovered(true)}
              onMouseLeave={() => setLogoHovered(false)}
            >
              {showTooltip && logoHovered ? (
                <PanelLeft size={18} />
              ) : (
                <Zap size={18} />
              )}
            </button>
          ) : logoHref ? (
            <Link to={logoHref} className="sidebar-logo-btn">
              <Zap size={18} />
            </Link>
          ) : (
            <button type="button" className="sidebar-logo-btn" onClick={handleLogoClick}>
              <Zap size={18} />
            </button>
          )}
          {logoHref && !isCollapsed ? (
            <Link to={logoHref} className="sidebar-logo-text">{appName}</Link>
          ) : (
            <span className="sidebar-logo-text">{appName}</span>
          )}
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={toggleCollapsed}
            title="Collapse sidebar"
          >
            <PanelLeft size={16} />
          </button>
        </div>

        {/* Navigation items */}
        <div className="sidebar-nav-section">
          {visibleNavItems.map(item => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar-nav-item ${isActive ? 'active' : ''} ${showTooltip ? 'sidebar-tooltip-right' : ''}`}
                data-tooltip={showTooltip ? item.label : undefined}
              >
                <span className="sidebar-nav-icon">{item.icon}</span>
                <span className="sidebar-nav-label">{item.label}</span>
              </Link>
            )
          })}
        </div>

        {/* User chip pinned to bottom */}
        {user && (
          <div className="sidebar-user-section">
            <div className="sidebar-user-chip">
              {user.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt=""
                  className="sidebar-user-avatar"
                />
              ) : (
                <div className="sidebar-user-avatar-fallback">
                  {user.name?.[0]?.toUpperCase() ?? '?'}
                </div>
              )}
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user.name}</span>
                <span className="sidebar-user-role">{roleConfig.title}</span>
              </div>
            </div>
          </div>
        )}
      </nav>
    </>
  )
}
