/**
 * Wikipedia integration — search, summary, content, random.
 * No API key needed — public REST API.
 */

import { z } from 'zod'
import type { IntegrationHandler, EndpointDefinition } from '../_types'

const HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'DeepSpace-Wikipedia/1.0 (https://deep.space)',
}
const BILLING = { model: 'per_request' as const, baseCost: 0.001, currency: 'USD' }

const searchPages: IntegrationHandler = async (_env, body) => {
  const query = body.query || body.q
  if (!query) throw new Error('query is required')

  const url = `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(String(query).trim())}&limit=${body.limit || 10}`
  const response = await fetch(url, { headers: HEADERS })

  if (!response.ok) throw new Error(`Wikipedia API error: ${response.status} - ${await response.text()}`)

  const data: any = await response.json()
  return (data.pages || []).map((item: any) => ({
    title: item.title,
    key: item.key,
    excerpt: item.excerpt?.replace(/<[^>]*>/g, ''),
    description: item.description || item.excerpt?.replace(/<[^>]*>/g, ''),
    id: item.id,
    thumbnail: item.thumbnail?.url ? `https:${item.thumbnail.url}` : null,
  }))
}

const getPageSummary: IntegrationHandler = async (_env, body) => {
  if (!body.title) throw new Error('title is required')

  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(String(body.title).trim())}`
  const response = await fetch(url, { headers: HEADERS })

  if (!response.ok) throw new Error(`Wikipedia API error: ${response.status} - ${await response.text()}`)

  const data: any = await response.json()
  return {
    title: data.title,
    description: data.description,
    extract: data.extract,
    url: data.content_urls?.desktop?.page,
    pageData: data,
  }
}

const getPageContent: IntegrationHandler = async (_env, body) => {
  if (!body.title) throw new Error('title is required')

  const url = `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(String(body.title).trim())}`
  const response = await fetch(url, { headers: HEADERS })

  if (!response.ok) throw new Error(`Wikipedia API error: ${response.status} - ${await response.text()}`)

  return { htmlContent: await response.text() }
}

const getRandomPage: IntegrationHandler = async () => {
  const response = await fetch('https://en.wikipedia.org/api/rest_v1/page/random/summary', { headers: HEADERS })

  if (!response.ok) throw new Error(`Wikipedia API error: ${response.status} - ${await response.text()}`)

  const data: any = await response.json()
  return {
    title: data.title,
    description: data.description,
    extract: data.extract,
    url: data.content_urls?.desktop?.page,
    pageData: data,
  }
}

const searchPagesSchema = z.object({
  query: z.string().optional(),
  q: z.string().optional(),
  limit: z.number().min(1).max(50).default(10),
})

const pageTitleSchema = z.object({
  title: z.string(),
})

const randomPageSchema = z.object({})

export const endpoints: Record<string, EndpointDefinition> = {
  'wikipedia/search-pages': { handler: searchPages, billing: BILLING, schema: searchPagesSchema },
  'wikipedia/get-page-summary': { handler: getPageSummary, billing: BILLING, schema: pageTitleSchema },
  'wikipedia/get-page-content': { handler: getPageContent, billing: BILLING, schema: pageTitleSchema },
  'wikipedia/get-random-page': { handler: getRandomPage, billing: BILLING, schema: randomPageSchema },
}
