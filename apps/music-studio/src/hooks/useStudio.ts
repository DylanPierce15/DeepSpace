/**
 * Studio Store — central state for the DAW
 *
 * Uses React useReducer + Context rather than Zustand to avoid
 * an external package dependency. API is kept simple so it can be
 * migrated to Zustand once the package is available.
 */

import { useContext } from 'react'
import { StudioContext } from './StudioContext'

export function useStudio() {
  const ctx = useContext(StudioContext)
  if (!ctx) throw new Error('useStudio must be used inside StudioProvider')
  return ctx
}
