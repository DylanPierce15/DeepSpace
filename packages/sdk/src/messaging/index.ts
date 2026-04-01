/**
 * @deepspace/sdk Messaging Module
 *
 * Shared types, hooks, and utilities for conversation-based apps.
 */

// Types
export type {
  MessageRecord,
  ReactionRecord,
  MemberRecord,
  ReadCursorRecord,
  GroupedReaction,
  ConversationObject,
  ConvMessageData,
  ConvReactionData,
  ConvMemberData,
  ConvReadCursorData,
  ContentSegment,
  LinkPreviewData,
} from './types'

// Hooks
export { useConversation } from './useConversation'

// Utilities
export {
  groupReactionsForMessage,
  shouldGroupMessages,
  getThreadCounts,
  formatMessageTime,
  formatFullTimestamp,
} from './utils'
