import { useState, useEffect, useCallback } from 'react'
import type { UsageSummary } from '../lib/types'
import { fetchUsageSummary } from '../lib/api'

export function useUsageSummary() {
  const [summary, setSummary] = useState<UsageSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSummary(await fetchUsageSummary())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { summary, loading, error, reload: load }
}
