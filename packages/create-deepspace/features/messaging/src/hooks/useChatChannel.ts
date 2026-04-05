/**
 * useChatChannel — Find or create a default chat channel, and auto-join.
 *
 * Encapsulates all channel logic so consuming components never need to
 * know about the channels collection. On first mount (when no channel
 * exists yet) it creates a "general" public channel automatically and
 * joins the current user.
 *
 * Usage:
 *   const { channelId, status } = useChatChannel()
 *   if (!channelId) return <Loading />
 *   return <MessageList channelId={channelId} />
 */

import { useEffect, useRef } from 'react'
import { useUser } from 'deepspace'
import { useChannels } from 'deepspace'
import { useChannelMembers } from 'deepspace'
import type { Channel } from 'deepspace'
import type { RecordData } from 'deepspace'

const DEFAULT_CHANNEL_NAME = 'general'

export function useChatChannel(channelName: string = DEFAULT_CHANNEL_NAME) {
  const { user } = useUser()
  const { channels, status, create } = useChannels()
  const hasInitialized = useRef(false)

  const defaultChannel = channels.find(
    (c: RecordData<Channel>) =>
      c.data.name === channelName &&
      c.data.type === 'public' &&
      !c.data.archived
  )

  const { isMember, join, status: membersStatus } = useChannelMembers(defaultChannel?.recordId)

  // One-shot initialization: create the default channel if it doesn't exist.
  useEffect(() => {
    if (!user || status !== 'ready' || hasInitialized.current) return
    hasInitialized.current = true

    if (!defaultChannel) {
      create({
        name: channelName,
        type: 'public',
        description: 'Default chat channel',
      })
    }
  }, [user, status]) // eslint-disable-line react-hooks/exhaustive-deps

  // Wait for the members query to be ready before auto-joining.
  useEffect(() => {
    if (!user || !defaultChannel || isMember || membersStatus !== 'ready') return
    join()
  }, [user, defaultChannel, isMember, membersStatus, join])

  return {
    channelId: defaultChannel?.recordId,
    status,
    isMember,
    join,
  }
}
