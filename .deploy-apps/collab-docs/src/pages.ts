/**
 * Page Registry
 *
 * Add one line per page. App.tsx reads this to generate routes and nav items.
 * Features installed via add-feature.cjs append lines here automatically.
 *
 * Format: { path, label, component, roles? }
 *   - path: URL path (e.g., '/items')
 *   - label: Nav bar label (e.g., 'Items'). Set to null to hide from nav.
 *   - component: Lazy-loaded React component
 *   - roles: Optional array of roles that can access this page (admin-only, etc.)
 */

import { lazy } from 'react'
import type { Role } from './constants'

export interface PageEntry {
  path: string
  label: string | null
  component: React.LazyExoticComponent<React.ComponentType>
  roles?: Role[]
}

export const pages: PageEntry[] = [
  { path: '/home', label: 'Home', component: lazy(() => import('./pages/HomePage')) },
  // ── Features add pages below this line ──
  { path: '/docs', label: 'YjsDoc', component: lazy(() => import('./pages/YjsDocPage')) },
]
