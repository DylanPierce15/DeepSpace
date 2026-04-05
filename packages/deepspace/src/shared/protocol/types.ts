/**
 * Server-specific protocol types
 *
 * These depend on Cloudflare Workers / Yjs imports and can't live in shared/types.
 * All other protocol types (Query, payloads, etc.) live in shared/types/index.ts.
 */

import * as Y from 'yjs'
import type { UserAttachment } from '../../server/rooms/base-room'
import type { Subscription, YjsSubscription, YjsDocKey } from '../types'

/** Stored on WebSocket attachment (survives hibernation) */
export interface ConnectionAttachment extends UserAttachment {
  role: string
  subscriptions: Subscription[]
  /** Yjs docs this connection is editing */
  yjsSubscriptions: YjsSubscription[]
  /** Yjs client ID for awareness */
  yjsClientId?: number
  /** Client-side Yjs awareness clientId (extracted from first awareness message) */
  awarenessClientId?: number
}

/**
 * Context passed to handlers for accessing shared resources
 */
export interface HandlerContext {
  sql: SqlStorage
  state: DurableObjectState
  yjsDocs: Map<YjsDocKey, Y.Doc>
  getWebSockets(): Iterable<WebSocket>
  send(ws: WebSocket, message: { type: number; payload: unknown }): void
  sendBinary(ws: WebSocket, data: Uint8Array): void
}
