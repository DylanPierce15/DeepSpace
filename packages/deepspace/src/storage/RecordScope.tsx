/**
 * RecordScope
 *
 * Opens a direct WebSocket connection to a RecordRoom DO.
 * Manages subscriptions, reconnection, and state via RecordStore.
 * Registers collections in ScopeRegistry so hooks resolve to the right scope.
 *
 * @example
 * ```tsx
 * <RecordProvider>
 *   <RecordScope
 *     roomId="app:my-app"
 *     schemas={appSchemas}
 *     appId="my-app"
 *     sharedScopes={[
 *       { roomId: 'workspace:default', schemas: workspaceSchemas },
 *     ]}
 *   >
 *     <App />
 *   </RecordScope>
 * </RecordProvider>
 * ```
 */

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from 'react'
import type { CollectionSchema } from '../types'
import { RecordContext, type RecordContextValue } from './context'
import { useRecordAuth } from './context'
import { RecordStore } from './store'
import { useScopeRegistry, type ScopeEntry } from './ScopeRegistry'
import { getAuthToken } from '../auth'
import { parseServerError } from './serverErrors'
import type { RoomUser, ConnectionStatus, RecordData } from './types'
import {
  MSG_SUBSCRIBE,
  MSG_QUERY_RESULT,
  MSG_RECORD_CHANGE,
  MSG_ERROR,
  MSG_USER_INFO,
  MSG_USER_LIST,
  MSG_SET_ROLE,
  MSG_YJS_JOIN,
  MSG_ACK,
  MSG_LIST_SCHEMAS,
  MSG_RESUBSCRIBE,
} from './constants'

// ============================================================================
// Helpers
// ============================================================================

function recordMatchesWhere(
  record: RecordData,
  where?: Record<string, unknown>,
): boolean {
  if (!where) return true
  const data = (record as RecordData & { data: Record<string, unknown> }).data
  if (!data) return false
  return Object.entries(where).every(([key, value]) => data[key] === value)
}

// ============================================================================
// Types
// ============================================================================

interface SharedScopeConfig {
  roomId: string
  schemas: CollectionSchema[]
}

interface RecordScopeProps {
  roomId: string
  schemas: CollectionSchema[]
  children?: ReactNode
  /** App ID passed to the server for schema resolution. */
  appId: string
  /** Additional scopes to connect (headless — no children, just register collections). */
  sharedScopes?: SharedScopeConfig[]
  /** WebSocket base URL override. Derived from window.location if omitted. */
  wsUrl?: string
  /** Path prefix for WebSocket route. Default: '/ws'. */
  wsPathPrefix?: string
  /** Don't register collections in ScopeRegistry (prevents name collisions). */
  isolated?: boolean
}

// ============================================================================
// Headless scope — opens a WS connection and registers collections only
// ============================================================================

function HeadlessScope({ roomId, schemas, appId, wsUrl, wsPathPrefix }: {
  roomId: string
  schemas: CollectionSchema[]
  appId: string
  wsUrl?: string
  wsPathPrefix?: string
}) {
  return (
    <ScopeConnection
      roomId={roomId}
      schemas={schemas}
      appId={appId}
      wsUrl={wsUrl}
      wsPathPrefix={wsPathPrefix}
    />
  )
}

// ============================================================================
// Core WebSocket connection logic (shared by primary + headless scopes)
// ============================================================================

function ScopeConnection({
  roomId,
  schemas,
  appId,
  children,
  wsUrl,
  wsPathPrefix = '/ws',
  isolated = false,
}: {
  roomId: string
  schemas: CollectionSchema[]
  appId: string
  children?: ReactNode
  wsUrl?: string
  wsPathPrefix?: string
  isolated?: boolean
}) {
  const auth = useRecordAuth()
  const registry = useScopeRegistry()

  const scopeIdRef = useRef(`scope-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)

  // Room state
  const [roomRole, setRoomRole] = useState<string | null>(null)
  const [allUsers, setAllUsers] = useState<RoomUser[]>([])
  const [usersLoaded, setUsersLoaded] = useState(false)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [ready, setReady] = useState(false)
  const [discoveredSchemas, setDiscoveredSchemas] = useState<CollectionSchema[]>([])

  // Refs
  const storeRef = useRef<RecordStore>(new RecordStore())
  const wsRef = useRef<WebSocket | null>(null)
  const subscriptionMapRef = useRef<Map<string, string>>(new Map())
  const binaryHandlersRef = useRef<Set<(data: ArrayBuffer) => void>>(new Set())
  const yjsJoinHandlersRef = useRef<Map<string, Set<(canWrite: boolean) => void>>>(new Map())
  const pendingRequestsRef = useRef<Map<string, {
    resolve: (data?: unknown) => void
    reject: (error: Error) => void
    timer: ReturnType<typeof setTimeout>
  }>>(new Map())
  const reconnectAttemptRef = useRef(0)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auth refs (stable across renders)
  const userProfileRef = useRef(auth?.userProfile ?? null)
  userProfileRef.current = auth?.userProfile ?? null
  const getAuthTokenRef = useRef(auth?.getAuthToken ?? null)
  getAuthTokenRef.current = auth?.getAuthToken ?? null
  const authCallbacksRef = useRef({
    onPermissionError: auth?.onPermissionError,
    onValidationError: auth?.onValidationError,
  })
  authCallbacksRef.current.onPermissionError = auth?.onPermissionError
  authCallbacksRef.current.onValidationError = auth?.onValidationError
  const allowAnonymous = auth?.allowAnonymous ?? false

  // ── Message handler ──────────────────────────────────────────────────

  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.data instanceof ArrayBuffer) {
      binaryHandlersRef.current.forEach((h) => h(event.data as ArrayBuffer))
      return
    }

    let msg: { type: number; payload: unknown }
    try {
      msg = JSON.parse(event.data as string)
    } catch {
      console.error('[RecordScope] Failed to parse message')
      return
    }

    const { type, payload } = msg

    switch (type) {
      case MSG_USER_INFO: {
        const { role } = payload as { role: string }
        setRoomRole(role)
        setReady(true)
        reconnectAttemptRef.current = 0
        const ws = wsRef.current
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: MSG_USER_LIST, payload: {} }))
        }
        break
      }

      case MSG_USER_LIST:
        setAllUsers((payload as { users: RoomUser[] }).users)
        setUsersLoaded(true)
        break

      case MSG_QUERY_RESULT: {
        const { subscriptionId, records } = payload as { subscriptionId: string; records: RecordData[] }
        for (const [subId, queryKey] of subscriptionMapRef.current) {
          if (subId === subscriptionId) {
            storeRef.current.setQueryResult(queryKey, records)
            break
          }
        }
        break
      }

      case MSG_RECORD_CHANGE: {
        const { collection, record, changeType } = payload as {
          collection: string; record: RecordData; changeType: 'create' | 'update' | 'delete'
        }
        for (const [, queryKey] of subscriptionMapRef.current) {
          try {
            const query = JSON.parse(queryKey) as { collection: string; where?: Record<string, unknown> }
            if (query.collection !== collection) continue
            const matches = recordMatchesWhere(record, query.where)
            const exists = storeRef.current.hasRecord(queryKey, record.recordId)
            if (changeType === 'delete') {
              if (exists) storeRef.current.applyChange(queryKey, record, 'delete')
            } else if (changeType === 'create') {
              if (matches) storeRef.current.applyChange(queryKey, record, 'create')
            } else {
              if (matches && exists) storeRef.current.applyChange(queryKey, record, 'update')
              else if (matches && !exists) storeRef.current.applyChange(queryKey, record, 'create')
              else if (!matches && exists) storeRef.current.applyChange(queryKey, record, 'delete')
            }
          } catch { /* skip invalid query keys */ }
        }
        break
      }

      case MSG_ERROR: {
        const { subscriptionId, error } = payload as { subscriptionId?: string; error: string }
        if (subscriptionId) {
          for (const [subId, queryKey] of subscriptionMapRef.current) {
            if (subId === subscriptionId) {
              storeRef.current.setError(queryKey, error)
              break
            }
          }
        } else {
          const parsed = parseServerError(error)
          if (parsed.isPermissionError) {
            authCallbacksRef.current.onPermissionError?.(parsed.title, parsed.detail)
          } else {
            authCallbacksRef.current.onValidationError?.(parsed.title, parsed.detail)
          }
        }
        break
      }

      case MSG_YJS_JOIN: {
        const { collection, recordId, fieldName, canWrite } = payload as {
          collection: string; recordId: string; fieldName: string; canWrite: boolean
        }
        const docKey = `${collection}:${recordId}:${fieldName}`
        yjsJoinHandlersRef.current.get(docKey)?.forEach((h) => h(canWrite))
        break
      }

      case MSG_ACK: {
        const { requestId, success, error, ...rest } = payload as {
          requestId: string; success: boolean; error?: string; [key: string]: unknown
        }
        const pending = pendingRequestsRef.current.get(requestId)
        if (pending) {
          clearTimeout(pending.timer)
          pendingRequestsRef.current.delete(requestId)
          success ? pending.resolve(rest) : pending.reject(new Error(error || 'Mutation rejected'))
        }
        break
      }

      case MSG_LIST_SCHEMAS: {
        const { schemas: list } = payload as { schemas: CollectionSchema[] }
        setDiscoveredSchemas(list ?? [])
        break
      }

      case MSG_RESUBSCRIBE: {
        const ws = wsRef.current
        if (ws?.readyState === WebSocket.OPEN) {
          for (const [subscriptionId, queryKey] of subscriptionMapRef.current) {
            try {
              const query = JSON.parse(queryKey)
              ws.send(JSON.stringify({ type: MSG_SUBSCRIBE, payload: { subscriptionId, query } }))
            } catch { /* skip */ }
          }
        }
        break
      }
    }
  }, [roomId])

  // ── WebSocket connect ────────────────────────────────────────────────

  const connect = useCallback(async () => {
    const profile = userProfileRef.current
    const hasTokenProvider = !!getAuthTokenRef.current
    if (!profile && !hasTokenProvider && !allowAnonymous) return

    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const baseUrl = wsUrl?.replace(/^http/, 'ws') ?? `${protocol}//${window.location.host}`
    const params = new URLSearchParams()

    if (profile) {
      params.set('userId', profile.id)
      if (profile.name) params.set('userName', profile.name)
      if (profile.email) params.set('userEmail', profile.email)
      if (profile.imageUrl) params.set('userImageUrl', profile.imageUrl)
    }

    try {
      const tokenFn = getAuthTokenRef.current ?? getAuthToken
      const token = await tokenFn()
      if (token) params.set('token', token)
    } catch { /* token fetch failed — connect anyway if anonymous */ }

    params.set('appId', appId)

    const url = `${baseUrl}${wsPathPrefix}/${roomId}?${params.toString()}`
    console.log(`[ds:ws] connecting → ${roomId}`)
    const ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => {
      console.log(`[ds:ws] connected → ${roomId}`)
      setStatus('connected')
      // Re-subscribe all active queries
      for (const [subscriptionId, queryKey] of subscriptionMapRef.current) {
        try {
          const query = JSON.parse(queryKey)
          ws.send(JSON.stringify({ type: MSG_SUBSCRIBE, payload: { subscriptionId, query } }))
        } catch { /* skip */ }
      }
    }

    ws.onmessage = handleMessage

    ws.onclose = () => {
      console.log(`[ds:ws] disconnected → ${roomId}`)
      setStatus('disconnected')
      setReady(false)
      wsRef.current = null
      for (const [, queryKey] of subscriptionMapRef.current) storeRef.current.resetToLoading(queryKey)
      for (const [, pending] of pendingRequestsRef.current) {
        clearTimeout(pending.timer)
        pending.reject(new Error('WebSocket disconnected'))
      }
      pendingRequestsRef.current.clear()
      const attempt = reconnectAttemptRef.current
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000)
      reconnectAttemptRef.current = attempt + 1
      reconnectTimeoutRef.current = setTimeout(connect, delay)
    }

    ws.onerror = () => {}
  }, [roomId, wsUrl, wsPathPrefix, handleMessage, allowAnonymous, appId])

  // ── Disconnect helper ─────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    const ws = wsRef.current
    if (ws) {
      console.log(`[ds:ws] closing → ${roomId}`)
      ws.onclose = null
      ws.onmessage = null
      ws.onerror = null
      ws.close()
      wsRef.current = null
    }
    setStatus('connecting')
    setReady(false)
    reconnectAttemptRef.current = 0
  }, [roomId])

  // ── Auth identity change → disconnect and reconnect ──────────────────
  // Fires when: sign-in, sign-out, account switch, or initial load completes.
  // The identity is the user's profile ID (null = anonymous).

  const userProfileId = auth?.userProfile?.id ?? null
  const userProfileLoading = auth?.userProfileLoading ?? false

  useEffect(() => {
    // Still loading auth — wait
    if (userProfileLoading) return

    // Tear down existing connection (if any) so we reconnect with new identity
    disconnect()

    // Connect if we have auth OR anonymous is allowed
    if (userProfileId || allowAnonymous) {
      connect()
    }

    return disconnect
  }, [userProfileId, userProfileLoading, allowAnonymous, connect, disconnect])

  // Reconnect on tab focus
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && wsRef.current?.readyState !== WebSocket.OPEN) {
        reconnectAttemptRef.current = 0
        connect()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [connect])

  // ── Send helpers ─────────────────────────────────────────────────────

  const sendMessage = useCallback((message: { type: number; payload: unknown }) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message))
  }, [])

  const sendBinary = useCallback((data: Uint8Array) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) ws.send(data)
  }, [])

  const onBinaryMessage = useCallback((handler: (data: ArrayBuffer) => void) => {
    binaryHandlersRef.current.add(handler)
    return () => { binaryHandlersRef.current.delete(handler) }
  }, [])

  const registerYjsJoinHandler = useCallback((docKey: string, handler: (canWrite: boolean) => void) => {
    if (!yjsJoinHandlersRef.current.has(docKey)) yjsJoinHandlersRef.current.set(docKey, new Set())
    yjsJoinHandlersRef.current.get(docKey)!.add(handler)
    return () => {
      const handlers = yjsJoinHandlersRef.current.get(docKey)
      if (handlers) { handlers.delete(handler); if (handlers.size === 0) yjsJoinHandlersRef.current.delete(docKey) }
    }
  }, [])

  const sendConfirmed = useCallback((
    message: { type: number; payload: Record<string, unknown> },
    timeoutMs = 10000,
  ): Promise<unknown> => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error('WebSocket not connected'))
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingRequestsRef.current.delete(requestId)
        reject(new Error('Mutation confirmation timed out'))
      }, timeoutMs)
      pendingRequestsRef.current.set(requestId, { resolve, reject, timer })
      ws.send(JSON.stringify({ ...message, payload: { ...message.payload, requestId } }))
    })
  }, [])

  const setUserRole = useCallback((userId: string, role: string) => {
    sendMessage({ type: MSG_SET_ROLE, payload: { userId, role } })
  }, [sendMessage])

  const requestUserList = useCallback(() => {
    sendMessage({ type: MSG_USER_LIST, payload: {} })
  }, [sendMessage])

  const registerSubscription = useCallback((subscriptionId: string, queryKey: string) => {
    subscriptionMapRef.current.set(subscriptionId, queryKey)
  }, [])

  const unregisterSubscription = useCallback((subscriptionId: string) => {
    subscriptionMapRef.current.delete(subscriptionId)
  }, [])

  // Auto-discover schemas
  useEffect(() => {
    if (ready) sendMessage({ type: MSG_LIST_SCHEMAS, payload: {} })
  }, [ready, sendMessage])

  // ── ScopeRegistry ────────────────────────────────────────────────────

  const scopeEntryRef = useRef<ScopeEntry | null>(null)
  if (!scopeEntryRef.current) {
    scopeEntryRef.current = {
      store: storeRef.current, sendMessage, sendConfirmed,
      registerSubscription, unregisterSubscription, sendBinary, onBinaryMessage,
      registerYjsJoinHandler, ready, status,
    }
  }
  scopeEntryRef.current.ready = ready
  scopeEntryRef.current.status = status

  const registeredSchemasRef = useRef<CollectionSchema[] | null>(null)
  if (!isolated && registry && schemas !== registeredSchemasRef.current) {
    if (registeredSchemasRef.current) {
      registry.unregister(scopeIdRef.current, registeredSchemasRef.current.map((s) => s.name))
    }
    const names = schemas.map((s) => s.name)
    if (names.length > 0) registry.register(scopeIdRef.current, names, scopeEntryRef.current!)
    registeredSchemasRef.current = schemas
  }

  useEffect(() => {
    if (isolated || !registry) return
    return () => {
      const names = (registeredSchemasRef.current ?? []).map((s) => s.name)
      if (names.length > 0) registry.unregister(scopeIdRef.current, names)
    }
  }, [isolated, registry, roomId])

  // ── Context ──────────────────────────────────────────────────────────

  const registeredCollections = useMemo(() => new Set(schemas.map((s) => s.name)), [schemas])

  const value: RecordContextValue = useMemo(() => ({
    store: storeRef.current, roomId, registeredCollections,
    userProfile: auth?.userProfile ?? null,
    userProfileLoading: auth?.userProfileLoading ?? false,
    refetchUserProfile: auth?.refetchUserProfile ?? (async () => {}),
    roomRole, allUsers, usersLoaded, status, ready, discoveredSchemas,
    setUserRole, requestUserList, registerSubscription, unregisterSubscription,
    sendMessage, sendBinary, onBinaryMessage, registerYjsJoinHandler, sendConfirmed,
  }), [
    roomId, registeredCollections, auth?.userProfile, auth?.userProfileLoading,
    auth?.refetchUserProfile, roomRole, allUsers, usersLoaded, status, ready,
    discoveredSchemas, setUserRole, requestUserList, registerSubscription,
    unregisterSubscription, sendMessage, sendBinary, onBinaryMessage,
    registerYjsJoinHandler, sendConfirmed,
  ])

  if (!children) return null
  return <RecordContext.Provider value={value}>{children}</RecordContext.Provider>
}

// ============================================================================
// RecordScope (public API)
// ============================================================================

export function RecordScope({
  roomId,
  schemas,
  children,
  appId,
  sharedScopes,
  wsUrl,
  wsPathPrefix = '/ws',
  isolated = false,
}: RecordScopeProps) {
  return (
    <>
      {sharedScopes?.map((shared) => (
        <HeadlessScope
          key={shared.roomId}
          roomId={shared.roomId}
          schemas={shared.schemas}
          appId={appId}
          wsUrl={wsUrl}
          wsPathPrefix={wsPathPrefix}
        />
      ))}
      <ScopeConnection
        roomId={roomId}
        schemas={schemas}
        appId={appId}
        wsUrl={wsUrl}
        wsPathPrefix={wsPathPrefix}
        isolated={isolated}
      >
        {children}
      </ScopeConnection>
    </>
  )
}
