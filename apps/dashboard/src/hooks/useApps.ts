import { useState, useEffect, useCallback } from 'react'
import type { AppEntry } from '../lib/types'
import { fetchApps } from '../lib/api'

export function useApps() {
  const [apps, setApps] = useState<AppEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setApps(await fetchApps())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load apps')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { apps, loading, error, reload: load }
}
