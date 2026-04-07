/**
 * NewsAPI integration handlers.
 * Ported from Miyagi3 NewsAPIService.ts — preserves LLM-friendly headline formatting.
 */

import { z } from 'zod'
import type { IntegrationHandler, EndpointDefinition } from '../_types'

// ============================================================================
// top-headlines — GET /v2/top-headlines
// ============================================================================

const topHeadlines: IntegrationHandler = async (env, body) => {
  if (!env.NEWS_API_KEY) throw new Error('NEWS_API_KEY not configured')

  const params = new URLSearchParams({ apiKey: env.NEWS_API_KEY })

  if (body.country) params.append('country', String(body.country))
  else params.append('country', 'us') // default
  if (body.category) params.append('category', String(body.category))
  if (body.sources) params.append('sources', String(body.sources))
  if (body.q) params.append('q', String(body.q))
  params.append('pageSize', String(body.pageSize || 20))
  params.append('page', String(body.page || 1))

  const response = await fetch(`https://newsapi.org/v2/top-headlines?${params}`, {
    method: 'GET',
    headers: { 'User-Agent': 'DeepSpace-NewsAPI/1.0' },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`NewsAPI error ${response.status}: ${errorText}`)
  }

  const newsData: any = await response.json()

  if (newsData.status !== 'ok') {
    throw new Error(`NewsAPI error: ${newsData.message || 'Unknown error'}`)
  }

  const articles = newsData.articles || []

  // LLM-friendly headlines — preserves Miyagi3 format
  const headlines = articles.map((article: any) =>
    `${article.title} - ${article.source?.name} (${new Date(article.publishedAt).toLocaleDateString()})`,
  )

  return {
    headlines,
    articles,
    totalResults: newsData.totalResults,
  }
}

// ============================================================================
// search-everything — GET /v2/everything
// ============================================================================

const searchEverything: IntegrationHandler = async (env, body) => {
  if (!env.NEWS_API_KEY) throw new Error('NEWS_API_KEY not configured')

  const q = body.q || body.query
  if (!q) throw new Error('Search query (q) is required')

  const params = new URLSearchParams({ apiKey: env.NEWS_API_KEY })

  params.append('q', String(q))
  if (body.sources) params.append('sources', String(body.sources))
  if (body.domains) params.append('domains', String(body.domains))
  if (body.excludeDomains) params.append('excludeDomains', String(body.excludeDomains))
  if (body.from) params.append('from', String(body.from))
  if (body.to) params.append('to', String(body.to))
  params.append('language', String(body.language || 'en'))
  params.append('sortBy', String(body.sortBy || 'publishedAt'))
  params.append('pageSize', String(body.pageSize || 20))
  params.append('page', String(body.page || 1))

  const response = await fetch(`https://newsapi.org/v2/everything?${params}`, {
    method: 'GET',
    headers: { 'User-Agent': 'DeepSpace-NewsAPI/1.0' },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`NewsAPI error ${response.status}: ${errorText}`)
  }

  const newsData: any = await response.json()

  if (newsData.status !== 'ok') {
    throw new Error(`NewsAPI error: ${newsData.message || 'Unknown error'}`)
  }

  const articles = newsData.articles || []

  // LLM-friendly headlines with descriptions — preserves Miyagi3 format
  const headlines = articles.map((article: any, index: number) =>
    `${index + 1}. ${article.title} - ${article.source?.name} (${new Date(article.publishedAt).toLocaleDateString()})${article.description ? ': ' + article.description.substring(0, 100) + '...' : ''}`,
  )

  return {
    headlines,
    articles,
    totalResults: newsData.totalResults,
  }
}

// ============================================================================
// Exports
// ============================================================================

const BILLING = { model: 'per_request' as const, baseCost: 0.018, currency: 'USD' }

const topHeadlinesSchema = z.object({
  country: z.string().default('us'),
  category: z.string().optional(),
  sources: z.string().optional(),
  q: z.string().optional(),
  pageSize: z.number().min(1).max(100).default(20),
  page: z.number().min(1).default(1),
})

const searchEverythingSchema = z.object({
  q: z.string().optional(),
  query: z.string().optional(),
  sources: z.string().optional(),
  domains: z.string().optional(),
  excludeDomains: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  language: z.string().default('en'),
  sortBy: z.string().default('publishedAt'),
  pageSize: z.number().min(1).max(100).default(20),
  page: z.number().min(1).default(1),
})

export const endpoints: Record<string, EndpointDefinition> = {
  'newsapi/top-headlines':    { handler: topHeadlines,    billing: BILLING, schema: topHeadlinesSchema },
  'newsapi/search-everything': { handler: searchEverything, billing: BILLING, schema: searchEverythingSchema },
}
