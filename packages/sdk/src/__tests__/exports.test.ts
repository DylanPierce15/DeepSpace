import { describe, it, expect } from 'vitest'

describe('SDK barrel exports', () => {
  it('exports auth modules', async () => {
    const auth = await import('../auth/index')
    expect(auth.DeepSpaceAuthProvider).toBeDefined()
    expect(auth.useAuth).toBeDefined()
    expect(auth.useUser).toBeDefined()
    expect(auth.signIn).toBeDefined()
    expect(auth.signUp).toBeDefined()
    expect(auth.signOut).toBeDefined()
    expect(auth.getAuthToken).toBeDefined()
    expect(auth.clearAuthToken).toBeDefined()
    expect(auth.AuthOverlay).toBeDefined()
  })

  it('exports storage modules', async () => {
    const storage = await import('../storage/index')
    expect(storage.RecordProvider).toBeDefined()
    expect(storage.RecordScope).toBeDefined()
    expect(storage.MultiplexProvider).toBeDefined()
    expect(storage.useQuery).toBeDefined()
    expect(storage.useMutations).toBeDefined()
    expect(storage.useUser).toBeDefined()
    expect(storage.useUsers).toBeDefined()
    expect(storage.useTeams).toBeDefined()
    expect(storage.useYjsField).toBeDefined()
    expect(storage.usePresence).toBeDefined()
  })

  it('exports config modules', async () => {
    const config = await import('../config/index')
    expect(config).toBeDefined()
  })
})
