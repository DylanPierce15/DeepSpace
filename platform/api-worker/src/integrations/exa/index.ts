/**
 * Exa AI integration handlers.
 * Ported from Miyagi3 ExaService.ts + NewsExaService.ts.
 * Preserves all request body building and response transformation logic.
 */

import type { IntegrationHandler, EndpointDefinition } from '../_types'
import { pollForResult } from '../_polling'

const EXA_API_BASE = 'https://api.exa.ai'

// ============================================================================
// Shared helpers — extracted from ExaService class methods
// ============================================================================

function exaHeaders(apiKey: string) {
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'User-Agent': 'DeepSpace-Exa-Service/1.0',
  }
}

async function exaPost(apiKey: string, path: string, body: unknown): Promise<any> {
  const response = await fetch(`${EXA_API_BASE}${path}`, {
    method: 'POST',
    headers: exaHeaders(apiKey),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Exa API error ${response.status}: ${errorText}`)
  }

  return response.json()
}

function transformResultItem(item: any) {
  return {
    title: item.title || '',
    url: item.url || '',
    publishedDate: item.publishedDate || null,
    author: item.author || null,
    id: item.id || '',
    image: item.image,
    favicon: item.favicon,
    text: item.text,
    highlights: item.highlights,
    summary: item.summary,
    extras: item.extras ? { links: item.extras.links, imageLinks: item.extras.imageLinks } : undefined,
  }
}

function transformContentsResultItem(item: any): any {
  return {
    title: item.title || '',
    url: item.url || '',
    publishedDate: item.publishedDate || null,
    author: item.author || null,
    id: item.id || '',
    image: item.image,
    favicon: item.favicon,
    text: item.text,
    highlights: item.highlights,
    summary: item.summary,
    subpages: item.subpages ? item.subpages.map(transformContentsResultItem) : undefined,
    extras: item.extras ? { links: item.extras.links, imageLinks: item.extras.imageLinks } : undefined,
  }
}

/** Build text config — handles boolean or object. */
function buildTextConfig(text: boolean | { maxCharacters?: number; includeHtmlTags?: boolean }) {
  return text
}

/** Build highlights config — prefers maxCharacters, falls back to deprecated numSentences. */
function buildHighlightsConfig(h: {
  maxCharacters?: number
  query?: string
  numSentences?: number
  highlightsPerUrl?: number
}) {
  const config: any = {}
  if (h.maxCharacters !== undefined) {
    config.maxCharacters = Math.max(1, h.maxCharacters)
  } else if (h.numSentences !== undefined) {
    config.numSentences = Math.max(1, h.numSentences)
  }
  if (h.highlightsPerUrl !== undefined && h.maxCharacters === undefined) {
    config.highlightsPerUrl = Math.max(1, h.highlightsPerUrl)
  }
  if (h.query) config.query = h.query
  return config
}

/** Build contents config block shared by search and findSimilar. */
function buildContentsConfig(contents: any) {
  if (!contents) return undefined
  const c: any = {}
  if (contents.text !== undefined) c.text = buildTextConfig(contents.text)
  if (contents.highlights) c.highlights = buildHighlightsConfig(contents.highlights)
  if (contents.summary) c.summary = contents.summary.query ? { query: contents.summary.query } : {}
  if (contents.extras) c.extras = contents.extras
  return c
}

// ============================================================================
// search — POST /search
// ============================================================================

const search: IntegrationHandler = async (env, body) => {
  if (!env.EXA_API_KEY) throw new Error('EXA_API_KEY not configured')

  const query = body.query || body.q
  if (!query || String(query).trim().length === 0) throw new Error('query is required')

  const numResults = Math.max(1, Math.min((body.numResults as number) || 10, 100))

  const requestBody: any = {
    query: String(query).trim(),
    numResults,
    type: body.type || 'auto',
  }

  // Optional filters
  if (body.category) requestBody.category = body.category
  if (body.userLocation) requestBody.userLocation = body.userLocation
  if ((body.includeDomains as any[])?.length) requestBody.includeDomains = body.includeDomains
  if ((body.excludeDomains as any[])?.length) requestBody.excludeDomains = body.excludeDomains
  if (body.startPublishedDate) requestBody.startPublishedDate = body.startPublishedDate
  if (body.endPublishedDate) requestBody.endPublishedDate = body.endPublishedDate
  if ((body.includeText as any[])?.length) requestBody.includeText = body.includeText
  if ((body.excludeText as any[])?.length) requestBody.excludeText = body.excludeText
  if (body.context !== undefined) requestBody.context = body.context
  if (body.moderation !== undefined) requestBody.moderation = body.moderation

  // Contents configuration
  const contentsInput = body.contents as any
  requestBody.contents = buildContentsConfig(contentsInput) || {
    text: contentsInput?.text !== false ? (contentsInput?.text ?? true) : false,
  }

  const data = await exaPost(env.EXA_API_KEY, '/search', requestBody)

  return {
    results: (data.results || []).map(transformResultItem),
    context: data.context,
    searchType: data.searchType,
    costDollars: data.costDollars,
  }
}

// ============================================================================
// answer — POST /answer
// ============================================================================

const answer: IntegrationHandler = async (env, body) => {
  if (!env.EXA_API_KEY) throw new Error('EXA_API_KEY not configured')

  const query = body.query || body.q
  if (!query || String(query).trim().length === 0) throw new Error('query is required')

  const data = await exaPost(env.EXA_API_KEY, '/answer', {
    query: String(query).trim(),
    text: body.text || false,
  })

  return {
    answer: data.answer,
    citations: (data.citations || []).map((item: any) => ({
      id: item.id || '',
      url: item.url || '',
      title: item.title || '',
      author: item.author || null,
      publishedDate: item.publishedDate || null,
      text: item.text,
      image: item.image,
      favicon: item.favicon,
    })),
    costDollars: data.costDollars,
  }
}

// ============================================================================
// findSimilar — POST /findSimilar
// ============================================================================

const findSimilar: IntegrationHandler = async (env, body) => {
  if (!env.EXA_API_KEY) throw new Error('EXA_API_KEY not configured')

  const url = body.url
  if (!url || String(url).trim().length === 0) throw new Error('url is required')

  const numResults = Math.max(1, Math.min((body.numResults as number) || 10, 100))

  const requestBody: any = {
    url: String(url).trim(),
    numResults,
  }

  // Optional filters
  if ((body.includeDomains as any[])?.length) requestBody.includeDomains = body.includeDomains
  if ((body.excludeDomains as any[])?.length) requestBody.excludeDomains = body.excludeDomains
  if (body.startPublishedDate) requestBody.startPublishedDate = body.startPublishedDate
  if (body.endPublishedDate) requestBody.endPublishedDate = body.endPublishedDate
  if ((body.includeText as any[])?.length) requestBody.includeText = body.includeText
  if ((body.excludeText as any[])?.length) requestBody.excludeText = body.excludeText
  if (body.context !== undefined) requestBody.context = body.context
  if (body.moderation !== undefined) requestBody.moderation = body.moderation

  // Contents configuration
  const contentsConfig = buildContentsConfig(body.contents)
  if (contentsConfig) requestBody.contents = contentsConfig

  const data = await exaPost(env.EXA_API_KEY, '/findSimilar', requestBody)

  return {
    results: (data.results || []).map(transformResultItem),
    context: data.context,
    costDollars: data.costDollars,
  }
}

// ============================================================================
// contents — POST /contents
// ============================================================================

const contents: IntegrationHandler = async (env, body) => {
  if (!env.EXA_API_KEY) throw new Error('EXA_API_KEY not configured')

  const urls = body.urls as string[]
  if (!urls || urls.length === 0) throw new Error('urls array is required and cannot be empty')

  const requestBody: any = { urls }

  if (body.text !== undefined) requestBody.text = buildTextConfig(body.text as any)
  if (body.highlights) requestBody.highlights = buildHighlightsConfig(body.highlights as any)
  if (body.summary) requestBody.summary = (body.summary as any).query ? { query: (body.summary as any).query } : {}
  if (body.subpages !== undefined) requestBody.subpages = body.subpages
  if (body.subpageTarget !== undefined) requestBody.subpageTarget = body.subpageTarget
  if (body.extras) requestBody.extras = body.extras
  if (body.context !== undefined) requestBody.context = body.context

  const data = await exaPost(env.EXA_API_KEY, '/contents', requestBody)

  return {
    results: (data.results || []).map(transformContentsResultItem),
    context: data.context,
    statuses: data.statuses,
    costDollars: data.costDollars,
  }
}

// ============================================================================
// research — POST /research/v1 then poll until complete
// ============================================================================

const MAX_INSTRUCTIONS_LENGTH = 4096

const research: IntegrationHandler = async (env, body) => {
  if (!env.EXA_API_KEY) throw new Error('EXA_API_KEY not configured')

  const instructions = body.instructions
  if (!instructions || String(instructions).trim().length === 0) throw new Error('instructions are required')
  if (String(instructions).length > MAX_INSTRUCTIONS_LENGTH) {
    throw new Error(`Instructions must be ${MAX_INSTRUCTIONS_LENGTH} characters or less`)
  }

  const requestBody: any = {
    instructions: String(instructions).trim(),
    model: body.model || 'exa-research',
  }
  if (body.outputSchema) requestBody.outputSchema = body.outputSchema

  // Step 1: Create the research task
  const createData = await exaPost(env.EXA_API_KEY, '/research/v1', requestBody)

  const researchId = createData?.researchId
  if (!researchId) throw new Error('No research ID returned from Exa API')

  // Step 2: Poll for completion (up to ~10 minutes)
  const pollResult = await pollForResult({
    statusUrl: `${EXA_API_BASE}/research/v1/${researchId}`,
    headers: exaHeaders(env.EXA_API_KEY),
    maxAttempts: 60,
    pollInterval: 10000,
    initialDelay: 5000,
    completedStatuses: ['completed'],
    failedStatuses: ['failed', 'canceled'],
  })

  if (!pollResult.success) {
    return {
      researchId,
      status: 'failed',
      error: pollResult.error,
    }
  }

  // Step 3: Extract results
  const researchData = pollResult.data
  const payload = researchData?.data ?? researchData

  let costDollars: any
  const costSource = payload?.costDollars ?? researchData?.costDollars
  if (costSource?.total !== undefined) {
    const total = parseFloat(costSource.total)
    if (!isNaN(total) && total >= 0) {
      costDollars = {
        total,
        numSearches: costSource.numSearches,
        numPages: costSource.numPages,
        reasoningTokens: costSource.reasoningTokens,
      }
    }
  }

  let content: string | undefined
  let parsed: Record<string, any> | undefined
  let output: any

  const outputSource = payload?.output ?? researchData?.output
  if (outputSource?.content) {
    content = outputSource.content
    output = { content: outputSource.content }
    if (outputSource?.parsed) {
      parsed = outputSource.parsed
      output.parsed = outputSource.parsed
    }
  }

  return {
    researchId,
    status: 'completed',
    content,
    parsed,
    output,
    costDollars,
  }
}

// ============================================================================
// news-search — POST /search with category='news' (from NewsExaService)
// ============================================================================

const newsSearch: IntegrationHandler = async (env, body) => {
  if (!env.EXA_API_KEY) throw new Error('EXA_API_KEY not configured')

  const query = body.q || body.query
  if (!query || String(query).trim().length === 0) throw new Error('Search query (q) is required')

  const numResults = Math.max(1, Math.min((body.numResults as number) || 10, 100))

  const requestBody: any = {
    query: String(query).trim(),
    numResults,
    type: body.type || 'auto',
    category: 'news',
    contents: {
      text: { maxCharacters: 3000 },
      summary: { query: 'Summarize the key news from this article' },
      highlights: { maxCharacters: 500, query: 'Key news points and developments' },
    },
    moderation: true,
  }

  if (body.country) requestBody.userLocation = String(body.country).toUpperCase()
  if ((body.includeDomains as any[])?.length) requestBody.includeDomains = body.includeDomains
  if ((body.excludeDomains as any[])?.length) requestBody.excludeDomains = body.excludeDomains
  if (body.from) requestBody.startPublishedDate = body.from
  if (body.to) requestBody.endPublishedDate = body.to
  if ((body.includeText as any[])?.length) requestBody.includeText = body.includeText
  if ((body.excludeText as any[])?.length) requestBody.excludeText = body.excludeText

  const data = await exaPost(env.EXA_API_KEY, '/search', requestBody)

  const results = (data.results || []).map((item: any) => ({
    title: item.title || '',
    url: item.url || '',
    publishedDate: item.publishedDate || null,
    author: item.author || null,
    id: item.id || '',
    image: item.image,
    favicon: item.favicon,
    text: item.text,
    highlights: item.highlights,
    summary: item.summary,
  }))

  // Build LLM-friendly headlines
  const headlines = results.map((article: any, index: number) => {
    let domain = 'unknown'
    try { domain = new URL(article.url).hostname.replace(/^www\./, '') } catch {}
    const date = article.publishedDate
      ? new Date(article.publishedDate).toLocaleDateString()
      : 'Unknown date'
    const snippet = article.summary || article.highlights?.[0] || ''
    const suffix = snippet ? `: ${snippet.substring(0, 120)}` : ''
    return `${index + 1}. ${article.title} - ${domain} (${date})${suffix}`
  })

  return {
    results,
    headlines,
    totalResults: results.length,
    searchType: data.searchType,
    costDollars: data.costDollars,
  }
}

// ============================================================================
// Exports
// ============================================================================

const EXA_BILLING = { model: 'per_request' as const, baseCost: 0.005, currency: 'USD' }

export const endpoints: Record<string, EndpointDefinition> = {
  'exa/search':      { handler: search,      billing: EXA_BILLING },
  'exa/answer':      { handler: answer,      billing: EXA_BILLING },
  'exa/findSimilar': { handler: findSimilar, billing: EXA_BILLING },
  'exa/contents':    { handler: contents,    billing: EXA_BILLING },
  'exa/research':    { handler: research,    billing: { model: 'per_request', baseCost: 0.02, currency: 'USD' } },
  'exa/news-search': { handler: newsSearch,  billing: EXA_BILLING },
}
