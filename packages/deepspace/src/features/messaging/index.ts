/**
 * Messaging Feature — Client barrel
 *
 * Complete messaging UI: single-channel chat and multi-channel (Slack-like) messaging.
 */

// ── Schemas ─────────────────────────────────────────────────────────────────────
export { messagingSchemas } from './schemas'

// ── Hooks ───────────────────────────────────────────────────────────────────────
export { useChatChannel } from './hooks/useChatChannel'
export { useLongPress } from './hooks/useLongPress'
export { useMultiChannel, CHANNEL_TYPES, type ChannelType } from './hooks/useMultiChannel'

// ── Single-channel components ───────────────────────────────────────────────────
export { ChatPage } from './components/ChatPage'
export { ChatHeader } from './components/ChatHeader'
export { MessageList } from './components/MessageList'
export { MessageInput } from './components/MessageInput'
export { MessageItem, type MessageRect } from './components/MessageItem'
export { ThreadPanel } from './components/ThreadPanel'
export { UserProfilePopover } from './components/UserProfilePopover'
export { MessageActionSheet } from './components/MessageActionSheet'
export { EMOJI_LIST } from './components/ReactionPicker'

// ── Multi-channel components ────────────────────────────────────────────────────
export { ChatMultiPage } from './components/ChatMultiPage'
export { ChannelSidebar } from './components/ChannelSidebar'
export { ChannelListItem } from './components/ChannelListItem'
export { CreateGroupModal } from './components/CreateGroupModal'
export { NewMessageModal } from './components/NewMessageModal'
export { BrowseGroupsModal } from './components/BrowseGroupsModal'
export { ChannelSettingsPanel } from './components/ChannelSettingsPanel'
export { AddMemberModal } from './components/AddMemberModal'
export { InvitationList } from './components/InvitationList'
