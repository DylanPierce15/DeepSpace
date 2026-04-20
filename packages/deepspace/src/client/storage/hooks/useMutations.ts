/**
 * useMutations Hook
 *
 * Get mutation functions for a collection.
 * Resolves the correct scope via ScopeRegistry (multi-scope)
 * or falls back to useRecordContext() (single-scope backward compat).
 */

import { useCallback, useContext, useMemo } from 'react'
import { RecordContext } from '../context'
import { useScopeRegistry } from '../ScopeRegistry'
import { MSG } from '@/shared/protocol/constants'

/**
 * Get mutation functions for a collection.
 *
 * @example
 * ```tsx
 * const { create, put, remove, createConfirmed, putConfirmed, removeConfirmed } = useMutations('tasks')
 *
 * // Fire-and-forget
 * const id = await create({ title: 'New task' })
 * await put(id, { title: 'Updated task' })
 * await remove(id)
 *
 * // Server-acknowledged
 * const id2 = await createConfirmed({ title: 'New task' })
 * ```
 */
export function useMutations<T = unknown>(collection: string): {
  create: (data: T) => Promise<string>
  put: (recordId: string, data: T) => Promise<void>
  remove: (recordId: string) => Promise<void>
  createConfirmed: (data: T) => Promise<string>
  putConfirmed: (recordId: string, data: T) => Promise<void>
  removeConfirmed: (recordId: string) => Promise<void>
} {
  // Try scope resolution first (multi-scope), then fall back to RecordContext
  const registry = useScopeRegistry()
  const recordCtx = useContext(RecordContext)

  const scopeEntry = registry?.resolve(collection) ?? null

  // Prefer RecordContext when this scope handles the collection (avoids stale ScopeRegistry during navigation)
  const preferLocal = recordCtx?.registeredCollections?.has(collection) ?? false
  const sendMessage = preferLocal ? recordCtx!.sendMessage : (scopeEntry?.sendMessage ?? recordCtx?.sendMessage)
  const sendConfirmed = preferLocal ? recordCtx!.sendConfirmed : (scopeEntry?.sendConfirmed ?? recordCtx?.sendConfirmed)

  if (!sendMessage || !sendConfirmed) {
    throw new Error(
      `useMutations('${collection}'): No scope found. Wrap in a RecordProvider (with roomId) or a RecordScope that registers this collection.`,
    )
  }

  const create = useCallback(
    async (data: T): Promise<string> => {
      const recordId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
      sendMessage({ type: MSG.PUT, payload: { collection, recordId, data } })
      return recordId
    },
    [sendMessage, collection],
  )

  const put = useCallback(
    async (recordId: string, data: T): Promise<void> => {
      sendMessage({ type: MSG.PUT, payload: { collection, recordId, data } })
    },
    [sendMessage, collection],
  )

  const remove = useCallback(
    async (recordId: string): Promise<void> => {
      sendMessage({ type: MSG.DELETE, payload: { collection, recordId } })
    },
    [sendMessage, collection],
  )

  const createConfirmed = useCallback(
    async (data: T): Promise<string> => {
      const recordId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
      await sendConfirmed({
        type: MSG.PUT,
        payload: { collection, recordId, data: data as Record<string, unknown> },
      })
      return recordId
    },
    [sendConfirmed, collection],
  )

  const putConfirmed = useCallback(
    async (recordId: string, data: T): Promise<void> => {
      await sendConfirmed({
        type: MSG.PUT,
        payload: { collection, recordId, data: data as Record<string, unknown> },
      })
    },
    [sendConfirmed, collection],
  )

  const removeConfirmed = useCallback(
    async (recordId: string): Promise<void> => {
      await sendConfirmed({ type: MSG.DELETE, payload: { collection, recordId } })
    },
    [sendConfirmed, collection],
  )

  // Memoize the return object so consumers get a stable reference.
  // Without this, every render produces a new object, which breaks any
  // useCallback/useEffect that depends on the useMutations() result
  // (e.g., cleanup effects re-fire and delete records they shouldn't).
  return useMemo(
    () => ({ create, put, remove, createConfirmed, putConfirmed, removeConfirmed }),
    [create, put, remove, createConfirmed, putConfirmed, removeConfirmed],
  )
}
