import { useState, useEffect, useCallback } from 'react'
import type { UserProfile } from '../lib/types'
import { fetchUserProfile } from '../lib/api'

export function useUser() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setUser(await fetchUserProfile())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { user, loading, error, reload: load }
}
