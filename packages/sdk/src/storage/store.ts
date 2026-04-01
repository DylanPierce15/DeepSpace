/**
 * RecordStore
 * 
 * Manages query subscriptions with version-tracked caching.
 * Uses external store pattern for React integration.
 */

import type { RecordData } from './types'

interface QueryState {
  status: 'loading' | 'ready' | 'error'
  records: RecordData[]  // Cached array - stable reference until data changes
  version: number        // Incremented on every change
  error?: string
}

// Stable empty array - never changes reference
const EMPTY_RECORDS: RecordData[] = []

export class RecordStore {
  private queries = new Map<string, QueryState>()
  private listeners = new Map<string, Set<() => void>>()
  /** Reference count for each query - only send SUBSCRIBE on first, UNSUBSCRIBE on last */
  private refCounts = new Map<string, number>()
  /** Track the single subscriptionId per queryKey (for deduplication) */
  private activeSubscriptions = new Map<string, string>()

  subscribe(queryKey: string, listener: () => void): () => void {
    const set = this.listeners.get(queryKey) ?? new Set()
    set.add(listener)
    this.listeners.set(queryKey, set)
    return () => {
      set.delete(listener)
      if (set.size === 0) {
        this.listeners.delete(queryKey)
      }
    }
  }

  getSnapshot(queryKey: string): RecordData[] {
    // Return stable empty array if query doesn't exist
    const state = this.queries.get(queryKey)
    if (!state) return EMPTY_RECORDS
    return state.records
  }

  getStatus(queryKey: string): 'loading' | 'ready' | 'error' {
    return this.queries.get(queryKey)?.status ?? 'loading'
  }

  getError(queryKey: string): string | undefined {
    return this.queries.get(queryKey)?.error
  }

  /**
   * Initialize a query subscription.
   * Returns true if this is the FIRST subscriber (should send SUBSCRIBE).
   */
  initQuery(queryKey: string): boolean {
    const prevCount = this.refCounts.get(queryKey) ?? 0
    this.refCounts.set(queryKey, prevCount + 1)
    
    if (!this.queries.has(queryKey)) {
      this.queries.set(queryKey, { status: 'loading', records: [], version: 0 })
    }
    
    // Return true if this is the first subscriber
    return prevCount === 0
  }
  
  /**
   * Release a query subscription.
   * Returns true if this was the LAST subscriber (should send UNSUBSCRIBE).
   */
  releaseQuery(queryKey: string): boolean {
    const count = (this.refCounts.get(queryKey) ?? 1) - 1
    
    if (count <= 0) {
      this.refCounts.delete(queryKey)
      this.activeSubscriptions.delete(queryKey)
      return true // Last subscriber
    }
    
    this.refCounts.set(queryKey, count)
    return false // Still has subscribers
  }
  
  /** Store the subscriptionId for a queryKey (for routing server responses) */
  setSubscriptionId(queryKey: string, subscriptionId: string): void {
    this.activeSubscriptions.set(queryKey, subscriptionId)
  }
  
  /** Get the subscriptionId for a queryKey */
  getSubscriptionId(queryKey: string): string | undefined {
    return this.activeSubscriptions.get(queryKey)
  }

  // Handle QUERY_RESULT from server
  setQueryResult(queryKey: string, records: RecordData[]): void {
    const current = this.queries.get(queryKey)

    this.queries.set(queryKey, {
      status: 'ready',
      records,  // New array reference
      version: (current?.version ?? 0) + 1,
    })
    this.notify(queryKey)
  }

  /** Check if a record exists in a query's results */
  hasRecord(queryKey: string, recordId: string): boolean {
    const state = this.queries.get(queryKey)
    if (!state) return false
    return state.records.some(r => r.recordId === recordId)
  }

  // Handle RECORD_CHANGE from server
  applyChange(
    queryKey: string,
    record: RecordData,
    changeType: 'create' | 'update' | 'delete'
  ): void {
    const state = this.queries.get(queryKey)
    if (!state) return

    let newRecords: RecordData[]

    if (changeType === 'delete') {
      newRecords = state.records.filter(r => r.recordId !== record.recordId)
    } else if (changeType === 'create') {
      // Check if record already exists (prevent duplicates from race conditions)
      const exists = state.records.some(r => r.recordId === record.recordId)
      if (exists) {
        // If it exists, treat as update instead
        newRecords = state.records.map(r => r.recordId === record.recordId ? record : r)
      } else {
        // Append (correct for asc order, which is the common case for real-time data)
        newRecords = [...state.records, record]
      }
    } else {
      // update
      newRecords = state.records.map(r => r.recordId === record.recordId ? record : r)
    }

    this.queries.set(queryKey, {
      ...state,
      records: newRecords,
      version: state.version + 1,
    })
    this.notify(queryKey)
  }

  /**
   * Reset a query to loading state (used on WebSocket reconnect).
   * Preserves stale records so the UI can show them while reconnecting.
   */
  resetToLoading(queryKey: string): void {
    const current = this.queries.get(queryKey)
    if (!current) return

    this.queries.set(queryKey, {
      ...current,
      status: 'loading',
      version: current.version + 1,
    })
    this.notify(queryKey)
  }

  setError(queryKey: string, error: string): void {
    const current = this.queries.get(queryKey)
    this.queries.set(queryKey, {
      status: 'error',
      records: current?.records ?? [],
      version: (current?.version ?? 0) + 1,
      error,
    })
    this.notify(queryKey)
  }

  // Cleanup when query is no longer needed
  removeQuery(queryKey: string): void {
    this.queries.delete(queryKey)
    this.listeners.delete(queryKey)
  }

  private notify(queryKey: string): void {
    const set = this.listeners.get(queryKey)
    if (set) {
      set.forEach(fn => fn())
    }
  }
}
