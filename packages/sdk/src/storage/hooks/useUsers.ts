/**
 * useUsers Hook
 *
 * Access all users in the current room, with display data (name, avatar)
 * enriched from the PostgreSQL userProfiles table.
 */

import { useEffect, useState, useMemo } from 'react'
import { useRecordContext } from '../context'
import { getAuthToken } from '../../auth'
import { getApiUrl } from '@deepspace/config'
import type { RoomUser } from '../types'

export function useUsers(): {
  users: RoomUser[]
  usersLoaded: boolean
  setRole: (userId: string, role: string) => void
  refresh: () => void
} {
  const { allUsers, usersLoaded, setUserRole, requestUserList, ready } = useRecordContext()
  const [profiles, setProfiles] = useState<Record<string, { name: string | null; publicUsername: string; imageUrl: string | null }>>({})
  const [profilesLoaded, setProfilesLoaded] = useState(false)

  useEffect(() => {
    if (ready) requestUserList()
  }, [ready, requestUserList])

  // Fetch display profiles from API whenever the user list changes
  useEffect(() => {
    if (!usersLoaded || allUsers.length === 0) return

    const userIds = allUsers.map(u => u.id).filter(id => !id.startsWith('anon-'))
    if (userIds.length === 0) {
      setProfilesLoaded(true)
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const token = await getAuthToken()
        if (!token || cancelled) {
          if (!cancelled) setProfilesLoaded(true)
          return
        }

        const res = await fetch(`${getApiUrl()}/api/users/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userIds }),
        })
        if (cancelled) return
        if (!res.ok) {
          setProfilesLoaded(true)
          return
        }

        const data = await res.json() as { users: Record<string, { name: string | null; publicUsername: string; imageUrl: string | null }> }
        if (!cancelled) {
          setProfiles(data.users)
          setProfilesLoaded(true)
        }
      } catch {
        // API unavailable — fall back to DO data
        if (!cancelled) setProfilesLoaded(true)
      }
    })()

    return () => { cancelled = true }
  }, [usersLoaded, allUsers])

  const users = useMemo(() => {
    if (Object.keys(profiles).length === 0) return allUsers
    return allUsers.map(u => {
      const p = profiles[u.id]
      if (!p) return u
      return { ...u, name: p.name || p.publicUsername || u.name, imageUrl: p.imageUrl ?? u.imageUrl }
    })
  }, [allUsers, profiles])

  // Only report usersLoaded once profiles have been fetched (or fetch completed/failed).
  // This prevents the intermediate "Anonymous" state where DO data shows stale names
  // before the batch profile API enriches them with real names.
  return { users, usersLoaded: usersLoaded && profilesLoaded, setRole: setUserRole, refresh: requestUserList }
}
