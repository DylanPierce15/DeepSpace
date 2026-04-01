/**
 * GatewaySession — Durable Object for WebSocket multiplexing.
 *
 * Maintains multiple client WebSockets (one per tab) and fans out to
 * shared RecordRoom DO connections. All tabs share the same RecordRoom
 * connections — that's the multiplex advantage.
 *
 * The client sends scope-enveloped messages; the gateway strips the scope
 * before forwarding to the appropriate RecordRoom, and adds it back on
 * responses (broadcast to all connected clients).
 *
 * RecordRoom sees the gateway's WS as any regular client — zero changes
 * to RecordRoom needed.
 *
 * Binary messages (Yjs) use a varint-length-prefixed scope ID header.
 * Shared helpers in mux-binary.ts handle encoding/decoding.
 *
 * Does NOT use hibernation — the DO must stay alive to maintain active
 * connections to RecordRoom DOs for low-latency scope switching.
 *
 * Client JSON messages are serialized via a promise chain so that async
 * scope lifecycle operations (connect/disconnect) complete before the
 * next message is processed. This prevents race conditions where data
 * messages arrive before a scope connection is established.
 */

/// <reference types="@cloudflare/workers-types" />

import {
  MSG_GW_SCOPE_CONNECT,
  MSG_GW_SCOPE_DISCONNECT,
  MSG_GW_SCOPE_ERROR,
  MSG_GW_TOKEN_REFRESH,
  MSG_GW_USER_UPDATE,
  MSG_USER_UPDATE,
} from './constants'
import { prefixBinaryWithScope, stripBinaryScopePrefix } from './mux-binary'

// ============================================================================
// Types
// ============================================================================

interface GatewayEnv {
  RECORD_ROOMS: DurableObjectNamespace
  SCHEMA_REGISTRY: R2Bucket
}

interface DOConnection {
  ws: WebSocket
  scopeId: string
  appId: string
}

const MAX_RECONNECT_ATTEMPTS = 3
const RECONNECT_DELAY_MS = 500

// ============================================================================
// GatewaySession DO
// ============================================================================

export class GatewaySession implements DurableObject {
  private state: DurableObjectState
  private env: GatewayEnv
  private clientSockets = new Set<WebSocket>()
  private connections = new Map<string, DOConnection>()

  private userId: string | null = null
  private isAdmin = false
  private userName = 'Anonymous'
  private userEmail = ''
  private userImageUrl: string | undefined
  private token: string | null = null
  /** Tracks which scopes each client has requested, for ref-counting. */
  private clientScopes = new Map<WebSocket, Set<string>>()

  /**
   * Serializes client JSON message processing. Async operations (scope
   * connect) complete before the next message is dequeued, preventing
   * "Scope not connected" races.
   */
  private messageQueue: Promise<void> = Promise.resolve()

  constructor(state: DurableObjectState, env: GatewayEnv) {
    this.state = state
    this.env = env
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }

    this.userId = url.searchParams.get('userId')
    this.isAdmin = url.searchParams.get('isAdmin') === 'true'
    this.userName = url.searchParams.get('userName') || 'Anonymous'
    this.userEmail = url.searchParams.get('userEmail') || ''
    this.userImageUrl = url.searchParams.get('userImageUrl') || undefined
    this.token = url.searchParams.get('token')
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    server.accept()
    this.clientSockets.add(server)
    this.clientScopes.set(server, new Set())

    server.addEventListener('message', (event: MessageEvent) => {
      if (event.data instanceof ArrayBuffer) {
        // Binary (Yjs) messages are forwarded synchronously — no queuing
        // needed since they only read the connections map, never mutate it.
        this.handleClientBinary(event.data)
        return
      }

      // JSON messages are serialized so async scope lifecycle operations
      // complete before the next message is processed.
      this.messageQueue = this.messageQueue
        .then(() => this.handleClientJson(server, event.data as string))
        .catch((e) => console.error('[GW] Message processing error:', e))
    })

    server.addEventListener('close', () => {
      this.handleClientClose(server)
    })

    server.addEventListener('error', (e: Event) => {
      console.error('[GW] Client WS error:', e)
      this.handleClientClose(server)
    })

    return new Response(null, { status: 101, webSocket: client })
  }

  // ── Client message routing ──────────────────────────────────────────

  /**
   * Process a single client JSON message. Runs inside the serialized
   * messageQueue so async handlers are properly awaited.
   */
  private async handleClientJson(sender: WebSocket, data: string): Promise<void> {
    try {
      const msg = JSON.parse(data) as {
        type: number
        scope?: string
        payload?: unknown
      }

      switch (msg.type) {
        case MSG_GW_SCOPE_CONNECT:
          await this.handleScopeConnect(sender, msg.payload as { scopeId: string; appId: string })
          break
        case MSG_GW_SCOPE_DISCONNECT:
          this.handleScopeDisconnect(sender, msg.payload as { scopeId: string })
          break
        case MSG_GW_TOKEN_REFRESH:
          this.handleTokenRefresh(msg.payload as { token: string })
          break
        case MSG_GW_USER_UPDATE:
          this.handleUserUpdate(msg.payload as { name?: string; email?: string; imageUrl?: string })
          break
        default:
          if (msg.scope) {
            this.forwardJsonToRecordRoom(sender, msg.scope, msg)
          }
          break
      }
    } catch (e) {
      console.error('[GW] Failed to parse client message:', e)
    }
  }

  private handleClientBinary(data: ArrayBuffer): void {
    try {
      const [scopeId, inner] = stripBinaryScopePrefix(data)
      const conn = this.connections.get(scopeId)
      if (conn && conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(inner)
      }
    } catch (e) {
      console.error('[GW] Failed to route binary message:', e)
    }
  }

  private forwardJsonToRecordRoom(
    sender: WebSocket,
    scopeId: string,
    msg: { type: number; scope?: string; payload?: unknown },
  ): void {
    const conn = this.connections.get(scopeId)
    if (!conn) {
      this.sendTo(sender, {
        type: MSG_GW_SCOPE_ERROR,
        payload: { scopeId, error: 'Scope not connected' },
      })
      return
    }
    if (conn.ws.readyState !== WebSocket.OPEN) {
      this.sendTo(sender, {
        type: MSG_GW_SCOPE_ERROR,
        payload: { scopeId, error: 'Scope WS not open' },
      })
      return
    }
    const { scope: _scope, ...rest } = msg
    conn.ws.send(JSON.stringify(rest))
  }

  // ── Scope lifecycle ─────────────────────────────────────────────────

  /**
   * Connect (or reconnect) a scope to its RecordRoom DO.
   *
   * Atomic replacement: the old connection stays in the map while the new
   * one is being established. `connectToRecordRoom` overwrites the map
   * entry only on success, so there is never a gap where
   * `this.connections.get(scopeId)` returns undefined during a reconnect.
   */
  private async handleScopeConnect(sender: WebSocket, payload: { scopeId: string; appId: string }): Promise<void> {
    const { scopeId, appId } = payload

    // Track that this client wants this scope
    this.clientScopes.get(sender)?.add(scopeId)

    const existing = this.connections.get(scopeId)

    // connectToRecordRoom atomically sets the new connection in the map
    await this.connectToRecordRoom(scopeId, appId, 0)

    // Close the old RecordRoom WS now that its replacement is live
    if (existing && existing.ws !== this.connections.get(scopeId)?.ws) {
      try { existing.ws.close(1000, 'replaced') } catch { /* ignore */ }
    }
  }

  /**
   * Open a WS to a RecordRoom DO and wire up event handlers.
   *
   * On success the connection is placed in `this.connections` atomically
   * (overwriting any stale entry). On failure the map is not modified, so
   * a stale-but-live connection continues to serve messages.
   *
   * The close handler uses identity checks (`current.ws === doWs`) so
   * only the *active* connection triggers reconnect logic; stale close
   * events from replaced connections are ignored.
   */
  private async connectToRecordRoom(scopeId: string, appId: string, attempt: number): Promise<void> {
    try {
      const doWs = await this.openRecordRoomConnection(scopeId, appId)
      const conn: DOConnection = { ws: doWs, scopeId, appId }
      this.connections.set(scopeId, conn)

      doWs.addEventListener('message', (event) => {
        this.handleRecordRoomMessage(scopeId, event)
      })

      doWs.addEventListener('close', (event) => {
        // Only handle if this WS is still the active connection for this
        // scope. Replaced connections fire close events that we ignore.
        const current = this.connections.get(scopeId)
        if (!current || current.ws !== doWs) return

        if (attempt < MAX_RECONNECT_ATTEMPTS && this.clientSockets.size > 0) {
          console.warn(`[GW] RecordRoom WS dropped for ${scopeId} (attempt ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS}), reconnecting...`)
          // Don't delete from the map — the stale entry stays so that
          // forwardJsonToRecordRoom sees the connection (it will check
          // readyState and error cleanly). connectToRecordRoom will
          // atomically replace it on success.
          setTimeout(() => {
            if (this.clientSockets.size > 0) {
              this.connectToRecordRoom(scopeId, appId, attempt + 1)
                .then(() => {
                  // Old WS is already closed by the 'close' event; no
                  // explicit close needed.
                })
                .catch(() => {})
            }
          }, RECONNECT_DELAY_MS)
        } else {
          console.error(`[GW] RecordRoom WS closed for ${scopeId} after ${attempt} retries:`, event.code, event.reason)
          this.connections.delete(scopeId)
          this.broadcast({
            type: MSG_GW_SCOPE_ERROR,
            payload: { scopeId, error: `RecordRoom disconnected: ${event.reason || event.code}` },
          })
        }
      })

      doWs.addEventListener('error', (e) => {
        console.error(`[GW] RecordRoom WS error for ${scopeId}:`, e)
      })
    } catch (e) {
      console.error(`[GW] Failed to connect scope ${scopeId}:`, e)
      this.broadcast({
        type: MSG_GW_SCOPE_ERROR,
        payload: { scopeId, error: `Failed to connect: ${(e as Error).message}` },
      })
    }
  }

  private handleScopeDisconnect(sender: WebSocket, payload: { scopeId: string }): void {
    const { scopeId } = payload

    // Remove this client's interest in the scope
    this.clientScopes.get(sender)?.delete(scopeId)

    // Only close the RecordRoom connection if NO client needs this scope
    for (const scopes of this.clientScopes.values()) {
      if (scopes.has(scopeId)) return
    }

    const conn = this.connections.get(scopeId)
    if (!conn) return

    // Delete first so the close handler knows this was intentional
    this.connections.delete(scopeId)
    try { conn.ws.close(1000, 'scope disconnect') } catch { /* ignore */ }
  }

  // ── RecordRoom → Client forwarding ───────────────────────────────────

  private handleRecordRoomMessage(scopeId: string, event: MessageEvent): void {
    if (event.data instanceof ArrayBuffer) {
      const prefixed = prefixBinaryWithScope(scopeId, event.data)
      for (const ws of this.clientSockets) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(prefixed)
        }
      }
      return
    }

    try {
      const msg = JSON.parse(event.data as string) as {
        type: number
        payload?: unknown
      }

      // Forward with scope envelope — broadcast to all clients
      const enveloped = JSON.stringify({ ...msg, scope: scopeId })
      for (const ws of this.clientSockets) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(enveloped)
        }
      }
    } catch (e) {
      console.error(`[GW] Failed to forward RecordRoom message for ${scopeId}:`, e)
    }
  }

  // ── Open WS to RecordRoom DO ─────────────────────────────────────────

  private async openRecordRoomConnection(scopeId: string, appId: string): Promise<WebSocket> {
    const doId = this.env.RECORD_ROOMS.idFromName(scopeId)
    const stub = this.env.RECORD_ROOMS.get(doId)

    const params = new URLSearchParams()
    if (this.userId) {
      params.set('userId', this.userId)
      params.set('isAdmin', String(this.isAdmin))
      params.set('userName', this.userName)
      if (this.userEmail) params.set('userEmail', this.userEmail)
      if (this.userImageUrl) params.set('userImageUrl', this.userImageUrl)
    }
    params.set('appId', appId)
    // Scope-level authorization: user scope owner gets admin role
    const scopePrefix = scopeId.split(':')[0]
    if (scopePrefix === 'user' && this.userId) {
      const scopeUserId = scopeId.slice('user:'.length)
      if (this.userId === scopeUserId) {
        params.set('isCanvasOwner', 'true')
      }
    }

    const url = `https://internal/ws/${scopeId}?${params.toString()}`
    const upgradeRequest = new Request(url, {
      headers: { Upgrade: 'websocket' },
    })

    const response = await stub.fetch(upgradeRequest)
    const ws = response.webSocket
    if (!ws) {
      throw new Error(`RecordRoom did not return WebSocket for ${scopeId}`)
    }
    ws.accept()
    return ws
  }

  // ── Token refresh ────────────────────────────────────────────────────

  private handleTokenRefresh(payload: { token: string }): void {
    this.token = payload.token
  }

  // ── User profile update ─────────────────────────────────────────────

  /**
   * Client sends updated profile (name/email/imageUrl) after the profile
   * loads. The gateway stores the info and forwards MSG_USER_UPDATE to
   * every connected RecordRoom so c_users tables update in real time.
   */
  private handleUserUpdate(payload: { name?: string; email?: string; imageUrl?: string }): void {
    if (payload.name) this.userName = payload.name
    if (payload.email) this.userEmail = payload.email
    if (payload.imageUrl !== undefined) this.userImageUrl = payload.imageUrl || undefined

    // Forward to all connected RecordRoom DOs
    const msg = JSON.stringify({ type: MSG_USER_UPDATE, payload })
    for (const conn of this.connections.values()) {
      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(msg)
      }
    }
  }

  // ── Client disconnect ────────────────────────────────────────────────

  private handleClientClose(ws: WebSocket): void {
    this.clientSockets.delete(ws)
    this.clientScopes.delete(ws)

    // If other clients are still connected, keep RecordRoom connections alive
    if (this.clientSockets.size > 0) return

    // Last client left — tear down all RecordRoom connections
    const conns = [...this.connections.values()]
    this.connections.clear()
    for (const conn of conns) {
      try { conn.ws.close(1000, 'client disconnect') } catch { /* ignore */ }
    }
  }

  // ── Utilities ────────────────────────────────────────────────────────

  private sendTo(ws: WebSocket, msg: { type: number; scope?: string; payload: unknown }): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }

  private broadcast(msg: { type: number; scope?: string; payload: unknown }): void {
    const data = JSON.stringify(msg)
    for (const ws of this.clientSockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    }
  }
}
