/**
 * @deepspace/sdk Storage Module
 *
 * Record-based storage with SQLite, RBAC, and real-time sync.
 *
 * Features:
 * - SQLite-backed storage in Cloudflare Durable Objects
 * - Role-based access control (RBAC)
 * - Query-based subscriptions (only load what you need)
 * - Real-time updates via WebSocket
 * - Yjs integration for collaborative editing fields
 *
 * @example
 * import { RecordProvider, useQuery, useMutations, useUser } from '@deepspace/sdk/storage'
 *
 * <RecordProvider>
 *   <RecordScope roomId="app:my-app" schemas={schemas} appId="my-app">
 *     <App />
 *   </RecordScope>
 * </RecordProvider>
 *
 * // useUser() returns profile + role in one object
 * const { user, refetch } = useUser()
 * if (user?.role === 'admin') { ... }
 *
 * const { records } = useQuery<Task>('tasks', { where: { userId: user.id } })
 * const { create, put, remove } = useMutations<Task>('tasks')
 */

// Record-based storage (SQLite + RBAC + Query Subscriptions)
export {
  RecordProvider,
  useRecordContext,
  useUser,
  useQuery,
  useMutations,
  useUsers,
  useTeams,
  useYjsField,
  useYjsText,
  type Query,
  type RecordData,
  type User,
  type UserProfile,
  type UserCredits,
  type UserKarma,
  type RoomUser,
  type Team,
  type TeamMember,
  type TeamMemberIdentifier,
  type AddMemberResult,
  type AddMemberOptions,
  type UseYjsFieldResult,
  type UseYjsTextResult,
} from './useRecords'

// Multi-scope composition
export { RecordScope } from './RecordScope'
export { ScopeRegistryProvider } from './ScopeRegistry'
export type { ScopeEntry } from './ScopeRegistry'

// User lookup utilities
export { useUserLookup, type UserInfo } from './hooks/useUserLookup'

// Presence hook
export { usePresence } from './hooks/usePresence'

// Directory hooks (dir:{appName} scope)
export { useConversations } from './hooks/useConversations'
export { useCommunities } from './hooks/useCommunities'
export { usePosts } from './hooks/usePosts'

// Connection status utilities (for platform provider hooks)
export { type ConnectionStatus, toConnectionStatus } from './connection-status'

// File uploads (R2)
export { useR2Files } from './useR2Files'
export type { R2FileInfo, R2UploadResult, UseR2FilesReturn, R2Scope } from './useR2Files'

// File attachment utilities
export { isImageFile, formatFileSize } from './file-attachment-utils'
export type { FileAttachment } from './file-attachment-utils'

// Conversation display utilities
export {
  getConversationDisplayName,
  isDMConversation,
  getConversationParticipantIds,
} from './conversation-utils'

// Message metadata parsing utility
export { parseMessageMetadata } from './message-utils'

// Deterministic user color assignment
export { getUserColor, DEFAULT_USER_COLORS } from './user-color'

// Yjs protocol utilities (for advanced use cases)
export {
  MSG_SYNC,
  MSG_AWARENESS,
  MSG_SYNC_STEP1,
  MSG_SYNC_STEP2,
  MSG_SYNC_UPDATE,
  createEncoder,
  toUint8Array,
  writeVarUint,
  writeVarUint8Array,
  createDecoder,
  readVarUint,
  readVarUint8Array,
  hasContent,
  encodeSyncStep1,
  encodeSyncStep2,
  encodeUpdate,
  handleSyncMessage,
  type SyncResult,
  Awareness,
  encodeAwarenessMessage,
  handleAwarenessMessage,
  getMessageType,
  type AwarenessState,
  type AwarenessStates,
} from './yjs-protocol'
