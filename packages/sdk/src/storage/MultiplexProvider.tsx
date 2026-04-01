/**
 * MultiplexProvider — Single-WS multiplexing for deployed apps.
 *
 * Opens ONE WebSocket to a GatewaySession DO via /platform/mux/ws.
 * Child RecordScope components call connectScope/disconnectScope to
 * join and leave individual RecordRoom DOs through the gateway.
 *
 * All JSON messages are enveloped with a `scope` field. Binary (Yjs)
 * messages use a varint-prefixed scope ID header.
 *
 * When absent from the tree, RecordScope falls back to its existing
 * direct-WS behavior (widget/canvas context).
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import { useRecordAuth } from './context'
import { getAuthToken } from '../auth'
import { prefixBinaryWithScope, stripBinaryScopePrefix } from '../mux-binary'
import type { ConnectionStatus } from './types'
import {
  MSG_USER_INFO,
  MSG_GW_SCOPE_CONNECT,
  MSG_GW_SCOPE_DISCONNECT,
  MSG_GW_SCOPE_ERROR,
  MSG_GW_TOKEN_REFRESH,
  MSG_GW_USER_UPDATE,
} from './constants'

// ============================================================================
// Types
// ============================================================================

export interface ScopeHandle {
  sendMessage: (message: { type: number; payload: unknown }) => void
  sendBinary: (data: Uint8Array) => void
  onMessage: (handler: (msg: { type: number; payload: unknown }) => void) => () => void
  onBinaryMessage: (handler: (data: ArrayBuffer) => void) => () => void
  onStatusChange: (handler: (status: ConnectionStatus) => void) => () => void
}

interface ScopeState {
  scopeId: string
  appId: string
  refcount: number
  status: ConnectionStatus
  /** Cached MSG_USER_INFO so late-joining RecordScopes (same scope) get it. */
  lastUserInfo: { type: number; payload: unknown } | null
  messageHandlers: Set<(msg: { type: number; payload: unknown }) => void>
  binaryHandlers: Set<(data: ArrayBuffer) => void>
  statusHandlers: Set<(status: ConnectionStatus) => void>
}

export interface MultiplexContextValue {
  connectScope: (scopeId: string, appId: string) => ScopeHandle
  disconnectScope: (scopeId: string) => void
}

const MultiplexContext = createContext<MultiplexContextValue | null>(null)

export function useMultiplex(): MultiplexContextValue | null {
  return useContext(MultiplexContext)
}

// ============================================================================
// MultiplexProvider
// ============================================================================

interface MultiplexProviderProps {
  appId: string
  children: ReactNode
  /** Explicit WS base URL (e.g. 'wss://platform.deep.space'). When omitted, derived from window.location. */
  wsUrl?: string
}

const TOKEN_REFRESH_INTERVAL_MS = 4 * 60 * 1000
const RECONNECT_MAX_DELAY_MS = 30_000

export function MultiplexProvider({ appId, children, wsUrl }: MultiplexProviderProps) {
  const auth = useRecordAuth()
  const wsRef = useRef<WebSocket | null>(null)
  const scopesRef = useRef(new Map<string, ScopeState>())
  const reconnectAttemptRef = useRef(0)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tokenRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const getAuthTokenRef = useRef(auth?.getAuthToken ?? null)
  getAuthTokenRef.current = auth?.getAuthToken ?? null

  // Keep profile data in refs so WS handlers always have current values
  // (avoids stale closures in connect/onopen callbacks)
  const userProfileRef = useRef(auth?.userProfile ?? null)
  userProfileRef.current = auth?.userProfile ?? null

  // ── Scope status management ─────────────────────────────────────────

  const updateScopeStatus = useCallback((scopeId: string, status: ConnectionStatus) => {
    const state = scopesRef.current.get(scopeId)
    if (state && state.status !== status) {
      state.status = status
      // Clear cached user info on reconnect — DO will send a fresh one
      if (status === 'connecting') {
        state.lastUserInfo = null
      }
      state.statusHandlers.forEach((h) => h(status))
    }
  }, [])

  // ── Dispatch helpers ────────────────────────────────────────────────

  const dispatchJsonToScope = useCallback((scopeId: string, msg: { type: number; payload?: unknown }) => {
    const state = scopesRef.current.get(scopeId)
    if (state) {
      // Cache MSG_USER_INFO so late-joining RecordScopes on this scope get it
      if (msg.type === MSG_USER_INFO) {
        state.lastUserInfo = msg as { type: number; payload: unknown }
      }
      state.messageHandlers.forEach((h) => h(msg as { type: number; payload: unknown }))
    }
  }, [])

  const dispatchBinaryToScope = useCallback((scopeId: string, data: Uint8Array) => {
    const state = scopesRef.current.get(scopeId)
    if (state) {
      const copy = new ArrayBuffer(data.byteLength)
      new Uint8Array(copy).set(data)
      state.binaryHandlers.forEach((h) => h(copy))
    }
  }, [])

  // ── WebSocket management ────────────────────────────────────────────

  const connectingRef = useRef(false)

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return
    if (connectingRef.current) return
    connectingRef.current = true

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    let baseUrl: string
    if (wsUrl) {
      baseUrl = wsUrl
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      baseUrl = `${protocol}//${window.location.host}`
    }
    const params = new URLSearchParams()
    params.set('appId', appId)

    try {
      const contextGetToken = getAuthTokenRef.current
      const token = contextGetToken ? await contextGetToken() : await getAuthToken()
      if (token) params.set('token', token)
    } catch {
      // Will retry on reconnect
    }

    const url = `${baseUrl}/platform/mux/ws?${params.toString()}`
    console.log('[Mux] Connecting:', { appId, attempt: reconnectAttemptRef.current })
    const ws = new WebSocket(url)
    connectingRef.current = false
    ws.binaryType = 'arraybuffer'

    ws.onopen = () => {
      console.log('[Mux] Connected:', { appId })
      reconnectAttemptRef.current = 0

      // Push profile BEFORE scope connects so the gateway has the real
      // name when it opens RecordRoom connections (registerUser).
      const profile = userProfileRef.current
      if (profile?.name && profile.name !== 'Anonymous') {
        ws.send(JSON.stringify({
          type: MSG_GW_USER_UPDATE,
          payload: {
            name: profile.name,
            email: profile.email || undefined,
            imageUrl: profile.imageUrl || undefined,
          },
        }))
      }

      // Re-connect all active scopes (refcount > 0)
      for (const [scopeId, state] of scopesRef.current) {
        if (state.refcount > 0) {
          ws.send(JSON.stringify({
            type: MSG_GW_SCOPE_CONNECT,
            payload: { scopeId, appId: state.appId },
          }))
          updateScopeStatus(scopeId, 'connecting')
        }
      }
    }

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        try {
          const [scopeId, inner] = stripBinaryScopePrefix(event.data)
          dispatchBinaryToScope(scopeId, inner)
        } catch (e) {
          console.error('[Mux] Failed to route binary message:', e)
        }
        return
      }

      try {
        const msg = JSON.parse(event.data as string) as {
          type: number
          scope?: string
          payload?: unknown
        }

        // Gateway error for a specific scope
        if (msg.type === MSG_GW_SCOPE_ERROR) {
          const p = msg.payload as { scopeId: string; error: string }
          console.error('[Mux] Scope error:', p.scopeId, p.error)
          updateScopeStatus(p.scopeId, 'disconnected')
          return
        }

        // Scoped message — dispatch to the right scope's handlers
        if (msg.scope) {
          const { scope, ...rest } = msg
          dispatchJsonToScope(scope, rest as { type: number; payload: unknown })
        }
      } catch (e) {
        console.error('[Mux] Failed to parse message:', e)
      }
    }

    ws.onclose = (event) => {
      console.log('[Mux] Closed:', { code: event.code, reason: event.reason })
      wsRef.current = null

      // Mark all active scopes as connecting (will reconnect)
      for (const [scopeId, state] of scopesRef.current) {
        if (state.refcount > 0) {
          updateScopeStatus(scopeId, 'connecting')
        }
      }

      const attempt = reconnectAttemptRef.current
      const delay = Math.min(1000 * Math.pow(2, attempt), RECONNECT_MAX_DELAY_MS)
      reconnectAttemptRef.current = attempt + 1
      reconnectTimeoutRef.current = setTimeout(connect, delay)
    }

    ws.onerror = (e) => {
      console.error('[Mux] Error:', e)
    }

    wsRef.current = ws
  }, [appId, updateScopeStatus, dispatchJsonToScope, dispatchBinaryToScope])

  // ── Connect when auth is available ──────────────────────────────────

  const hasAuthToken = !!auth?.getAuthToken
  const userProfileId = auth?.userProfile?.id
  const allowAnonymous = auth?.allowAnonymous ?? false
  const userProfileLoading = auth?.userProfileLoading ?? false

  useEffect(() => {
    if (userProfileId || hasAuthToken) {
      connect()
    } else if (allowAnonymous && !userProfileLoading) {
      connect()
    }
  }, [userProfileId, hasAuthToken, userProfileLoading, allowAnonymous, connect])

  // Reconnect on visibility change (web only — RN apps handle this via AppState)
  useEffect(() => {
    if (typeof document === 'undefined') return
    const handler = () => {
      if (document.visibilityState === 'visible') {
        const ws = wsRef.current
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          reconnectAttemptRef.current = 0
          connect()
        }
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [connect])

  // Token refresh
  useEffect(() => {
    tokenRefreshTimerRef.current = setInterval(async () => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      try {
        const contextGetToken = getAuthTokenRef.current
        const token = contextGetToken ? await contextGetToken() : await getAuthToken()
        if (token) {
          ws.send(JSON.stringify({ type: MSG_GW_TOKEN_REFRESH, payload: { token } }))
        }
      } catch {
        // Not critical
      }
    }, TOKEN_REFRESH_INTERVAL_MS)

    return () => {
      if (tokenRefreshTimerRef.current) {
        clearInterval(tokenRefreshTimerRef.current)
        tokenRefreshTimerRef.current = null
      }
    }
  }, [])

  // Push user profile to gateway when it becomes available.
  // This updates c_users in all connected RecordRoom DOs so other
  // clients see real names instead of "Anonymous".
  const userProfileName = auth?.userProfile?.name
  const userProfileEmail = auth?.userProfile?.email
  const userProfileImageUrl = auth?.userProfile?.imageUrl

  useEffect(() => {
    if (!userProfileName || userProfileName === 'Anonymous') return
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({
      type: MSG_GW_USER_UPDATE,
      payload: {
        name: userProfileName,
        email: userProfileEmail || undefined,
        imageUrl: userProfileImageUrl || undefined,
      },
    }))
  }, [userProfileName, userProfileEmail, userProfileImageUrl])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (tokenRefreshTimerRef.current) {
        clearInterval(tokenRefreshTimerRef.current)
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
  }, [])

  // ── Scope connect / disconnect ──────────────────────────────────────

  const connectScope = useCallback((scopeId: string, scopeAppId: string): ScopeHandle => {
    let state = scopesRef.current.get(scopeId)
    if (state) {
      state.refcount++
    } else {
      state = {
        scopeId,
        appId: scopeAppId,
        refcount: 1,
        status: 'connecting',
        lastUserInfo: null,
        messageHandlers: new Set(),
        binaryHandlers: new Set(),
        statusHandlers: new Set(),
      }
      scopesRef.current.set(scopeId, state)

      // Send connect to gateway
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: MSG_GW_SCOPE_CONNECT,
          payload: { scopeId, appId: scopeAppId },
        }))
      }
      // If WS not ready yet, onopen handler will re-send for all active scopes
    }

    // Build a handle that always looks up state from the map (no stale closure)
    const handle: ScopeHandle = {
      sendMessage: (message) => {
        const ws = wsRef.current
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ ...message, scope: scopeId }))
        } else {
          console.warn('[Mux] Cannot send, WS not open:', { scopeId, msgType: message.type })
          // Ensure the scope reflects the disconnected state so the UI updates
          updateScopeStatus(scopeId, 'connecting')
        }
      },

      sendBinary: (data: Uint8Array) => {
        const ws = wsRef.current
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(prefixBinaryWithScope(scopeId, data))
        } else {
          console.warn('[Mux] Cannot send binary, WS not open:', { scopeId })
          updateScopeStatus(scopeId, 'connecting')
        }
      },

      onMessage: (handler) => {
        const s = scopesRef.current.get(scopeId)
        if (s) {
          s.messageHandlers.add(handler)
          // Replay cached MSG_USER_INFO so late-joining RecordScopes become ready
          if (s.lastUserInfo) {
            queueMicrotask(() => handler(s.lastUserInfo!))
          }
        }
        return () => {
          const s = scopesRef.current.get(scopeId)
          if (s) s.messageHandlers.delete(handler)
        }
      },

      onBinaryMessage: (handler) => {
        const s = scopesRef.current.get(scopeId)
        if (s) s.binaryHandlers.add(handler)
        return () => {
          const s = scopesRef.current.get(scopeId)
          if (s) s.binaryHandlers.delete(handler)
        }
      },

      onStatusChange: (handler) => {
        const s = scopesRef.current.get(scopeId)
        if (s) {
          s.statusHandlers.add(handler)
          handler(s.status)
        }
        return () => {
          const s = scopesRef.current.get(scopeId)
          if (s) s.statusHandlers.delete(handler)
        }
      },
    }

    return handle
  }, [])

  const disconnectScope = useCallback((scopeId: string) => {
    const state = scopesRef.current.get(scopeId)
    if (!state) return

    state.refcount--
    if (state.refcount <= 0) {
      state.messageHandlers.clear()
      state.binaryHandlers.clear()
      state.statusHandlers.clear()
      scopesRef.current.delete(scopeId)

      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: MSG_GW_SCOPE_DISCONNECT,
          payload: { scopeId },
        }))
      }
    }
  }, [])

  // ── Context value ───────────────────────────────────────────────────

  const value: MultiplexContextValue = useMemo(
    () => ({ connectScope, disconnectScope }),
    [connectScope, disconnectScope],
  )

  return (
    <MultiplexContext.Provider value={value}>
      {children}
    </MultiplexContext.Provider>
  )
}
