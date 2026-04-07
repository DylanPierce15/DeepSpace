/**
 * Firecrawl integration — web scraping, crawling, mapping, and search.
 * Ported from Miyagi3 FirecrawlService.ts.
 *
 * Pricing: $9 per 1k Firecrawl credits = $0.009 per credit.
 * Scrape and crawl are async operations that return a job ID and require polling.
 * Map and search are synchronous.
 */

import { z } from 'zod'
import type { IntegrationHandler, EndpointDefinition } from '../_types'
import { pollForResult } from '../_polling'

// ============================================================================
// Constants
// ============================================================================

const FIRECRAWL_API_BASE = 'https://api.firecrawl.dev/v1'

function firecrawlHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}

async function firecrawlPost(apiKey: string, path: string, body: unknown): Promise<any> {
  const response = await fetch(`${FIRECRAWL_API_BASE}${path}`, {
    method: 'POST',
    headers: firecrawlHeaders(apiKey),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Firecrawl API error ${response.status}: ${errorText}`)
  }

  return response.json()
}

// ============================================================================
// scrape — POST /scrape, may need polling
// ============================================================================

const scrape: IntegrationHandler = async (env, body) => {
  if (!env.FIRECRAWL_API_KEY) throw new Error('FIRECRAWL_API_KEY not configured')

  const url = body.url as string
  if (!url) throw new Error('url is required')

  const requestBody: Record<string, unknown> = {
    url,
    formats: (body.formats as string[]) || ['markdown'],
    onlyMainContent: body.onlyMainContent ?? true,
  }
  if (body.includeTags) requestBody.includeTags = body.includeTags
  if (body.excludeTags) requestBody.excludeTags = body.excludeTags
  if (body.waitFor) requestBody.waitFor = body.waitFor
  if (body.timeout) requestBody.timeout = body.timeout

  const data = await firecrawlPost(env.FIRECRAWL_API_KEY, '/scrape', requestBody)

  // Synchronous response — data returned directly
  if (data.success && data.data) {
    return { data: data.data, creditsUsed: data.creditsUsed }
  }

  // Async response — poll for completion
  const jobId = data.id
  if (!jobId) throw new Error('No job ID returned from Firecrawl')

  const pollResult = await pollForResult({
    statusUrl: `${FIRECRAWL_API_BASE}/scrape/${jobId}`,
    headers: firecrawlHeaders(env.FIRECRAWL_API_KEY),
    maxAttempts: 60,
    pollInterval: 3000,
    initialDelay: 2000,
    completedStatuses: ['completed'],
    failedStatuses: ['failed', 'error'],
  })

  if (!pollResult.success) {
    throw new Error(pollResult.error || 'Scrape polling failed')
  }

  return {
    data: pollResult.data?.data,
    creditsUsed: pollResult.data?.creditsUsed || 1,
  }
}

// ============================================================================
// crawl — POST /crawl, returns job ID, poll for completion
// ============================================================================

const crawl: IntegrationHandler = async (env, body) => {
  if (!env.FIRECRAWL_API_KEY) throw new Error('FIRECRAWL_API_KEY not configured')

  const url = body.url as string
  if (!url) throw new Error('url is required')

  const limit = (body.limit as number) ?? 10

  const requestBody: Record<string, unknown> = {
    url,
    limit,
  }
  if (body.maxDepth !== undefined) requestBody.maxDepth = body.maxDepth
  if (body.allowBackwardLinks !== undefined) requestBody.allowBackwardLinks = body.allowBackwardLinks
  if (body.allowExternalLinks !== undefined) requestBody.allowExternalLinks = body.allowExternalLinks
  if (body.includePaths) requestBody.includePaths = body.includePaths
  if (body.excludePaths) requestBody.excludePaths = body.excludePaths
  requestBody.scrapeOptions = {
    formats: (body.formats as string[]) || ['markdown'],
    onlyMainContent: body.onlyMainContent ?? true,
  }

  const data = await firecrawlPost(env.FIRECRAWL_API_KEY, '/crawl', requestBody)

  const jobId = data.id
  if (!jobId) throw new Error('No job ID returned from Firecrawl')

  const pollResult = await pollForResult({
    statusUrl: `${FIRECRAWL_API_BASE}/crawl/${jobId}`,
    headers: firecrawlHeaders(env.FIRECRAWL_API_KEY),
    maxAttempts: 180,
    pollInterval: 5000,
    initialDelay: 3000,
    completedStatuses: ['completed'],
    failedStatuses: ['failed', 'error'],
  })

  if (!pollResult.success) {
    throw new Error(pollResult.error || 'Crawl polling failed')
  }

  return {
    data: pollResult.data?.data,
    creditsUsed: pollResult.data?.creditsUsed || limit,
  }
}

// ============================================================================
// map — POST /map (synchronous)
// ============================================================================

const map: IntegrationHandler = async (env, body) => {
  if (!env.FIRECRAWL_API_KEY) throw new Error('FIRECRAWL_API_KEY not configured')

  const url = body.url as string
  if (!url) throw new Error('url is required')

  const requestBody: Record<string, unknown> = { url }
  if (body.search) requestBody.search = body.search
  if (body.ignoreSitemap !== undefined) requestBody.ignoreSitemap = body.ignoreSitemap
  if (body.sitemapOnly !== undefined) requestBody.sitemapOnly = body.sitemapOnly
  if (body.includeSubdomains !== undefined) requestBody.includeSubdomains = body.includeSubdomains
  if (body.limit !== undefined) requestBody.limit = body.limit

  const data = await firecrawlPost(env.FIRECRAWL_API_KEY, '/map', requestBody)

  if (!data.success) {
    throw new Error(data.error || 'Map operation failed')
  }

  return {
    links: data.links || [],
    creditsUsed: data.creditsUsed || 1,
  }
}

// ============================================================================
// search — POST /search (synchronous)
// ============================================================================

const search: IntegrationHandler = async (env, body) => {
  if (!env.FIRECRAWL_API_KEY) throw new Error('FIRECRAWL_API_KEY not configured')

  const query = body.query as string
  if (!query) throw new Error('query is required')

  const requestBody: Record<string, unknown> = {
    query,
    limit: (body.limit as number) ?? 5,
  }
  if (body.lang) requestBody.lang = body.lang
  if (body.country) requestBody.country = body.country
  if (body.scrapeOptions) {
    requestBody.scrapeOptions = body.scrapeOptions
  } else {
    requestBody.scrapeOptions = { formats: ['markdown'], onlyMainContent: true }
  }

  const data = await firecrawlPost(env.FIRECRAWL_API_KEY, '/search', requestBody)

  if (!data.success) {
    throw new Error(data.error || 'Search operation failed')
  }

  return {
    data: data.data,
    creditsUsed: data.creditsUsed || 2,
  }
}

// ============================================================================
// Exports
// ============================================================================

const FIRECRAWL_BILLING = { model: 'per_request' as const, baseCost: 0.009, currency: 'USD' }

const scrapeSchema = z.object({
  url: z.string(),
  formats: z.array(z.string()).default(['markdown']),
  onlyMainContent: z.boolean().default(true),
  includeTags: z.array(z.string()).optional(),
  excludeTags: z.array(z.string()).optional(),
  waitFor: z.number().optional(),
  timeout: z.number().optional(),
})

const crawlSchema = z.object({
  url: z.string(),
  limit: z.number().min(1).default(10),
  maxDepth: z.number().optional(),
  allowBackwardLinks: z.boolean().optional(),
  allowExternalLinks: z.boolean().optional(),
  includePaths: z.array(z.string()).optional(),
  excludePaths: z.array(z.string()).optional(),
  formats: z.array(z.string()).default(['markdown']),
  onlyMainContent: z.boolean().default(true),
})

const mapSchema = z.object({
  url: z.string(),
  search: z.string().optional(),
  ignoreSitemap: z.boolean().optional(),
  sitemapOnly: z.boolean().optional(),
  includeSubdomains: z.boolean().optional(),
  limit: z.number().optional(),
})

const searchFirecrawlSchema = z.object({
  query: z.string(),
  limit: z.number().min(1).default(5),
  lang: z.string().optional(),
  country: z.string().optional(),
  scrapeOptions: z.record(z.string(), z.unknown()).optional(),
})

export const endpoints: Record<string, EndpointDefinition> = {
  'firecrawl/scrape':  { handler: scrape,  billing: FIRECRAWL_BILLING, schema: scrapeSchema },
  'firecrawl/crawl':   { handler: crawl,   billing: FIRECRAWL_BILLING, schema: crawlSchema },
  'firecrawl/map':     { handler: map,     billing: FIRECRAWL_BILLING, schema: mapSchema },
  'firecrawl/search':  { handler: search,  billing: FIRECRAWL_BILLING, schema: searchFirecrawlSchema },
}
