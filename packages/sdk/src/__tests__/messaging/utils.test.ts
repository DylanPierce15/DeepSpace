import { describe, it, expect } from 'vitest'
import {
  groupReactionsForMessage,
  shouldGroupMessages,
  getThreadCounts,
  formatMessageTime,
  formatFullTimestamp,
} from '../../messaging/utils'
import type { MessageRecord, ReactionRecord } from '../../messaging/types'

// ── Helpers ──────────────────────────────────────────────────────────

function makeMessage(overrides: Partial<MessageRecord> & { recordId: string; createdAt: string; data: MessageRecord['data'] }): MessageRecord {
  return {
    createdBy: 'user-1',
    updatedAt: overrides.createdAt,
    ...overrides,
  }
}

function makeReaction(overrides: { recordId: string; data: ReactionRecord['data'] }): ReactionRecord {
  return {
    createdBy: overrides.data.UserId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ── groupReactionsForMessage ─────────────────────────────────────────

describe('groupReactionsForMessage', () => {
  it('returns empty array when no reactions match the message', () => {
    const reactions: ReactionRecord[] = [
      makeReaction({ recordId: 'r1', data: { MessageId: 'other-msg', Emoji: '👍', UserId: 'u1' } }),
    ]
    const result = groupReactionsForMessage(reactions, 'msg-1', 'u1')
    expect(result).toEqual([])
  })

  it('groups reactions by emoji for a given message', () => {
    const reactions: ReactionRecord[] = [
      makeReaction({ recordId: 'r1', data: { MessageId: 'msg-1', Emoji: '👍', UserId: 'u1' } }),
      makeReaction({ recordId: 'r2', data: { MessageId: 'msg-1', Emoji: '👍', UserId: 'u2' } }),
      makeReaction({ recordId: 'r3', data: { MessageId: 'msg-1', Emoji: '❤️', UserId: 'u3' } }),
    ]
    const result = groupReactionsForMessage(reactions, 'msg-1', 'u1')

    expect(result).toHaveLength(2)

    const thumbsUp = result.find((g) => g.emoji === '👍')!
    expect(thumbsUp.count).toBe(2)
    expect(thumbsUp.userIds).toEqual(['u1', 'u2'])
    expect(thumbsUp.currentUserReacted).toBe(true)

    const heart = result.find((g) => g.emoji === '❤️')!
    expect(heart.count).toBe(1)
    expect(heart.userIds).toEqual(['u3'])
    expect(heart.currentUserReacted).toBe(false)
  })

  it('sets currentUserReacted false when current user has not reacted', () => {
    const reactions: ReactionRecord[] = [
      makeReaction({ recordId: 'r1', data: { MessageId: 'msg-1', Emoji: '🎉', UserId: 'u2' } }),
    ]
    const result = groupReactionsForMessage(reactions, 'msg-1', 'u1')
    expect(result[0].currentUserReacted).toBe(false)
  })

  it('handles empty reactions array', () => {
    const result = groupReactionsForMessage([], 'msg-1', 'u1')
    expect(result).toEqual([])
  })
})

// ── shouldGroupMessages ──────────────────────────────────────────────

describe('shouldGroupMessages', () => {
  const baseTime = new Date('2026-03-15T10:00:00Z')

  function msgAt(minutes: number, authorId = 'user-1'): MessageRecord {
    const time = new Date(baseTime.getTime() + minutes * 60 * 1000)
    return makeMessage({
      recordId: `msg-${minutes}`,
      createdAt: time.toISOString(),
      data: { Content: 'hi', AuthorId: authorId, ParentId: '', Edited: 0, MessageType: 'message', Metadata: '' },
    })
  }

  it('returns false when there is no previous message', () => {
    expect(shouldGroupMessages(msgAt(0), null)).toBe(false)
    expect(shouldGroupMessages(msgAt(0), undefined)).toBe(false)
  })

  it('groups messages from same author within 5-minute threshold', () => {
    expect(shouldGroupMessages(msgAt(2), msgAt(0))).toBe(true)
    expect(shouldGroupMessages(msgAt(4), msgAt(0))).toBe(true)
  })

  it('does not group messages beyond the default 5-minute threshold', () => {
    expect(shouldGroupMessages(msgAt(6), msgAt(0))).toBe(false)
  })

  it('does not group messages from different authors', () => {
    const a = msgAt(0, 'user-1')
    const b = msgAt(1, 'user-2')
    expect(shouldGroupMessages(b, a)).toBe(false)
  })

  it('does not group when dateChanged option is true', () => {
    expect(shouldGroupMessages(msgAt(1), msgAt(0), { dateChanged: true })).toBe(false)
  })

  it('respects custom thresholdMs', () => {
    // 2 minutes apart, 1-minute threshold -> should not group
    expect(shouldGroupMessages(msgAt(2), msgAt(0), { thresholdMs: 60 * 1000 })).toBe(false)
    // 2 minutes apart, 3-minute threshold -> should group
    expect(shouldGroupMessages(msgAt(2), msgAt(0), { thresholdMs: 3 * 60 * 1000 })).toBe(true)
  })
})

// ── getThreadCounts ──────────────────────────────────────────────────

describe('getThreadCounts', () => {
  it('returns empty map when no messages have parents', () => {
    const messages: MessageRecord[] = [
      makeMessage({
        recordId: 'msg-1',
        createdAt: '2026-03-15T10:00:00Z',
        data: { Content: 'hello', AuthorId: 'u1', ParentId: '', Edited: 0, MessageType: 'message', Metadata: '' },
      }),
    ]
    const counts = getThreadCounts(messages)
    expect(counts.size).toBe(0)
  })

  it('counts replies per parent message', () => {
    const messages: MessageRecord[] = [
      makeMessage({
        recordId: 'msg-1',
        createdAt: '2026-03-15T10:00:00Z',
        data: { Content: 'root', AuthorId: 'u1', ParentId: '', Edited: 0, MessageType: 'message', Metadata: '' },
      }),
      makeMessage({
        recordId: 'msg-2',
        createdAt: '2026-03-15T10:01:00Z',
        data: { Content: 'reply1', AuthorId: 'u2', ParentId: 'msg-1', Edited: 0, MessageType: 'message', Metadata: '' },
      }),
      makeMessage({
        recordId: 'msg-3',
        createdAt: '2026-03-15T10:02:00Z',
        data: { Content: 'reply2', AuthorId: 'u3', ParentId: 'msg-1', Edited: 0, MessageType: 'message', Metadata: '' },
      }),
      makeMessage({
        recordId: 'msg-4',
        createdAt: '2026-03-15T10:03:00Z',
        data: { Content: 'reply to other', AuthorId: 'u1', ParentId: 'msg-2', Edited: 0, MessageType: 'message', Metadata: '' },
      }),
    ]
    const counts = getThreadCounts(messages)
    expect(counts.get('msg-1')).toBe(2)
    expect(counts.get('msg-2')).toBe(1)
    expect(counts.has('msg-3')).toBe(false)
    expect(counts.has('msg-4')).toBe(false)
  })

  it('handles empty messages array', () => {
    const counts = getThreadCounts([])
    expect(counts.size).toBe(0)
  })
})

// ── formatMessageTime ────────────────────────────────────────────────

describe('formatMessageTime', () => {
  it('returns a short time string', () => {
    const result = formatMessageTime('2026-03-15T14:30:00Z')
    // Output varies by locale/timezone, but should contain digits and colon
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })

  it('returns consistent output for same input', () => {
    const a = formatMessageTime('2026-01-01T09:05:00Z')
    const b = formatMessageTime('2026-01-01T09:05:00Z')
    expect(a).toBe(b)
  })
})

// ── formatFullTimestamp ──────────────────────────────────────────────

describe('formatFullTimestamp', () => {
  it('returns a date-and-time string with "at" separator', () => {
    const result = formatFullTimestamp('2026-03-15T14:30:00Z')
    expect(result).toContain('at')
  })

  it('includes the year', () => {
    const result = formatFullTimestamp('2026-03-15T14:30:00Z')
    expect(result).toContain('2026')
  })

  it('returns consistent output for same input', () => {
    const a = formatFullTimestamp('2026-06-20T08:15:00Z')
    const b = formatFullTimestamp('2026-06-20T08:15:00Z')
    expect(a).toBe(b)
  })
})

// ── Barrel export smoke test ─────────────────────────────────────────

describe('messaging barrel exports', () => {
  it('exports all expected functions and types from index', async () => {
    const messaging = await import('../../messaging/index')
    expect(messaging.useConversation).toBeDefined()
    expect(typeof messaging.useConversation).toBe('function')
    expect(messaging.groupReactionsForMessage).toBeDefined()
    expect(typeof messaging.groupReactionsForMessage).toBe('function')
    expect(messaging.shouldGroupMessages).toBeDefined()
    expect(typeof messaging.shouldGroupMessages).toBe('function')
    expect(messaging.getThreadCounts).toBeDefined()
    expect(typeof messaging.getThreadCounts).toBe('function')
    expect(messaging.formatMessageTime).toBeDefined()
    expect(typeof messaging.formatMessageTime).toBe('function')
    expect(messaging.formatFullTimestamp).toBeDefined()
    expect(typeof messaging.formatFullTimestamp).toBe('function')
  })
})
