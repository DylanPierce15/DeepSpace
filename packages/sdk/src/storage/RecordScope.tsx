/**
 * RecordScope
 *
 * Opens one WebSocket connection to one RecordRoom DO.
 * Manages its own RecordStore, subscriptions, and reconnect logic.
 * Registers its collections in ScopeRegistry so hooks resolve correctly.
 *
 * Must be rendered inside a RecordProvider (which provides auth context
 * and ScopeRegistry).
 *
 * When a MultiplexProvider ancestor exists (deployed apps), RecordScope
 * delegates transport to the shared multiplexed WS instead of opening
 * its own connection. All internal state (RecordStore, subscriptionMap,
 * binaryHandlers, yjsJoinHandlers, pendingRequests, ScopeRegistry
 * registration) works identically in both modes.
 *
 * @example
 * ```tsx
 * // Nested scope (wraps children — useQuery resolves via React context)
 * <RecordProvider>
 *   <RecordScope roomId="app:slack-clone" schemas={appSchemas} appId="slack-clone">
 *     <RecordScope roomId={`conv:${channelId}`} schemas={convSchemas} appId="slack-clone">
 *       <ChannelView />
 *     </RecordScope>
 *   </RecordScope>
 * </RecordProvider>
 *
 * // Headless scope (no children — registers collections in ScopeRegistry only)
 * <RecordProvider>
 *   <RecordScope roomId="app:finance" schemas={appSchemas} appId="finance">
 *     <RecordScope roomId="workspace:default" schemas={workspaceSchemas} appId="finance" />
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
import type { CollectionSchema } from '@deepspace/types'
import { RecordContext, type RecordContextValue } from './context'
import { useRecordAuth } from './context'
import { RecordStore } from './store'
import { useScopeRegistry, type ScopeEntry } from './ScopeRegistry'
import { getAuthToken } from '../auth'
import { parseServerError } from './serverErrors'
import { useMultiplex, type ScopeHandle } from './MultiplexProvider'
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
// Props
// ============================================================================

interface RecordScopeProps {
  roomId: string
  schemas: CollectionSchema[]
  /**
   * Child components that can use useQuery/useMutations for this scope's
   * collections. Optional — omit for **headless scopes** (shared DOs like
   * `workspace:default`) that only need to open a WS connection and
   * register their collections in the ScopeRegistry. Hooks in
   * sibling/parent scopes can still resolve these collections.
   */
  children?: ReactNode
  /**
   * WebSocket base URL override. If not set, derived from window.location.
   * The path will be `${wsPathPrefix}/${roomId}`.
   */
  wsUrl?: string
  /**
   * Path prefix for the WebSocket route.
   * Default: '/platform/ws' (routes through platform worker).
   * RecordProvider backward-compat mode sets this to '/ws'.
   */
  wsPathPrefix?: string
  /**
   * App ID for server-side schema resolution via R2.
   * The server fetches schemas from R2 using this ID.
   * For "app:slack-clone" scopes, this is typically the app name.
   * For "conv:xyz" scopes, pass the parent app's ID.
   */
  appId: string
  /**
   * When true, this scope provides local RecordContext (useQuery,
   * useMutations preferLocal, useYjsField all work) but does NOT
   * register its collections in the global ScopeRegistry.
   * Use this to prevent collection name collisions when a nested scope
   * has overlapping collection names with an ancestor scope.
   */
  isolated?: boolean
}

// ============================================================================
// Component
// ============================================================================

export function RecordScope({
  roomId,
  schemas,
  children,
  wsUrl,
  wsPathPrefix = '/platform/ws',
  appId,
  isolated = false,
}: RecordScopeProps) {
  const auth = useRecordAuth()
  const registry = useScopeRegistry()
  const multiplex = useMultiplex()

  // Stable scope ID for ScopeRegistry ownership tracking
  const scopeIdRef = useRef(`scope-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)

  // Room state from WebSocket
  const [roomRole, setRoomRole] = useState<string | null>(null)
  const [allUsers, setAllUsers] = useState<RoomUser[]>([])
  const [usersLoaded, setUsersLoaded] = useState(false)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [ready, setReady] = useState(false)
  const [discoveredSchemas, setDiscoveredSchemas] = useState<CollectionSchema[]>([])

  // Refs
  const storeRef = useRef<RecordStore>(new RecordStore())
  const wsRef = useRef<WebSocket | null>(null)
  const muxHandleRef = useRef<ScopeHandle | null>(null)
  const subscriptionMapRef = useRef<Map<string, string>>(new Map())
  const binaryHandlersRef = useRef<Set<(data: ArrayBuffer) => void>>(new Set())
  const yjsJoinHandlersRef = useRef<
    Map<string, Set<(canWrite: boolean) => void>>
  >(new Map())
  const pendingRequestsRef = useRef<
    Map<
      string,
      {
        resolve: (data?: unknown) => void
        reject: (error: Error) => void
        timer: ReturnType<typeof setTimeout>
      }
    >
  >(new Map())
  const reconnectAttemptRef = useRef(0)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasEverBeenReadyRef = useRef(false)
  const preConnectMsgCountRef = useRef(0)
  const connectedWithProfileRef = useRef(false)

  // Auth refs (avoid re-renders triggering reconnects / stale closures)
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

  // ── Transport-agnostic message handler ─────────────────────────────
  // Processes parsed {type, payload} from either direct-WS or multiplex.

  const handleParsedMessage = useCallback(
    (msg: { type: number; payload: unknown }) => {
      const { type, payload } = msg

      switch (type) {
        case MSG_USER_INFO: {
          const serverUser = payload as { role: string }
          console.log('[WS] Ready:', { roomId, role: serverUser.role })
          setRoomRole(serverUser.role)
          setReady(true)
          hasEverBeenReadyRef.current = true
          reconnectAttemptRef.current = 0
          // Auto-request user list — use whichever transport is active
          const mux = muxHandleRef.current
          if (mux) {
            mux.sendMessage({ type: MSG_USER_LIST, payload: {} })
            // In mux mode, re-subscribe all queries after (re)connect since
            // the gateway may have re-established the DO connection.
            for (const [subscriptionId, queryKey] of subscriptionMapRef.current) {
              try {
                const query = JSON.parse(queryKey)
                mux.sendMessage({ type: MSG_SUBSCRIBE, payload: { subscriptionId, query } })
              } catch { /* skip invalid */ }
            }
          } else {
            const ws = wsRef.current
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: MSG_USER_LIST, payload: {} }))
            }
          }
          break
        }

        case MSG_USER_LIST:
          setAllUsers((payload as { users: RoomUser[] }).users)
          setUsersLoaded(true)
          break

        case MSG_QUERY_RESULT: {
          const { subscriptionId, records } = payload as {
            subscriptionId: string
            records: RecordData[]
          }
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
            collection: string
            record: RecordData
            changeType: 'create' | 'update' | 'delete'
          }

          for (const [_subId, queryKey] of subscriptionMapRef.current) {
            try {
              const query = JSON.parse(queryKey) as {
                collection: string
                where?: Record<string, unknown>
              }
              if (query.collection !== collection) continue

              const matches = recordMatchesWhere(record, query.where)
              const exists = storeRef.current.hasRecord(
                queryKey,
                record.recordId,
              )

              if (changeType === 'delete') {
                if (exists)
                  storeRef.current.applyChange(queryKey, record, 'delete')
              } else if (changeType === 'create') {
                if (matches)
                  storeRef.current.applyChange(queryKey, record, 'create')
              } else {
                if (matches && exists)
                  storeRef.current.applyChange(queryKey, record, 'update')
                else if (matches && !exists)
                  storeRef.current.applyChange(queryKey, record, 'create')
                else if (!matches && exists)
                  storeRef.current.applyChange(queryKey, record, 'delete')
              }
            } catch {
              // Skip invalid query keys
            }
          }
          break
        }

        case MSG_ERROR: {
          const { subscriptionId, error } = payload as {
            subscriptionId?: string
            error: string
          }
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
            console.error('[RecordScope] Error:', error)
          }
          break
        }

        case MSG_YJS_JOIN: {
          const { collection, recordId, fieldName, canWrite } = payload as {
            collection: string
            recordId: string
            fieldName: string
            canWrite: boolean
          }
          const docKey = `${collection}:${recordId}:${fieldName}`
          const handlers = yjsJoinHandlersRef.current.get(docKey)
          if (handlers) {
            handlers.forEach((h) => h(canWrite))
          }
          break
        }

        case MSG_ACK: {
          const { requestId, success, error, ...rest } = payload as {
            requestId: string
            success: boolean
            error?: string
            [key: string]: unknown
          }
          const pending = pendingRequestsRef.current.get(requestId)
          if (pending) {
            clearTimeout(pending.timer)
            pendingRequestsRef.current.delete(requestId)
            if (success) {
              pending.resolve(rest)
            } else {
              pending.reject(new Error(error || 'Mutation rejected'))
            }
          }
          break
        }

        case MSG_LIST_SCHEMAS: {
          const { schemas: discoveredList } = payload as {
            schemas: CollectionSchema[]
          }
          setDiscoveredSchemas(discoveredList ?? [])
          break
        }

        case MSG_RESUBSCRIBE: {
          // Team membership changed — re-subscribe all active queries
          const mux = muxHandleRef.current
          if (mux) {
            for (const [subscriptionId, queryKey] of subscriptionMapRef.current) {
              try {
                const query = JSON.parse(queryKey)
                mux.sendMessage({ type: MSG_SUBSCRIBE, payload: { subscriptionId, query } })
              } catch { /* skip invalid */ }
            }
          } else {
            const ws = wsRef.current
            if (ws && ws.readyState === WebSocket.OPEN) {
              for (const [subscriptionId, queryKey] of subscriptionMapRef.current) {
                try {
                  const query = JSON.parse(queryKey)
                  ws.send(JSON.stringify({ type: MSG_SUBSCRIBE, payload: { subscriptionId, query } }))
                } catch { /* skip invalid */ }
              }
            }
          }
          break
        }
      }
    },
    [roomId],
  )

  // ── Direct WS message handler (parses raw MessageEvent) ────────────

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (event.data instanceof ArrayBuffer) {
        binaryHandlersRef.current.forEach((h) => h(event.data as ArrayBuffer))
        return
      }

      try {
        const msg = JSON.parse(event.data as string) as {
          type: number
          payload: unknown
        }
        handleParsedMessage(msg)
      } catch (e) {
        console.error('[RecordScope] Failed to parse message:', e)
      }
    },
    [handleParsedMessage],
  )

  // ── Multiplex transport ────────────────────────────────────────────
  // When MultiplexProvider is in the tree, delegate to the shared WS.

  useEffect(() => {
    if (!multiplex) return

    const handle = multiplex.connectScope(roomId, appId)
    muxHandleRef.current = handle

    const unsubMsg = handle.onMessage((msg) => {
      handleParsedMessage(msg)
    })

    const unsubBin = handle.onBinaryMessage((data) => {
      binaryHandlersRef.current.forEach((h) => h(data))
    })

    const unsubStatus = handle.onStatusChange((s) => {
      setStatus(s)
      if (s === 'connecting') {
        setReady(false)
        for (const [, queryKey] of subscriptionMapRef.current) {
          storeRef.current.resetToLoading(queryKey)
        }
      }
    })

    return () => {
      unsubMsg()
      unsubBin()
      unsubStatus()
      // Reset before nulling handle so cleanup sendMessage() calls
      // (e.g. useQuery unsubscribe) hit the silent "pre-connection" path
      // instead of the "was previously connected" warning path.
      hasEverBeenReadyRef.current = false
      muxHandleRef.current = null
      multiplex.disconnectScope(roomId)
    }
  }, [multiplex, roomId, appId, handleParsedMessage])

  // ── Direct WebSocket connect ───────────────────────────────────────
  // Only used when MultiplexProvider is NOT in the tree.

  const connect = useCallback(async () => {
    if (multiplex) return

    const profile = userProfileRef.current
    const hasTokenProvider = !!getAuthTokenRef.current
    if (!profile && !hasTokenProvider && !allowAnonymous) {
      console.log(`[WS] connect() skipped: no profile, no token provider, not anonymous`, { roomId })
      return
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      if (profile && !connectedWithProfileRef.current) {
        console.log(`[WS] Reconnecting with profile data`, { roomId })
        hasEverBeenReadyRef.current = false
        setReady(false)
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      } else {
        return
      }
    }
    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log(`[WS] connect() skipped: already CONNECTING`, { roomId })
      return
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    let baseUrl: string
    if (wsUrl) {
      baseUrl = wsUrl.replace(/^http/, 'ws')
    } else {
      const protocol =
        window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      baseUrl = `${protocol}//${window.location.host}`
    }

    const params = new URLSearchParams()

    if (profile) {
      params.set('userId', profile.id)
      params.set('isAdmin', String(profile.isAdmin))
      if (profile.name) params.set('userName', profile.name)
      if (profile.email) params.set('userEmail', profile.email)
      if (profile.imageUrl) params.set('userImageUrl', profile.imageUrl)
    }

    const tokenStart = performance.now()
    try {
      const contextGetToken = getAuthTokenRef.current
      const token = contextGetToken
        ? await contextGetToken()
        : await getAuthToken()
      if (token) {
        params.set('token', token)
      }
      console.log(`[WS] Token acquired in ${(performance.now() - tokenStart).toFixed(0)}ms`, { roomId, hasProfile: !!profile, tokenSource: contextGetToken ? 'context' : 'tokenProvider' })
    } catch {
      console.log(`[WS] Token failed after ${(performance.now() - tokenStart).toFixed(0)}ms`, { roomId })
    }

    params.set('appId', appId)

    connectedWithProfileRef.current = !!profile

    const wsPath = `${wsPathPrefix}/${roomId}`
    const url = `${baseUrl}${wsPath}?${params.toString()}`
    console.log('[WS] Connecting:', {
      roomId,
      attempt: reconnectAttemptRef.current,
    })
    const ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'

    ws.onopen = () => {
      const pendingSubs = subscriptionMapRef.current.size
      const skippedMsgs = preConnectMsgCountRef.current
      console.log('[WS] Connected:', {
        roomId,
        appId,
        pendingSubs,
        skippedMsgs,
      })
      preConnectMsgCountRef.current = 0
      setStatus('connected')
      for (const [subscriptionId, queryKey] of subscriptionMapRef.current) {
        try {
          const query = JSON.parse(queryKey)
          ws.send(JSON.stringify({ type: MSG_SUBSCRIBE, payload: { subscriptionId, query } }))
        } catch { /* skip invalid */ }
      }
    }

    ws.onmessage = handleMessage

    ws.onclose = (event) => {
      console.log('[WS] Closed:', {
        roomId,
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      })
      setStatus('disconnected')
      setReady(false)
      wsRef.current = null

      for (const [, queryKey] of subscriptionMapRef.current) {
        storeRef.current.resetToLoading(queryKey)
      }

      for (const [_id, pending] of pendingRequestsRef.current) {
        clearTimeout(pending.timer)
        pending.reject(new Error('WebSocket disconnected'))
      }
      pendingRequestsRef.current.clear()

      const attempt = reconnectAttemptRef.current
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000)
      console.log('[WS] Scheduling reconnect:', {
        roomId,
        attempt,
        delayMs: delay,
      })

      reconnectAttemptRef.current = attempt + 1
      reconnectTimeoutRef.current = setTimeout(connect, delay)
    }

    ws.onerror = (e) => {
      console.error('[WS] Error:', { roomId, error: e })
    }

    wsRef.current = ws
  }, [
    multiplex,
    roomId,
    wsUrl,
    wsPathPrefix,
    handleMessage,
    allowAnonymous,
    appId,
  ])

  // ── Connect when auth is available (direct-WS only) ────────────────

  const userProfileLoading = auth?.userProfileLoading ?? false
  const userProfileId = auth?.userProfile?.id
  const hasAuthToken = !!auth?.getAuthToken

  useEffect(() => {
    if (multiplex) return
    const reason = userProfileId ? 'profileId' : hasAuthToken ? 'authToken' : allowAnonymous && !userProfileLoading ? 'anonymous' : null
    console.log(`[WS] Connect effect:`, { roomId, reason, userProfileId: !!userProfileId, hasAuthToken, userProfileLoading })
    if (userProfileId || hasAuthToken) {
      connect()
    } else if (allowAnonymous && !userProfileLoading) {
      connect()
    }
  }, [multiplex, userProfileId, hasAuthToken, userProfileLoading, allowAnonymous, connect])

  // Reconnect on visibility change (direct-WS only)
  useEffect(() => {
    if (multiplex) return
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const ws = wsRef.current
        const isConnected = ws?.readyState === WebSocket.OPEN
        if (!isConnected && (userProfileRef.current || getAuthTokenRef.current || allowAnonymous)) {
          console.log('[WS] Reconnecting after visibility change')
          reconnectAttemptRef.current = 0
          connect()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [multiplex, roomId, connect, allowAnonymous])

  // Cleanup on unmount or roomId change (direct-WS only)
  useEffect(() => {
    if (multiplex) return
    return () => {
      console.log('[WS] Unmounting RecordScope:', { roomId })
      hasEverBeenReadyRef.current = false
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      const ws = wsRef.current
      if (ws) {
        ws.onclose = null
        ws.onmessage = null
        ws.onerror = null
        ws.close()
        wsRef.current = null
      }
    }
  }, [multiplex, roomId])

  // ── Context methods ─────────────────────────────────────────────────

  const sendMessage = useCallback(
    (message: { type: number; payload: unknown }) => {
      const mux = muxHandleRef.current
      if (mux) {
        mux.sendMessage(message)
        return
      }
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message))
      } else if (hasEverBeenReadyRef.current) {
        console.warn(
          '[RecordScope] Cannot send message, WebSocket disconnected (was previously connected)',
          { roomId, msgType: message.type },
        )
      } else {
        preConnectMsgCountRef.current++
        console.debug(
          `[RecordScope] Skipping send (WS not yet ready), roomId=${roomId}, msgType=${message.type}, skipped#=${preConnectMsgCountRef.current}`,
        )
      }
    },
    [roomId],
  )

  // Auto-discover schemas after connection is ready
  useEffect(() => {
    if (ready) {
      sendMessage({ type: MSG_LIST_SCHEMAS, payload: {} })
    }
  }, [ready, sendMessage])

  const setUserRole = useCallback(
    (userId: string, role: string) => {
      sendMessage({ type: MSG_SET_ROLE, payload: { userId, role } })
    },
    [sendMessage],
  )

  const requestUserList = useCallback(() => {
    sendMessage({ type: MSG_USER_LIST, payload: {} })
  }, [sendMessage])

  const registerSubscription = useCallback(
    (subscriptionId: string, queryKey: string) => {
      subscriptionMapRef.current.set(subscriptionId, queryKey)
    },
    [],
  )

  const unregisterSubscription = useCallback((subscriptionId: string) => {
    subscriptionMapRef.current.delete(subscriptionId)
  }, [])

  const sendBinary = useCallback((data: Uint8Array) => {
    const mux = muxHandleRef.current
    if (mux) {
      mux.sendBinary(data)
      return
    }
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data)
    }
  }, [])

  const onBinaryMessage = useCallback(
    (handler: (data: ArrayBuffer) => void) => {
      binaryHandlersRef.current.add(handler)
      return () => {
        binaryHandlersRef.current.delete(handler)
      }
    },
    [],
  )

  const registerYjsJoinHandler = useCallback(
    (docKey: string, handler: (canWrite: boolean) => void) => {
      if (!yjsJoinHandlersRef.current.has(docKey)) {
        yjsJoinHandlersRef.current.set(docKey, new Set())
      }
      yjsJoinHandlersRef.current.get(docKey)!.add(handler)

      return () => {
        const handlers = yjsJoinHandlersRef.current.get(docKey)
        if (handlers) {
          handlers.delete(handler)
          if (handlers.size === 0) {
            yjsJoinHandlersRef.current.delete(docKey)
          }
        }
      }
    },
    [],
  )

  const sendConfirmed = useCallback(
    (
      message: { type: number; payload: Record<string, unknown> },
      timeoutMs = 10000,
    ): Promise<unknown> => {
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      const mux = muxHandleRef.current

      if (!mux) {
        const ws = wsRef.current
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          return Promise.reject(new Error('WebSocket not connected'))
        }
      }

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pendingRequestsRef.current.delete(requestId)
          reject(new Error('Mutation confirmation timed out'))
        }, timeoutMs)

        pendingRequestsRef.current.set(requestId, { resolve, reject, timer })

        const fullMsg = {
          ...message,
          payload: { ...message.payload, requestId },
        }

        if (mux) {
          mux.sendMessage(fullMsg)
        } else {
          const ws = wsRef.current
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(fullMsg))
          }
        }
      })
    },
    [],
  )

  // ── Register collections in ScopeRegistry ───────────────────────────

  const scopeEntryRef = useRef<ScopeEntry | null>(null)
  if (!scopeEntryRef.current) {
    scopeEntryRef.current = {
      store: storeRef.current,
      sendMessage,
      sendConfirmed,
      registerSubscription,
      unregisterSubscription,
      sendBinary,
      onBinaryMessage,
      registerYjsJoinHandler,
      ready,
      status,
    }
  }
  scopeEntryRef.current.ready = ready
  scopeEntryRef.current.status = status

  const registeredSchemasRef = useRef<CollectionSchema[] | null>(null)
  if (!isolated && registry && schemas !== registeredSchemasRef.current) {
    if (registeredSchemasRef.current) {
      const oldNames = registeredSchemasRef.current.map((s) => s.name)
      registry.unregister(scopeIdRef.current, oldNames)
    }
    const collectionNames = schemas.map((s) => s.name)
    if (collectionNames.length > 0) {
      registry.register(scopeIdRef.current, collectionNames, scopeEntryRef.current!)
    }
    registeredSchemasRef.current = schemas
  }

  useEffect(() => {
    if (isolated || !registry) return
    return () => {
      const collectionNames = (registeredSchemasRef.current ?? []).map((s) => s.name)
      if (collectionNames.length === 0) return
      registry.unregister(scopeIdRef.current, collectionNames)
    }
  }, [isolated, registry, roomId])

  // ── Provide RecordContext ───────────────────────────────────────────

  const registeredCollections = useMemo(
    () => new Set(schemas.map((s) => s.name)),
    [schemas],
  )

  const value: RecordContextValue = useMemo(
    () => ({
      store: storeRef.current,
      roomId,
      registeredCollections,
      userProfile: auth?.userProfile ?? null,
      userProfileLoading: auth?.userProfileLoading ?? false,
      refetchUserProfile: auth?.refetchUserProfile ?? (async () => {}),
      roomRole,
      allUsers,
      usersLoaded,
      status,
      ready,
      discoveredSchemas,
      setUserRole,
      requestUserList,
      registerSubscription,
      unregisterSubscription,
      sendMessage,
      sendBinary,
      onBinaryMessage,
      registerYjsJoinHandler,
      sendConfirmed,
    }),
    [
      roomId,
      registeredCollections,
      auth?.userProfile,
      auth?.userProfileLoading,
      auth?.refetchUserProfile,
      roomRole,
      allUsers,
      usersLoaded,
      status,
      ready,
      discoveredSchemas,
      setUserRole,
      requestUserList,
      registerSubscription,
      unregisterSubscription,
      sendMessage,
      sendBinary,
      onBinaryMessage,
      registerYjsJoinHandler,
      sendConfirmed,
    ],
  )

  if (!children) return null

  return (
    <RecordContext.Provider value={value}>{children}</RecordContext.Provider>
  )
}
