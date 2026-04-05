/**
 * Types for RecordRoom Durable Object
 */

import * as Y from 'yjs'
import type { UserAttachment } from '../../server/rooms/base-room'

// ============================================================================
// Query Types
// ============================================================================

export interface Query {
  collection: string
  where?: Record<string, unknown>
  orderBy?: string
  orderDir?: 'asc' | 'desc'
  limit?: number
}

export interface Subscription {
  id: string
  query: Query
}

// ============================================================================
// Yjs Types
// ============================================================================

/** Key for Yjs doc: collection:recordId:fieldName */
export type YjsDocKey = string

export interface YjsSubscription {
  collection: string
  recordId: string
  fieldName: string
}

// ============================================================================
// Connection Types
// ============================================================================

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

// ============================================================================
// Database Row Types
// ============================================================================

export interface RecordRow {
  collection: string
  record_id: string
  data: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface RecordResult {
  recordId: string
  data: Record<string, unknown>
  createdBy: string
  createdAt: string
  updatedAt: string
}

// ============================================================================
// Message Payload Types
// ============================================================================

export interface SubscribePayload {
  subscriptionId: string
  query: Query
}

export interface UnsubscribePayload {
  subscriptionId: string
}

export interface PutPayload {
  collection: string
  recordId: string
  data: Record<string, unknown>
  requestId?: string
}

export interface DeletePayload {
  collection: string
  recordId: string
  requestId?: string
}

export interface SetRolePayload {
  userId: string
  role: string
}

export interface YjsJoinPayload {
  collection: string
  recordId: string
  fieldName: string
}

export interface YjsLeavePayload {
  collection: string
  recordId: string
  fieldName: string
}

// ============================================================================
// Handler Context
// ============================================================================

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
