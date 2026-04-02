/**
 * RecordProvider Context
 *
 * Provides WebSocket connection and state management for RecordRoom.
 *
 * Multi-scope mode: RecordProvider can be used without roomId
 * to provide only auth context + ScopeRegistry. RecordScope components
 * handle individual WebSocket connections.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from 'react'
import type { CollectionSchema } from '@deep-space/types'
import { useAuth, getAuthToken } from '../auth'
import { RecordStore } from './store'
import { ScopeRegistryProvider } from './ScopeRegistry'
import { parseServerError } from './serverErrors'
import type {
  UserProfile,
  RoomUser,
  ConnectionStatus,
  FetchUserProfile,
  RecordData,
} from './types'
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
  MSG_RESUBSCRIBE,
} from './constants'

// ============================================================================
// RecordContext (per-scope connection state)
// ============================================================================

export interface RecordContextValue {
  store: RecordStore
  roomId: string
  /** Collection names registered by this scope's schemas (used for scope resolution priority). */
  registeredCollections?: Set<string>
  userProfile: UserProfile | null
  userProfileLoading: boolean
  refetchUserProfile: () => Promise<void>
  roomRole: string | null
  allUsers: RoomUser[]
  /** True once the first MSG_USER_LIST response has been received. */
  usersLoaded: boolean
  status: ConnectionStatus
  ready: boolean
  /** Schemas discovered via MSG_LIST_SCHEMAS from the server. Available after ready. */
  discoveredSchemas?: CollectionSchema[]
  setUserRole: (userId: string, role: string) => void
  requestUserList: () => void
  registerSubscription: (subscriptionId: string, queryKey: string) => void
  unregisterSubscription: (subscriptionId: string) => void
  sendMessage: (message: { type: number; payload: unknown }) => void
  sendBinary: (data: Uint8Array) => void
  onBinaryMessage: (handler: (data: ArrayBuffer) => void) => () => void
  registerYjsJoinHandler: (docKey: string, handler: (canWrite: boolean) => void) => () => void
  sendConfirmed: (message: { type: number; payload: Record<string, unknown> }, timeoutMs?: number) => Promise<unknown>
}

export const RecordContext = createContext<RecordContextValue | null>(null)

export function useRecordContext(): RecordContextValue {
  const ctx = useContext(RecordContext)
  if (!ctx) {
    throw new Error('useRecordContext must be used within a RecordProvider')
  }
  return ctx
}

// ============================================================================
// RecordAuthContext (shared auth state for RecordScope)
// ============================================================================

export interface RecordAuthContextValue {
  userProfile: UserProfile | null
  userProfileLoading: boolean
  refetchUserProfile: () => Promise<void>
  allowAnonymous: boolean
  /** Called by RecordScope when it receives an RBAC permission error */
  onPermissionError?: (title: string, detail: string) => void
  /** Called by RecordScope when it receives a validation/other error */
  onValidationError?: (title: string, detail: string) => void
  /** Get auth token for WebSocket connections. */
  getAuthToken?: () => Promise<string | null>
}

const RecordAuthContext = createContext<RecordAuthContextValue | null>(null)

export function useRecordAuth(): RecordAuthContextValue | null {
  return useContext(RecordAuthContext)
}

// ============================================================================
// Helpers
// ============================================================================

function recordMatchesWhere(record: RecordData, where?: Record<string, unknown>): boolean {
  if (!where) return true
  const data = (record as RecordData & { data: Record<string, unknown> }).data
  if (!data) return false
  return Object.entries(where).every(([key, value]) => data[key] === value)
}

// ============================================================================
// Core Provider (handles WebSocket connection — backward compat mode)
// ============================================================================

interface RecordProviderCoreProps {
  roomId: string
  schemas: CollectionSchema[]
  wsUrl?: string
  children: ReactNode
  fetchUser: FetchUserProfile
  allowAnonymous?: boolean
  getAuthToken?: () => Promise<string | null>
}

function RecordProviderCore({
  roomId,
  schemas,
  wsUrl,
  children,
  fetchUser,
  allowAnonymous = false,
  getAuthToken: getAuthTokenProp,
}: RecordProviderCoreProps): React.ReactElement {

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [userProfileLoading, setUserProfileLoading] = useState(true)

  const [roomRole, setRoomRole] = useState<string | null>(null)
  const [allUsers, setAllUsers] = useState<RoomUser[]>([])
  const [usersLoaded, setUsersLoaded] = useState(false)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [ready, setReady] = useState(false)

  // Callback refs for error handling — used by handleMessage (which has [] deps)
  // so it can invoke the latest callbacks without re-creating on every render.
  const onPermissionErrorRef = useRef<((title: string, detail: string) => void) | undefined>(undefined)
  const onValidationErrorRef = useRef<((title: string, detail: string) => void) | undefined>(undefined)

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
  const connectedWithProfileRef = useRef(false)
  const userProfileRef = useRef<UserProfile | null>(null)

  userProfileRef.current = userProfile

  const refetchUserProfile = useCallback(async () => {
    try {
      const profile = await fetchUser()
      setUserProfile(profile)
    } catch (err) {
      console.error('[RecordProvider] Failed to refetch user profile:', err)
    }
  }, [fetchUser])

  // Fetch user profile on mount and refresh periodically.
  // fetchUser returns null when not signed in — that's fine.
  useEffect(() => {
    let mounted = true
    setUserProfileLoading(true)
    fetchUser()
      .then(profile => { if (mounted) setUserProfile(profile) })
      .finally(() => { if (mounted) setUserProfileLoading(false) })

    const interval = setInterval(() => {
      if (mounted) fetchUser().then(p => { if (mounted) setUserProfile(p) })
    }, 30000)

    return () => { mounted = false; clearInterval(interval) }
  }, [fetchUser])

  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.data instanceof ArrayBuffer) {
      binaryHandlersRef.current.forEach(handler => handler(event.data as ArrayBuffer))
      return
    }

    try {
      const msg = JSON.parse(event.data as string) as { type: number; payload: unknown }
      const { type, payload } = msg

      switch (type) {
        case MSG_USER_INFO: {
          const serverUser = payload as { role: string }
          console.log('[WS] Ready:', { roomId, role: serverUser.role })
          setRoomRole(serverUser.role)
          setReady(true)
          reconnectAttemptRef.current = 0
          // Auto-request user list as part of connection handshake
          const ws = wsRef.current
          if (ws && ws.readyState === WebSocket.OPEN) {
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
          for (const [_subId, queryKey] of subscriptionMapRef.current) {
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
            } catch { /* Skip invalid query keys */ }
          }
          break
        }
        case MSG_ERROR: {
          const { subscriptionId, error } = payload as { subscriptionId?: string; error: string }
          if (subscriptionId) {
            for (const [subId, queryKey] of subscriptionMapRef.current) {
              if (subId === subscriptionId) { storeRef.current.setError(queryKey, error); break }
            }
          } else {
            const parsed = parseServerError(error)
            console.error('[RecordProvider] Error:', error)
            // Errors are surfaced via callback refs — the consuming app
            // is responsible for displaying them (no built-in overlays/toasts).
            if (parsed.isPermissionError) {
              onPermissionErrorRef.current?.(parsed.title, parsed.detail)
            } else {
              onValidationErrorRef.current?.(parsed.title, parsed.detail)
            }
          }
          break
        }
        case MSG_YJS_JOIN: {
          const { collection, recordId, fieldName, canWrite } = payload as {
            collection: string; recordId: string; fieldName: string; canWrite: boolean
          }
          const docKey = `${collection}:${recordId}:${fieldName}`
          yjsJoinHandlersRef.current.get(docKey)?.forEach(handler => handler(canWrite))
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
            if (success) pending.resolve(rest)
            else pending.reject(new Error(error || 'Mutation rejected'))
          }
          break
        }
        case MSG_RESUBSCRIBE: {
          // Team membership changed — re-subscribe all active queries
          const ws = wsRef.current
          if (ws && ws.readyState === WebSocket.OPEN) {
            for (const [subscriptionId, queryKey] of subscriptionMapRef.current) {
              try {
                const query = JSON.parse(queryKey)
                ws.send(JSON.stringify({ type: MSG_SUBSCRIBE, payload: { subscriptionId, query } }))
              } catch { /* skip invalid */ }
            }
          }
          break
        }
      }
    } catch (e) {
      console.error('[RecordProvider] Failed to parse message:', e)
    }
  }, [])

  const connect = useCallback(async () => {
    const profile = userProfileRef.current
    if (!profile && !allowAnonymous) return
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // If we connected without profile but now have it, reconnect to send
      // profile data (email, name, imageUrl) so registerUser() can store them.
      if (profile && !connectedWithProfileRef.current) {
        console.log(`[WS] Reconnecting with profile data`, { roomId })
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      } else {
        return
      }
    }
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    let baseUrl: string
    if (wsUrl) {
      baseUrl = wsUrl.replace(/^http/, 'ws')
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
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

    // Always try to send auth token — platform worker extracts userId from JWT
    // even if profile fetch failed (e.g. API down)
    try {
      const tokenFn = getAuthTokenProp ?? getAuthToken
      const token = await tokenFn()
      if (token) params.set('token', token)
    } catch { /* Token fetch failed */ }

    connectedWithProfileRef.current = !!profile

    const wsPath = `/ws/${roomId}`
    const url = `${baseUrl}${wsPath}?${params.toString()}`
    console.log('[WS] Connecting:', { roomId, attempt: reconnectAttemptRef.current })
    const ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'

    ws.onopen = () => {
      console.log('[WS] Connected:', { roomId })
      setStatus('connected')
    }
    ws.onmessage = handleMessage
    ws.onclose = (event) => {
      console.log('[WS] Closed:', { roomId, code: event.code, reason: event.reason, wasClean: event.wasClean })
      setStatus('disconnected')
      setReady(false)
      wsRef.current = null
      for (const [_id, pending] of pendingRequestsRef.current) {
        clearTimeout(pending.timer)
        pending.reject(new Error('WebSocket disconnected'))
      }
      pendingRequestsRef.current.clear()
      const attempt = reconnectAttemptRef.current
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000)
      console.log('[WS] Scheduling reconnect:', { roomId, attempt, delayMs: delay })
      reconnectAttemptRef.current = attempt + 1
      reconnectTimeoutRef.current = setTimeout(connect, delay)
    }
    ws.onerror = (e) => { console.error('[WS] Error:', { roomId, error: e }) }
    wsRef.current = ws
  }, [roomId, wsUrl, handleMessage, allowAnonymous, getAuthTokenProp])

  useEffect(() => {
    if (userProfile?.id) connect()
    else if (allowAnonymous && !userProfileLoading) connect()
  }, [userProfile?.id, userProfileLoading, allowAnonymous, connect])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const ws = wsRef.current
        if (ws?.readyState !== WebSocket.OPEN && (userProfileRef.current || allowAnonymous)) {
          console.log('[WS] Reconnecting after visibility change')
          reconnectAttemptRef.current = 0
          connect()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [roomId, connect])

  useEffect(() => {
    return () => {
      console.log('[WS] Unmounting provider:', { roomId })
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      wsRef.current?.close()
    }
  }, [roomId])

  const sendMessage = useCallback((message: { type: number; payload: unknown }) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message))
    else console.warn('[RecordProvider] Cannot send message, WebSocket not connected')
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

  const sendBinary = useCallback((data: Uint8Array) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(data)
  }, [])

  const onBinaryMessage = useCallback((handler: (data: ArrayBuffer) => void) => {
    binaryHandlersRef.current.add(handler)
    return () => { binaryHandlersRef.current.delete(handler) }
  }, [])

  const registerYjsJoinHandler = useCallback((docKey: string, handler: (canWrite: boolean) => void) => {
    if (!yjsJoinHandlersRef.current.has(docKey)) {
      yjsJoinHandlersRef.current.set(docKey, new Set())
    }
    yjsJoinHandlersRef.current.get(docKey)!.add(handler)
    return () => {
      const handlers = yjsJoinHandlersRef.current.get(docKey)
      if (handlers) {
        handlers.delete(handler)
        if (handlers.size === 0) yjsJoinHandlersRef.current.delete(docKey)
      }
    }
  }, [])

  const sendConfirmed = useCallback((
    message: { type: number; payload: Record<string, unknown> },
    timeoutMs = 10000
  ): Promise<unknown> => {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('WebSocket not connected'))
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingRequestsRef.current.delete(requestId)
        reject(new Error('Mutation confirmation timed out'))
      }, timeoutMs)
      pendingRequestsRef.current.set(requestId, { resolve, reject, timer })
      ws.send(JSON.stringify({ ...message, payload: { ...message.payload, requestId } }))
    })
  }, [])

  const value: RecordContextValue = useMemo(() => ({
    store: storeRef.current, roomId, userProfile, userProfileLoading, refetchUserProfile,
    roomRole, allUsers, usersLoaded, status, ready,
    setUserRole, requestUserList,
    registerSubscription, unregisterSubscription, sendMessage, sendBinary, onBinaryMessage,
    registerYjsJoinHandler, sendConfirmed,
  }), [roomId, userProfile, userProfileLoading, refetchUserProfile, roomRole, allUsers, usersLoaded, status, ready, setUserRole, requestUserList, registerSubscription, unregisterSubscription, sendMessage, sendBinary, onBinaryMessage, registerYjsJoinHandler, sendConfirmed])

  const onPermissionError = useCallback((title: string, detail: string) => {
    onPermissionErrorRef.current?.(title, detail)
  }, [])

  const onValidationError = useCallback((title: string, detail: string) => {
    onValidationErrorRef.current?.(title, detail)
  }, [])

  const authValue: RecordAuthContextValue = useMemo(() => ({
    userProfile,
    userProfileLoading,
    refetchUserProfile,
    allowAnonymous,
    getAuthToken: getAuthTokenProp,
    onPermissionError,
    onValidationError,
  }), [userProfile, userProfileLoading, refetchUserProfile, allowAnonymous, getAuthTokenProp, onPermissionError, onValidationError])

  return (
    <RecordAuthContext.Provider value={authValue}>
      <ScopeRegistryProvider>
        <RecordContext.Provider value={value}>
          {children}
        </RecordContext.Provider>
      </ScopeRegistryProvider>
    </RecordAuthContext.Provider>
  )
}

// ============================================================================
// Auth-Only Provider (multi-scope mode — no roomId, no WS)
// ============================================================================

interface RecordProviderAuthOnlyProps {
  children: ReactNode
  fetchUser: FetchUserProfile
  allowAnonymous?: boolean
  getAuthToken?: () => Promise<string | null>
}

function RecordProviderAuthOnly({
  children,
  fetchUser,
  allowAnonymous = false,
  getAuthToken: getAuthTokenProp,
}: RecordProviderAuthOnlyProps): React.ReactElement {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [userProfileLoading, setUserProfileLoading] = useState(true)

  const refetchUserProfile = useCallback(async () => {
    try {
      const profile = await fetchUser()
      setUserProfile(profile)
    } catch (err) {
      console.error('[RecordProvider] Failed to refetch user profile:', err)
    }
  }, [fetchUser])

  // Fetch user profile on mount and refresh periodically.
  // fetchUser returns null when not signed in — that's fine, no retry needed.
  useEffect(() => {
    let mounted = true
    setUserProfileLoading(true)
    fetchUser()
      .then(profile => { if (mounted) setUserProfile(profile) })
      .finally(() => { if (mounted) setUserProfileLoading(false) })

    const interval = setInterval(() => {
      if (mounted) {
        fetchUser().then(p => { if (mounted) setUserProfile(p) })
      }
    }, 30000)

    return () => { mounted = false; clearInterval(interval) }
  }, [fetchUser])

  const authValue: RecordAuthContextValue = useMemo(() => ({
    userProfile,
    userProfileLoading,
    refetchUserProfile,
    allowAnonymous,
    getAuthToken: getAuthTokenProp,
  }), [userProfile, userProfileLoading, refetchUserProfile, allowAnonymous, getAuthTokenProp])

  return (
    <RecordAuthContext.Provider value={authValue}>
      <ScopeRegistryProvider>
        {children}
      </ScopeRegistryProvider>
    </RecordAuthContext.Provider>
  )
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * RecordProvider - Main entry point for storage.
 *
 * Two modes:
 * 1. **Single-scope (backward compat):** Pass `roomId` + `schemas`. Opens one WS connection.
 * 2. **Multi-scope:** Omit `roomId`. Only provides auth + ScopeRegistry.
 *    Use `<RecordScope>` components for individual WS connections.
 *
 * @example
 * ```tsx
 * // Single-scope (backward compat)
 * <RecordProvider roomId="my-app" schemas={schemas}>
 *   <App />
 * </RecordProvider>
 *
 * // Multi-scope
 * <RecordProvider>
 *   <RecordScope roomId="app:slack-clone" schemas={appSchemas}>
 *     <RecordScope roomId={`conv:${channelId}`} schemas={convSchemas}>
 *       <ChannelView />
 *     </RecordScope>
 *   </RecordScope>
 * </RecordProvider>
 * ```
 */
export function RecordProvider({
  roomId,
  schemas = [],
  wsUrl,
  children,
  allowAnonymous = false,
  getAuthToken: getAuthTokenProp,
}: {
  roomId?: string
  schemas?: CollectionSchema[]
  wsUrl?: string
  children: ReactNode
  allowAnonymous?: boolean
  getAuthToken?: () => Promise<string | null>
}): React.ReactElement {
  const { isLoaded, isSignedIn } = useAuth()

  // Derive user profile from the JWT — no API call needed.
  // Returns null when not signed in (no error, no console spam).
  const fetchUser = useCallback(async (): Promise<UserProfile | null> => {
    if (!isSignedIn) return null
    const token = await getAuthToken()
    if (!token) return null
    try {
      const parts = token.split('.')
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
      return {
        id: payload.sub,
        name: payload.name ?? '',
        email: payload.email ?? '',
        imageUrl: payload.image ?? undefined,
      }
    } catch {
      return null
    }
  }, [isSignedIn])

  // Build getAuthToken function — use prop override or default to auth module
  const getAuthTokenFn = useCallback(async (): Promise<string | null> => {
    if (getAuthTokenProp) return getAuthTokenProp()
    if (!isSignedIn) return null
    return getAuthToken()
  }, [getAuthTokenProp, isSignedIn])

  // Not loaded yet — render nothing (no loading screens — that's the app's job)
  if (!isLoaded) {
    return <>{null}</>
  }

  // Not signed in and not allowing anonymous — render nothing
  if (!isSignedIn && !allowAnonymous) {
    return <>{null}</>
  }

  if (roomId) {
    return (
      <RecordProviderCore
        roomId={roomId}
        schemas={schemas}
        wsUrl={wsUrl}
        fetchUser={fetchUser}
        allowAnonymous={allowAnonymous}
        getAuthToken={getAuthTokenFn}
      >
        {children}
      </RecordProviderCore>
    )
  }

  return (
    <RecordProviderAuthOnly
      fetchUser={fetchUser}
      allowAnonymous={allowAnonymous}
      getAuthToken={getAuthTokenFn}
    >
      {children}
    </RecordProviderAuthOnly>
  )
}
