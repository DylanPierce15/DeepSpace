import { describe, it, expect } from 'vitest'

/**
 * Directory hooks tests.
 *
 * The hooks themselves (useConversations, useCommunities, usePosts) are
 * React hooks that depend on RecordProvider context, so full integration
 * tests run via Playwright against the local stack.
 *
 * Here we verify:
 * 1. Barrel exports resolve correctly.
 * 2. Pure utility logic (participant hash, dedup) works as expected.
 */

// ============================================================================
// Pure utility functions extracted from hook logic
// ============================================================================

/** Generate a deterministic DM participant hash (same logic as useConversations.createDM) */
function dmParticipantHash(userA: string, userB: string): string {
  return [userA, userB].sort().join(':')
}

/** Generate a deterministic group DM participant hash (same logic as useConversations.createGroupDM) */
function groupParticipantHash(currentUserId: string, participantIds: string[]): {
  hash: string
  allIds: string[]
} | null {
  const allIds = [...new Set([currentUserId, ...participantIds])]
  if (allIds.length < 3) return null // Need at least 3 participants for a group DM
  const hash = allIds.sort().join(':')
  return { hash, allIds }
}

// ============================================================================
// Tests
// ============================================================================

describe('directory hooks barrel exports', () => {
  it('exports useConversations from directory barrel', async () => {
    const dir = await import('../../directory/index')
    expect(dir.useConversations).toBeDefined()
    expect(typeof dir.useConversations).toBe('function')
  })

  it('exports useCommunities from directory barrel', async () => {
    const dir = await import('../../directory/index')
    expect(dir.useCommunities).toBeDefined()
    expect(typeof dir.useCommunities).toBe('function')
  })

  it('exports usePosts from directory barrel', async () => {
    const dir = await import('../../directory/index')
    expect(dir.usePosts).toBeDefined()
    expect(typeof dir.usePosts).toBe('function')
  })
})

describe('DM participant hash', () => {
  it('produces a deterministic hash regardless of argument order', () => {
    const hashAB = dmParticipantHash('user-a', 'user-b')
    const hashBA = dmParticipantHash('user-b', 'user-a')
    expect(hashAB).toBe(hashBA)
    expect(hashAB).toBe('user-a:user-b')
  })

  it('handles identical user IDs', () => {
    const hash = dmParticipantHash('user-x', 'user-x')
    expect(hash).toBe('user-x:user-x')
  })

  it('sorts lexicographically', () => {
    const hash = dmParticipantHash('zara', 'alice')
    expect(hash).toBe('alice:zara')
  })
})

describe('group DM participant hash', () => {
  it('deduplicates participants and includes current user', () => {
    const result = groupParticipantHash('user-1', ['user-2', 'user-3', 'user-1'])
    expect(result).not.toBeNull()
    expect(result!.allIds).toHaveLength(3)
    expect(result!.allIds).toContain('user-1')
  })

  it('produces a deterministic sorted hash', () => {
    const result1 = groupParticipantHash('user-c', ['user-a', 'user-b'])
    const result2 = groupParticipantHash('user-a', ['user-c', 'user-b'])
    expect(result1!.hash).toBe(result2!.hash)
    expect(result1!.hash).toBe('user-a:user-b:user-c')
  })

  it('returns null when fewer than 3 unique participants', () => {
    // Only 2 unique participants (current user + one other)
    const result = groupParticipantHash('user-1', ['user-2'])
    expect(result).toBeNull()
  })

  it('returns null when all participants are the same user', () => {
    const result = groupParticipantHash('user-1', ['user-1', 'user-1'])
    expect(result).toBeNull()
  })

  it('handles many participants correctly', () => {
    const result = groupParticipantHash('user-1', ['user-5', 'user-3', 'user-2', 'user-4'])
    expect(result).not.toBeNull()
    expect(result!.allIds).toHaveLength(5)
    expect(result!.hash).toBe('user-1:user-2:user-3:user-4:user-5')
  })
})
