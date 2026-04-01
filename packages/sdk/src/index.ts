/**
 * @deepspace/sdk — DeepSpace Client SDK
 *
 * React library for building apps on the DeepSpace platform.
 *
 * @example
 * import { RecordProvider, RecordScope, useQuery, useMutations } from '@deepspace/sdk'
 *
 * // Multi-scope mode (recommended)
 * <RecordProvider>
 *   <RecordScope roomId="app:my-app" schemas={schemas} appId="my-app">
 *     <App />
 *   </RecordScope>
 * </RecordProvider>
 */

// ── Auth ──────────────────────────────────────────────────────────────
export {
  DeepSpaceAuthProvider,
  useAuth,
  useUser as useAuthUser,
  useSession,
  signIn,
  signUp,
  signOut,
  authClient,
  getAuthToken,
  clearAuthToken,
} from './auth'

// ── Storage ───────────────────────────────────────────────────────────
export {
  // Providers
  RecordProvider,
  RecordScope,
  ScopeRegistryProvider,

  // Core hooks
  useRecordContext,
  useUser,
  useQuery,
  useMutations,
  useUsers,
  useUserLookup,
  useTeams,
  usePresence,

  // Directory hooks
  useConversations,
  useCommunities,
  usePosts,

  // Yjs collaborative editing
  useYjsField,
  useYjsText,


  // File uploads
  useR2Files,

  // Utilities
  getUserColor,
  DEFAULT_USER_COLORS,
  toConnectionStatus,
  isImageFile,
  formatFileSize,
  parseMessageMetadata,
  getConversationDisplayName,
  isDMConversation,
  getConversationParticipantIds,

  // Yjs protocol (advanced)
  Awareness,
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
  encodeAwarenessMessage,
  handleAwarenessMessage,
  getMessageType,
  MSG_SYNC,
  MSG_AWARENESS,
  MSG_SYNC_STEP1,
  MSG_SYNC_STEP2,
  MSG_SYNC_UPDATE,
} from './storage'

// ── Messaging ────────────────────────────────────────────────────────
export {
  useConversation,
  groupReactionsForMessage,
  shouldGroupMessages,
  getThreadCounts,
  formatMessageTime,
  formatFullTimestamp,
} from './messaging'

export type {
  MessageRecord,
  ReactionRecord,
  MemberRecord,
  ReadCursorRecord,
  GroupedReaction,
  ConversationObject,
  ContentSegment,
  LinkPreviewData,
} from './messaging'

// ── Types ─────────────────────────────────────────────────────────────
export type {
  // Storage types
  Query,
  RecordData,
  User,
  UserProfile,
  UserCredits,
  UserKarma,
  RoomUser,
  Team,
  TeamMember,
  TeamMemberIdentifier,
  AddMemberResult,
  AddMemberOptions,
  UseYjsFieldResult,
  UseYjsTextResult,
  ConnectionStatus,
  ScopeEntry,
  SyncResult,
  AwarenessState,
  AwarenessStates,
  R2FileInfo,
  R2UploadResult,
  UseR2FilesReturn,
  R2Scope,
  FileAttachment,
  UserInfo,
} from './storage'
