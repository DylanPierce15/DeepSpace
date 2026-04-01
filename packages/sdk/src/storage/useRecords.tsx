/**
 * Record Storage Hooks
 * 
 * Query-based subscriptions for real-time data sync.
 * 
 * This file re-exports from the refactored modules for backwards compatibility.
 * 
 * @example
 * ```tsx
 * <RecordProvider roomId="my-app" schemas={schemas}>
 *   <App />
 * </RecordProvider>
 * 
 * // In components:
 * const { records } = useQuery('tasks', { where: { userId: me } })
 * const { put, create, remove } = useMutations('tasks')
 * ```
 */

// Types
export type {
  Query,
  RecordData,
  UserKarma,
  UserCredits,
  UserProfile,
  User,
  RoomUser,
  Team,
  TeamMember,
  TeamMemberIdentifier,
  AddMemberResult,
  ConnectionStatus,
  FetchUserProfile,
  RecordProviderProps,
} from './types'

// Context and Provider
export { RecordProvider, RecordContext, useRecordContext, useRecordAuth } from './context'
export type { RecordContextValue, RecordAuthContextValue } from './context'

// Multi-scope composition
export { RecordScope } from './RecordScope'
export { ScopeRegistryProvider } from './ScopeRegistry'

// Hooks
export { useUser } from './hooks/useUser'
export { useQuery } from './hooks/useQuery'
export { useMutations } from './hooks/useMutations'
export { useUsers } from './hooks/useUsers'
export { useTeams, type AddMemberOptions } from './hooks/useTeams'
export { useYjsField, useYjsText } from './hooks/useYjs'
export type { UseYjsFieldResult, UseYjsTextResult } from './hooks/useYjs'
