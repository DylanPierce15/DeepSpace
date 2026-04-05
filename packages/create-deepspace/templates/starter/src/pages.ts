/**
 * Page Registry
 *
 * Add one line per page. App.tsx reads this to generate routes and nav items.
 * Features installed via add-feature append entries here automatically.
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
]
