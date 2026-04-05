import { useState, useEffect, useCallback } from 'react'
import type { AppAnalytics } from '../lib/types'
import { fetchAppAnalytics } from '../lib/api'

export function useAppAnalytics(appName: string, period: string = '24h') {
  const [analytics, setAnalytics] = useState<AppAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setAnalytics(await fetchAppAnalytics(appName, period))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [appName, period])

  useEffect(() => { load() }, [load])

  return { analytics, loading, error, reload: load }
}
