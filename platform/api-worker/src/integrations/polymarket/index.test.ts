import { describe, it, expect } from 'vitest'
import { ctx, env } from '../_test-helpers'
import { endpoints } from '.'

describe('Polymarket', () => {
  it('events returns a list', async () => {
    const result = await endpoints['polymarket/events'].handler(env as any, { limit: 3 }, ctx) as any[]
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  }, 15000)

  it('tags returns tag list', async () => {
    const result = await endpoints['polymarket/tags'].handler(env as any, {}, ctx) as any[]
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  }, 15000)

  it('markets returns a list', async () => {
    const result = await endpoints['polymarket/markets'].handler(env as any, { limit: 3 }, ctx) as any[]
    expect(Array.isArray(result)).toBe(true)
  }, 15000)

  it('billing: 12 endpoints registered', () => {
    expect(Object.keys(endpoints)).toHaveLength(12)
  })
})
