/**
 * useToolsApi — SDK hook for calling the generic tools API.
 *
 * Provides typed helpers for CRUD operations on any collection in any scope.
 * User RBAC applies — the calling user must have the appropriate role in
 * the target scope.
 *
 * Usage:
 *   const tools = useToolsApi()
 *
 *   // Create a record
 *   const result = await tools.create('app:demo', 'events', {
 *     Title: 'Meeting', StartTime: '2025-01-01T10:00:00Z', ...
 *   })
 *
 *   // Query records
 *   const events = await tools.query('app:demo', 'events', { where: { Color: 'blue' } })
 */

import { useCallback } from 'react'
import { getAuthToken } from '../auth/token'

export interface ToolsApiResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

interface QueryOptions {
  where?: Record<string, unknown>
  orderBy?: string
  orderDir?: 'asc' | 'desc'
  limit?: number
}

async function callToolsApi<T = unknown>(
  scopeId: string,
  tool: string,
  params: Record<string, unknown>,
): Promise<ToolsApiResult<T>> {
  const token = await getAuthToken()
  const res = await fetch(`/api/tools/execute?scopeId=${encodeURIComponent(scopeId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ tool, params }),
  })

  if (!res.ok) {
    const text = await res.text()
    return { success: false, error: `HTTP ${res.status}: ${text}` }
  }

  return await res.json() as ToolsApiResult<T>
}

export function useToolsApi() {
  const create = useCallback(
    (scopeId: string, collection: string, data: Record<string, unknown>) =>
      callToolsApi<{ record: { recordId: string } }>(scopeId, 'records.create', { collection, data }),
    [],
  )

  const update = useCallback(
    (scopeId: string, collection: string, recordId: string, data: Record<string, unknown>) =>
      callToolsApi(scopeId, 'records.update', { collection, recordId, data }),
    [],
  )

  const remove = useCallback(
    (scopeId: string, collection: string, recordId: string) =>
      callToolsApi(scopeId, 'records.delete', { collection, recordId }),
    [],
  )

  const get = useCallback(
    (scopeId: string, collection: string, recordId: string) =>
      callToolsApi(scopeId, 'records.get', { collection, recordId }),
    [],
  )

  const query = useCallback(
    (scopeId: string, collection: string, options?: QueryOptions) =>
      callToolsApi<{ records: unknown[]; count: number }>(scopeId, 'records.query', {
        collection,
        ...options,
      }),
    [],
  )

  return { create, update, remove, get, query }
}
