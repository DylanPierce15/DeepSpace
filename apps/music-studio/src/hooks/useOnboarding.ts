/**
 * useOnboarding — per-user walkthrough state backed by localStorage.
 */

import { useState, useEffect, useCallback } from 'react'
import { useUser } from 'deepspace'

const STORAGE_VERSION = 'v3'

function tourKey(userId: string) {
  return `ds-music-studio-tour-${STORAGE_VERSION}-${userId}`
}

export function useOnboarding() {
  const { user, isLoading } = useUser()
  const [showTour, setShowTour] = useState(false)
  const [stepIdx,  setStepIdx]  = useState(0)

  useEffect(() => {
    if (isLoading || !user) return
    const key = tourKey(user.id)
    if (!localStorage.getItem(key)) setShowTour(true)
  }, [user, isLoading])

  const completeTour = useCallback(() => {
    if (user) localStorage.setItem(tourKey(user.id), '1')
    setShowTour(false)
    setStepIdx(0)
  }, [user])

  const startTour = useCallback(() => {
    setStepIdx(0)
    setShowTour(true)
  }, [])

  const nextStep    = useCallback((total: number) => setStepIdx(i => Math.min(i + 1, total - 1)), [])
  const prevStep    = useCallback(() => setStepIdx(i => Math.max(i - 1, 0)), [])
  const jumpToStep  = useCallback((idx: number) => setStepIdx(idx), [])

  return { showTour, stepIdx, completeTour, startTour, nextStep, prevStep, jumpToStep }
}
