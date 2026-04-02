/**
 * @deepspace/sdk — DeepSpace Client SDK
 *
 * import { RecordProvider, RecordScope, useQuery, useMutations } from '@deepspace/sdk'
 * import { useMessages, useChannels } from '@deepspace/sdk/messaging'
 * import { useConversations } from '@deepspace/sdk/directory'
 */

// ── Auth ─────────────────────────────────────────────────────────────
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
  AuthOverlay,
  SignedIn,
  SignedOut,
  AuthGate,
  useDisplayName,
  GuestBanner,
} from './auth'

// ── Storage (core primitives) ────────────────────────────────────────
export {
  RecordProvider,
  RecordScope,
  ScopeRegistryProvider,
  useRecordContext,
  useUser,
  useQuery,
  useMutations,
  useUsers,
  useUserLookup,
  useTeams,
  usePresence,
  useYjsField,
  useYjsText,
  useR2Files,
  getUserColor,
  DEFAULT_USER_COLORS,
  toConnectionStatus,
  isImageFile,
  formatFileSize,
} from './storage'

// ── Storage types ────────────────────────────────────────────────────
export type {
  Query, RecordData, User, UserProfile, UserCredits, UserKarma,
  RoomUser, Team, TeamMember, TeamMemberIdentifier,
  AddMemberResult, AddMemberOptions,
  UseYjsFieldResult, UseYjsTextResult,
  ConnectionStatus, ScopeEntry,
  SyncResult, AwarenessState, AwarenessStates,
  R2FileInfo, R2UploadResult, UseR2FilesReturn, R2Scope,
  FileAttachment, UserInfo,
} from './storage'
