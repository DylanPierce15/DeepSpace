import { describe, it, expect } from 'vitest'
import { ctx, env, hasRealKey } from '../_test-helpers'
import { endpoints } from '.'

const skip = !hasRealKey('EXA_API_KEY')

describe('Exa', () => {
  it.skipIf(skip)('search returns results', async () => {
    const result = await endpoints['exa/search'].handler(env as any, {
      query: 'climate change solutions', numResults: 3, type: 'auto',
    }, ctx) as any
    expect(result.results.length).toBeGreaterThan(0)
    expect(result.results[0]).toHaveProperty('title')
    expect(result.results[0]).toHaveProperty('url')
  }, 30000)

  it.skipIf(skip)('answer returns an answer with citations', async () => {
    const result = await endpoints['exa/answer'].handler(env as any, {
      query: 'What is the speed of light?',
    }, ctx) as any
    expect(result.answer.length).toBeGreaterThan(0)
    expect(Array.isArray(result.citations)).toBe(true)
  }, 30000)

  it.skipIf(skip)('findSimilar returns results', async () => {
    const result = await endpoints['exa/findSimilar'].handler(env as any, {
      url: 'https://en.wikipedia.org/wiki/Artificial_intelligence', numResults: 3,
    }, ctx) as any
    expect(result.results.length).toBeGreaterThan(0)
  }, 30000)

  it.skipIf(skip)('contents extracts text from URLs', async () => {
    const result = await endpoints['exa/contents'].handler(env as any, {
      urls: ['https://en.wikipedia.org/wiki/Moon'], text: true,
    }, ctx) as any
    expect(result.results.length).toBeGreaterThan(0)
    expect(result.results[0].text.length).toBeGreaterThan(100)
  }, 30000)

  it.skipIf(skip)('news-search returns news articles', async () => {
    const result = await endpoints['exa/news-search'].handler(env as any, {
      q: 'artificial intelligence', numResults: 3,
    }, ctx) as any
    expect(result.results.length).toBeGreaterThan(0)
    expect(result).toHaveProperty('headlines')
  }, 30000)

  it('billing: research costs more than other endpoints', () => {
    expect(endpoints['exa/research'].billing.baseCost).toBe(0.02)
    expect(endpoints['exa/search'].billing.baseCost).toBe(0.005)
  })
})
