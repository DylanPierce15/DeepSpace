/**
 * MessagingPage — channel-based messaging for testing.
 *
 * Create channels, send/edit/delete messages, toggle reactions.
 * All data-testid attributes are used by Playwright tests.
 */

import { useState } from 'react'
import { useMessages, useChannels, useReactions, useChannelMembers } from '@deep-space/sdk/messaging'
import { useUser } from '@deep-space/sdk/storage'
import type { RecordData } from '@deep-space/sdk/storage'
import type { Channel, Message } from '@deep-space/sdk/messaging'

function ChannelList({
  channels,
  selectedId,
  onSelect,
  onCreate,
}: {
  channels: RecordData<Channel>[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: (name: string) => void
}) {
  const [newName, setNewName] = useState('')

  return (
    <div className="border-r border-border w-56 flex flex-col" data-testid="channel-list">
      <div className="p-3 border-b border-border">
        <div className="flex gap-1">
          <input
            data-testid="channel-name-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New channel"
            className="flex-1 rounded bg-secondary px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newName.trim()) {
                onCreate(newName.trim())
                setNewName('')
              }
            }}
          />
          <button
            data-testid="create-channel-btn"
            onClick={() => {
              if (newName.trim()) {
                onCreate(newName.trim())
                setNewName('')
              }
            }}
            className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground"
          >
            +
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-1">
        {channels.map((ch) => (
          <button
            key={ch.recordId}
            data-testid={`channel-${ch.recordId}`}
            onClick={() => onSelect(ch.recordId)}
            className={`w-full text-left rounded px-3 py-1.5 text-sm ${
              selectedId === ch.recordId
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/50'
            }`}
          >
            # {ch.data.name}
          </button>
        ))}
        {channels.length === 0 && (
          <div className="px-3 py-2 text-xs text-muted-foreground" data-testid="no-channels">
            No channels yet
          </div>
        )}
      </div>
    </div>
  )
}

function MessageFeed({ channelId }: { channelId: string }) {
  const { user } = useUser()
  const { messages, send, edit, remove } = useMessages(channelId)
  const { getReactionsForMessage, toggle: toggleReaction } = useReactions(channelId)
  const { isMember, join } = useChannelMembers(channelId)
  const [input, setInput] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editInput, setEditInput] = useState('')

  if (!isMember) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <button
          data-testid="join-channel-btn"
          onClick={join}
          className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Join Channel
        </button>
      </div>
    )
  }

  const topLevel = messages.filter((m) => !m.data.parentMessageId)

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto p-4 space-y-2" data-testid="messages-feed">
        {topLevel.map((msg) => {
          const reactions = getReactionsForMessage(msg.recordId)
          const isOwn = msg.data.authorId === user?.id

          return (
            <div
              key={msg.recordId}
              data-testid={`message-${msg.recordId}`}
              className="group rounded px-3 py-2 hover:bg-secondary/30"
            >
              {editingId === msg.recordId ? (
                <div className="flex gap-2">
                  <input
                    data-testid="edit-message-input"
                    value={editInput}
                    onChange={(e) => setEditInput(e.target.value)}
                    className="flex-1 rounded bg-secondary px-2 py-1 text-sm text-foreground"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        edit(msg.recordId, editInput)
                        setEditingId(null)
                      }
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                  />
                  <button
                    data-testid="save-edit-btn"
                    onClick={() => { edit(msg.recordId, editInput); setEditingId(null) }}
                    className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {msg.createdBy === user?.id ? 'You' : msg.createdBy.slice(0, 8)}
                    </span>
                    <span className="text-sm text-foreground">{msg.data.content}</span>
                    {msg.data.edited && (
                      <span className="text-xs text-muted-foreground">(edited)</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    {reactions.map((r) => (
                      <button
                        key={r.emoji}
                        data-testid={`reaction-${msg.recordId}-${r.emoji}`}
                        onClick={() => toggleReaction(msg.recordId, r.emoji)}
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          r.currentUserReacted ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
                        }`}
                      >
                        {r.emoji} {r.count}
                      </button>
                    ))}
                    <button
                      data-testid={`add-reaction-${msg.recordId}`}
                      onClick={() => toggleReaction(msg.recordId, '👍')}
                      className="rounded-full px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-secondary opacity-0 group-hover:opacity-100"
                    >
                      +👍
                    </button>

                    {isOwn && (
                      <>
                        <button
                          data-testid={`edit-btn-${msg.recordId}`}
                          onClick={() => { setEditingId(msg.recordId); setEditInput(msg.data.content) }}
                          className="text-xs text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
                        >
                          Edit
                        </button>
                        <button
                          data-testid={`delete-btn-${msg.recordId}`}
                          onClick={() => remove(msg.recordId)}
                          className="text-xs text-destructive hover:text-destructive/80 opacity-0 group-hover:opacity-100"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
        {topLevel.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-8" data-testid="no-messages">
            No messages yet. Be the first!
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <input
            data-testid="message-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && input.trim()) {
                send(input.trim())
                setInput('')
              }
            }}
          />
          <button
            data-testid="send-message-btn"
            onClick={() => {
              if (input.trim()) {
                send(input.trim())
                setInput('')
              }
            }}
            className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

export function MessagingPage() {
  const { channels, create } = useChannels()
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)

  return (
    <div className="flex h-[calc(100vh-3.5rem)]" data-testid="messaging-page">
      <ChannelList
        channels={channels}
        selectedId={selectedChannelId}
        onSelect={setSelectedChannelId}
        onCreate={(name) => create({ name, type: 'public' })}
      />
      <div className="flex-1 flex flex-col">
        {selectedChannelId ? (
          <MessageFeed channelId={selectedChannelId} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm" data-testid="no-channel-selected">
            Select or create a channel
          </div>
        )}
      </div>
    </div>
  )
}
