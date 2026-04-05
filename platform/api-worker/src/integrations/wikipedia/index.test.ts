import { describe, it, expect } from 'vitest'
import { ctx, env } from '../_test-helpers'
import { endpoints } from '.'

describe('Wikipedia', () => {
  it('search returns results', async () => {
    const result = await endpoints['wikipedia/search-pages'].handler(env as any, { query: 'quantum computing' }, ctx) as any[]
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('title')
    expect(result[0]).toHaveProperty('excerpt')
  }, 15000)

  it('page summary returns data', async () => {
    const result = await endpoints['wikipedia/get-page-summary'].handler(env as any, { title: 'Albert Einstein' }, ctx) as any
    expect(result.title).toBe('Albert Einstein')
    expect(result).toHaveProperty('extract')
  }, 15000)

  it('page content returns HTML', async () => {
    const result = await endpoints['wikipedia/get-page-content'].handler(env as any, { title: 'Moon' }, ctx) as any
    expect(result.htmlContent.length).toBeGreaterThan(100)
  }, 15000)

  it('random page returns a page', async () => {
    const result = await endpoints['wikipedia/get-random-page'].handler(env as any, {}, ctx) as any
    expect(result).toHaveProperty('title')
    expect(result).toHaveProperty('extract')
  }, 15000)

  it('billing: all endpoints at $0.001', () => {
    for (const key of Object.keys(endpoints)) {
      expect(endpoints[key].billing.baseCost).toBe(0.001)
    }
  })
})
