import { describe, it, expect } from 'vitest'
import { ctx, env } from '../_test-helpers'
import { endpoints } from '.'

describe('GitHub', () => {
  // GitHub public endpoints work without a token
  it('get public user returns data', async () => {
    const result = await endpoints['github/get-public-user'].handler(env as any, { username: 'octocat' }, ctx) as any
    expect(result).toHaveProperty('login')
    expect(result.login).toBe('octocat')
  }, 15000)

  it('get repository returns data', async () => {
    const result = await endpoints['github/get-repository'].handler(env as any, { owner: 'octocat', repo: 'Hello-World' }, ctx) as any
    expect(result).toHaveProperty('full_name')
    expect(result.full_name).toBe('octocat/Hello-World')
  }, 15000)

  it('search repositories returns results', async () => {
    const result = await endpoints['github/search-repositories'].handler(env as any, { q: 'typescript stars:>10000' }, ctx) as any
    expect(result).toHaveProperty('items')
    expect(result.items.length).toBeGreaterThan(0)
  }, 15000)

  it('billing: 18 endpoints registered', () => {
    expect(Object.keys(endpoints)).toHaveLength(18)
  })
})
