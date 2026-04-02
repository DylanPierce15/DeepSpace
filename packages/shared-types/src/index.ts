/**
 * @deepspace/types — Shared type definitions for the DeepSpace SDK
 *
 * Types used by both client-side SDK and server-side workers.
 */

// ============================================================================
// Schema Types
// ============================================================================

export type PermissionRule = boolean | 'own' | 'unclaimed-or-own' | 'collaborator' | 'team' | 'access' | 'published' | 'shared'

export interface SchemaPermissions {
  read: PermissionRule
  create: PermissionRule
  update: PermissionRule
  delete: PermissionRule
  writableFields?: string[]
}

export interface CollectionSchema {
  name: string
  columns: Array<{ name: string; storage: string; interpretation: string | Record<string, unknown> }>
  uniqueOn?: string[]
  permissions: Record<string, SchemaPermissions>
  ownerField?: string
  collaboratorsField?: string
  teamField?: string
  visibilityField?: string | { field: string; value: unknown }
  defaultRole?: string
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

// ============================================================================
// Directory Data Interfaces (dir:{appName} scope)
// ============================================================================

export interface DirectoryConversationData {
  Name: string
  Description: string
  Type: string
  Visibility: string
  CreatedBy: string
  ParticipantHash: string
  ParticipantIds: string
  Status: string
  AssigneeId: string
  LinkedRef: string
  LastMessageAt: string
  LastMessagePreview: string
  LastMessageAuthor: string
  MessageCount: number
}

export interface ConversationStateData {
  ConversationId: string
  UserId: string
  LastReadAt: string
  LastReadMessageCount: number
  Starred: number
  Archived: number
  Trashed: number
  Labels: string
  Folder: string
}

export interface DirectoryCommunityData {
  Name: string
  Description: string
  CreatedBy: string
  Type: string
  Visibility: string
  MemberCount: number
  Rules: string
  IconUrl: string
  CoverUrl: string
}

export interface DirectoryMembershipData {
  CommunityId: string
  UserId: string
  UserName: string
  Role: string
  JoinedAt: string
}

export interface DirectoryPostData {
  Title: string
  Content: string
  AuthorId: string
  Type: string
  CommunityId: string
  ParentId: string
  ConversationId: string
  Status: string
  Tags: string
  LinkUrl: string
}

// ============================================================================
// Conversation Data Interfaces (conv:{id} scope)
// ============================================================================

export interface ConvMessageData {
  Content: string
  AuthorId: string
  ParentId: string
  Edited: number
  MessageType: string
  Metadata: string
}

export interface ConvReactionData {
  MessageId: string
  Emoji: string
  UserId: string
}

export interface ConvMemberData {
  UserId: string
  UserName: string
  Role: string
}

export interface ConvReadCursorData {
  UserId: string
  LastReadAt: string
}

export interface ConvVoteData {
  TargetId: string
  UserId: string
  Direction: number
}
