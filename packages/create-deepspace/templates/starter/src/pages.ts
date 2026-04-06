/**
 * Page Registry
 *
 * Add one line per page. App.tsx reads this to generate routes and nav items.
 * Features installed via add-feature append entries here automatically.
 */

import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { Role } from './constants'

/** Lazy-load a page component with a clear error if the default export is missing. */
function lazyPage(importFn: () => Promise<Record<string, unknown>>, path: string): LazyExoticComponent<ComponentType> {
  return lazy(async () => {
    const mod = await importFn()
    if (!mod.default) {
      throw new Error(
        `Page at "${path}" is missing a default export. ` +
        `Change "export function ..." to "export default function ..." in that file.`
      )
    }
    return mod as { default: ComponentType }
  })
}

export interface PageEntry {
  path: string
  label: string | null
  component: LazyExoticComponent<ComponentType>
  roles?: Role[]
}

export const pages: PageEntry[] = [
  { path: '/home', label: 'Home', component: lazyPage(() => import('./pages/HomePage'), './pages/HomePage') },
  // ── Features add pages below this line ──
]
