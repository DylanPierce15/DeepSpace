/**
 * ChatPage — Routable messaging page with header and MessageList.
 * Parent container must have a definite height (h-full / flex-1).
 */

import { useEffect, useRef } from 'react'
import { useChatChannel } from '../hooks/useChatChannel'
import { useReadReceipts, RecordScope } from 'deepspace'
import { ChatHeader } from '../components/chat/ChatHeader'
import { MessageList } from '../components/chat/MessageList'
import { schemas } from '../schemas'
import { APP_NAME } from '../constants'

export default function ChatPage() {
  const { channelId, status, isMember, join } = useChatChannel()
  const { markAsRead } = useReadReceipts()
  const lastMarkedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!channelId || !isMember) return
    if (lastMarkedRef.current === channelId) return
    lastMarkedRef.current = channelId
    markAsRead(channelId)
  }, [channelId, isMember, markAsRead])

  if (status !== 'ready' || !channelId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground text-sm">Loading chat...</div>
      </div>
    )
  }

  if (!isMember) {
    return (
      <div className="flex flex-col h-full" data-testid="chat-page">
        <ChatHeader channelId={channelId} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-foreground mb-3">You're not a member of this channel</p>
            <button
              data-testid="join-channel-btn"
              onClick={join}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Join Channel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" data-testid="chat-page">
      <ChatHeader channelId={channelId} />
      <RecordScope roomId={`chat:${channelId}`} schemas={schemas} appId={APP_NAME}>
        <MessageList channelId={channelId} />
      </RecordScope>
    </div>
  )
}
