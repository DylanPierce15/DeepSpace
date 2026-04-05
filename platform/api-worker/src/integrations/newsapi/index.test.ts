import { describe, it, expect } from 'vitest'
import { ctx, env, hasRealKey } from '../_test-helpers'
import { endpoints } from '.'

const skip = !hasRealKey('NEWS_API_KEY')

describe('NewsAPI', () => {
  it.skipIf(skip)('top-headlines returns US headlines', async () => {
    const result = await endpoints['newsapi/top-headlines'].handler(env as any, { country: 'us' }, ctx) as any
    expect(result).toHaveProperty('headlines')
    expect(result).toHaveProperty('articles')
    expect(result.articles.length).toBeGreaterThan(0)
    expect(result.articles[0]).toHaveProperty('title')
  }, 15000)

  it.skipIf(skip)('search-everything returns results', async () => {
    const result = await endpoints['newsapi/search-everything'].handler(env as any, { q: 'technology', pageSize: 5 }, ctx) as any
    expect(result.articles.length).toBeGreaterThan(0)
    expect(result).toHaveProperty('headlines')
  }, 15000)

  it('billing: both endpoints at $0.018', () => {
    for (const key of Object.keys(endpoints)) {
      expect(endpoints[key].billing.baseCost).toBe(0.018)
    }
  })
})
