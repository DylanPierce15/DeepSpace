/**
 * @deepspace/types — Shared type definitions for the DeepSpace SDK
 *
 * Types used by both client-side SDK and server-side workers.
 */

// ============================================================================
// Schema Types
// ============================================================================

export type FieldType = 'string' | 'number' | 'boolean' | 'json'

export interface FieldSchema {
  type: FieldType
  required?: boolean
  /** Must equal current user's ID (auto-set on create) */
  userBound?: boolean
  /** Cannot change after creation */
  immutable?: boolean
  /** Default value auto-set on create */
  default?: unknown
  /** System-managed field — not writable by client mutations */
  systemManaged?: boolean
  /** Whitelist of fields updatable per role */
  writableFields?: Record<string, string[]>
  /** Auto-set timestamp when this field changes */
  timestampTrigger?: string
}

export type PermissionRule = boolean | 'own' | 'unclaimed-or-own' | 'collaborator' | 'team' | 'access' | 'published'

export interface SchemaPermissions {
  read: PermissionRule
  create: PermissionRule
  update: PermissionRule
  delete: PermissionRule
}

export interface CollectionSchema {
  name: string
  fields: Record<string, FieldSchema>
  permissions: Record<string, SchemaPermissions>
  /** Field name used for ownership checks */
  ownerField?: string
  /** Field name for collaborator arrays */
  collaboratorsField?: string
  /** Field name for team-based access */
  teamField?: string
  /** Field name for visibility-based access */
  visibilityField?: string
}

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
export interface ConnectionAttachment {
  userId: string
  role: string
  subscriptions: Subscription[]
  yjsSubscriptions: YjsSubscription[]
  yjsClientId?: number
  awarenessClientId?: number
}

// ============================================================================
// Record Types
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
// Protocol Constants
// ============================================================================

// Core CRUD operations
export const MSG_SUBSCRIBE = 1
export const MSG_UNSUBSCRIBE = 2
export const MSG_QUERY_RESULT = 3
export const MSG_RECORD_CHANGE = 4
export const MSG_PUT = 5
export const MSG_DELETE = 6
export const MSG_ERROR = 7

// User management
export const MSG_USER_INFO = 8
export const MSG_USER_LIST = 9
export const MSG_SET_ROLE = 10
export const MSG_USER_UPDATE = 11

// Yjs collaborative editing
export const MSG_YJS_JOIN = 20
export const MSG_YJS_LEAVE = 21
export const MSG_YJS_SYNC = 22
export const MSG_YJS_AWARENESS = 23

// Schema registration
export const MSG_REGISTER_SCHEMAS = 30

// Mutation acknowledgement
export const MSG_ACK = 31

// Schema discovery
export const MSG_LIST_SCHEMAS = 32

// Team membership change — tells client to re-subscribe all active queries
export const MSG_RESUBSCRIBE = 33

// Gateway multiplexing (single-WS architecture)
export const MSG_GW_SCOPE_CONNECT = 100
export const MSG_GW_SCOPE_DISCONNECT = 101
export const MSG_GW_SCOPE_ERROR = 103
export const MSG_GW_TOKEN_REFRESH = 104
export const MSG_GW_USER_UPDATE = 105

// ============================================================================
// Server Action Types
// ============================================================================

export interface ActionResult {
  success: boolean
  data?: unknown
  error?: string
}

export interface ActionTools {
  create(
    scopeId: string,
    collection: string,
    data: Record<string, unknown>,
  ): Promise<ActionResult>
  update(
    scopeId: string,
    collection: string,
    recordId: string,
    data: Record<string, unknown>,
  ): Promise<ActionResult>
  remove(scopeId: string, collection: string, recordId: string): Promise<ActionResult>
  get(scopeId: string, collection: string, recordId: string): Promise<ActionResult>
  query(
    scopeId: string,
    collection: string,
    options?: {
      where?: Record<string, unknown>
      orderBy?: string
      orderDir?: 'asc' | 'desc'
      limit?: number
    },
  ): Promise<ActionResult>
}

export interface ActionContext {
  userId: string
  params: Record<string, unknown>
  tools: ActionTools
}

export type ActionHandler = (ctx: ActionContext) => Promise<ActionResult>

// ============================================================================
// App Metadata
// ============================================================================

export interface AppMeta {
  appId: string
  appName: string
  ownerUserId: string
  schemas: CollectionSchema[]
  createdAt: string
  updatedAt: string
}

// ============================================================================
// Cron Types
// ============================================================================

export interface CronTask {
  name: string
  intervalMinutes?: number
  schedule?: string
  timezone?: string
  lastRun: number
}

export interface CronConfig {
  ownerUserId: string
  tasks: CronTask[]
}

// ============================================================================
// Handler Context (Worker-side)
// ============================================================================

export interface HandlerContext {
  sql: unknown // SqlStorage from CF Workers
  state: unknown // DurableObjectState from CF Workers
  yjsDocs: Map<YjsDocKey, unknown> // Y.Doc instances
  getWebSockets(): Iterable<WebSocket>
  send(ws: WebSocket, message: { type: number; payload: unknown }): void
  sendBinary(ws: WebSocket, data: Uint8Array): void
}
