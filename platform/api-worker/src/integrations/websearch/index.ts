/**
 * Advanced web search integration — multi-modal search via SerpAPI with
 * AI-powered summarization via OpenAI.
 *
 * Supports web, image, video, and academic search types. Results are
 * fetched from SerpAPI, web pages are scraped and chunked, and relevant
 * chunks are summarized by gpt-4o-mini with inline citations.
 *
 * NOTE: PDF text extraction is not available in Cloudflare Workers
 * (requires Node.js pdf-parse). PDF results are returned as links only.
 */

import { z } from 'zod'
import type { IntegrationHandler, EndpointDefinition } from '../_types'

// ============================================================================
// Types
// ============================================================================

type SearchType = 'web' | 'images' | 'videos' | 'academic' | 'all'

interface SearchSource {
  url: string
  title?: string
  snippet?: string
  date?: string
  extractedText?: string
}

interface ImageResult {
  url: string
  title?: string
  originalUrl?: string
  thumbnailUrl?: string
  source?: string
  width?: number
  height?: number
}

interface VideoResult {
  url: string
  title?: string
  thumbnailUrl?: string
  source?: string
  duration?: string
}

interface Asset {
  kind: 'image' | 'video'
  url: string
  thumbnailUrl?: string
  title?: string
  attribution?: string
  width?: number
  height?: number
}

// ============================================================================
// Helpers
// ============================================================================

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    return u.toString()
  } catch {
    return url
  }
}

function dedupeByDomain(urls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const u of urls) {
    try {
      const host = new URL(u).hostname.replace(/^www\./, '')
      if (!seen.has(host)) {
        seen.add(host)
        out.push(u)
      }
    } catch {
      if (!seen.has(u)) {
        seen.add(u)
        out.push(u)
      }
    }
  }
  return out
}

function stripHtmlToText(html: string): string {
  let clean = html
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<nav[^>]*>.*?<\/nav>/gis, '')
    .replace(/<header[^>]*>.*?<\/header>/gis, '')
    .replace(/<footer[^>]*>.*?<\/footer>/gis, '')
    .replace(/<aside[^>]*>.*?<\/aside>/gis, '')
    .replace(/<!--.*?-->/gs, '')

  const mainMatch = /<(main|article)[^>]*>([\s\S]*?)<\/\1>/i.exec(clean)
  if (mainMatch) clean = mainMatch[2]

  return clean
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-zA-Z0-9#]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitIntoChunks(text: string, targetChars: number, overlapChars: number): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + targetChars, text.length)
    chunks.push(text.slice(start, end))
    if (end === text.length) break
    start = Math.max(end - overlapChars, start + 1)
  }
  return chunks
}

function rankByQueryRelevance(chunks: string[], query: string): string[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const score = (t: string) => {
    const lower = t.toLowerCase()
    return terms.reduce((acc, term) => acc + (lower.includes(term) ? 1 : 0), 0)
  }
  return [...chunks].sort((a, b) => score(b) - score(a))
}

async function fetchPageText(url: string, timeoutMs = 8000): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DeepSpaceBot/1.0)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!response.ok) return null
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml'))
      return null
    const html = await response.text()
    if (html.length > 2_000_000) return null
    return stripHtmlToText(html)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ============================================================================
// SerpAPI multi-engine search
// ============================================================================

async function serpApiMultiSearch(
  apiKey: string,
  query: string,
  count: number,
  searchType: SearchType,
): Promise<{
  sources: SearchSource[]
  images: ImageResult[]
  videos: VideoResult[]
}> {
  const results: {
    sources: SearchSource[]
    images: ImageResult[]
    videos: VideoResult[]
  } = { sources: [], images: [], videos: [] }

  type EngineConfig = {
    engine: string
    key: string
    extraParams?: Record<string, string>
  }
  const engines: EngineConfig[] = []

  if (searchType === 'web' || searchType === 'all')
    engines.push({ engine: 'google_light', key: 'web' })
  if (searchType === 'images' || searchType === 'all')
    engines.push({ engine: 'google_images', key: 'images' })
  if (searchType === 'videos' || searchType === 'all')
    engines.push({ engine: 'google_videos', key: 'videos' })
  if (searchType === 'academic' || searchType === 'all')
    engines.push({ engine: 'google_light', key: 'academic', extraParams: { as_sitesearch: 'edu' } })

  for (const { engine, key: resultKey, extraParams } of engines) {
    const adjustedCount =
      searchType === 'all' ? Math.ceil(count / engines.length) : count
    try {
      const params = new URLSearchParams({
        api_key: apiKey,
        engine,
        q: query,
        num: String(adjustedCount),
        ...(extraParams || {}),
      })

      const response = await fetch(`https://serpapi.com/search?${params}`)
      if (!response.ok) continue

      const data = (await response.json()) as Record<string, unknown>

      if (resultKey === 'web' || resultKey === 'academic') {
        const organicResults = (data.organic_results as Array<Record<string, unknown>>) || []
        const raw = organicResults.filter(
          (r) => typeof r.link === 'string',
        )
        const urls = raw.map((r) => normalizeUrl(r.link as string))
        const diversified = dedupeByDomain(urls).slice(0, Math.min(Math.max(adjustedCount, 1), 10))
        const byUrl = new Map<string, (typeof raw)[0]>()
        for (const r of raw) if (r.link) byUrl.set(normalizeUrl(r.link as string), r)
        const sources = diversified.map((u) => {
          const r = byUrl.get(u)
          return {
            url: u,
            title: r?.title as string | undefined,
            snippet: (r?.snippet as string | undefined)?.trim(),
            date: r?.date as string | undefined,
          }
        })
        if (resultKey === 'web') {
          results.sources = sources
        } else {
          results.sources = [...results.sources, ...sources]
        }
      }

      if (resultKey === 'images') {
        const imageResults = (data.images_results as Array<Record<string, unknown>>) || []
        results.images = imageResults
          .slice(0, Math.min(Math.max(adjustedCount, 1), 20))
          .map((img) => ({
            url: (img.original as string) || (img.link as string) || '',
            title: img.title as string | undefined,
            originalUrl: (img.original as string) || (img.link as string),
            thumbnailUrl: img.thumbnail as string | undefined,
            source: img.source as string | undefined,
            width: img.width as number | undefined,
            height: img.height as number | undefined,
          }))
      }

      if (resultKey === 'videos') {
        const videoResults = (data.video_results as Array<Record<string, unknown>>) || []
        results.videos = videoResults
          .slice(0, Math.min(Math.max(adjustedCount, 1), 10))
          .map((vid) => ({
            url: (vid.link as string) || '',
            title: vid.title as string | undefined,
            thumbnailUrl: vid.thumbnail as string | undefined,
            source: vid.source as string | undefined,
            duration: vid.duration as string | undefined,
          }))
      }
    } catch {
      // Continue with other engines on failure
    }
  }

  return results
}

// ============================================================================
// Handler
// ============================================================================

const advancedSearch: IntegrationHandler = async (env, body) => {
  if (!env.SERPAPI_API_KEY) throw new Error('SERPAPI_API_KEY not configured')
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured')

  const searchPrompt = body.searchPrompt as string
  if (!searchPrompt || searchPrompt.trim().length < 1) {
    throw new Error('searchPrompt is required')
  }

  const queryHints = (body.queryHints as string[]) || []
  const searchType = ((body.searchType as string) || 'all') as SearchType
  const count = Math.max(1, Math.min(Number(body.count) || 5, 10))
  const parseResultsPrompt = body.parseResultsPrompt as string | undefined

  const composedQuery = [searchPrompt, ...queryHints].filter(Boolean).join(' ')

  // 1) SerpAPI multi-engine search
  const { sources, images, videos } = await serpApiMultiSearch(
    env.SERPAPI_API_KEY,
    composedQuery,
    count,
    searchType,
  )

  // 2) Fetch page texts and summarize with AI (web/all only)
  let summary = ''
  let citations: Array<{ url: string; title?: string; snippet?: string }> = []

  if (searchType === 'web' || searchType === 'all') {
    const fetchResults: Array<{ source: SearchSource; text: string | null }> = []

    for (const s of sources) {
      // Skip PDFs -- pdf-parse is not available in Workers
      if (/\.pdf($|\?)/i.test(s.url)) {
        fetchResults.push({ source: s, text: null })
        continue
      }
      const text = await fetchPageText(s.url)
      fetchResults.push({
        source: s,
        text: text && text.length >= 200 ? text : null,
      })
    }

    // Store extracted text back into sources
    for (const f of fetchResults) {
      if (f.text) {
        f.source.extractedText = f.text
      }
    }

    const usable = fetchResults.filter(
      (f): f is { source: SearchSource; text: string } => !!f.text,
    )

    const allChunks: Array<{ source: SearchSource; chunk: string }> = []
    for (const f of usable) {
      const chunks = splitIntoChunks(f.text, 6000, 600) // ~1500 tokens, 150 overlap
      const ranked = rankByQueryRelevance(chunks, composedQuery).slice(0, 3)
      for (const c of ranked) allChunks.push({ source: f.source, chunk: c })
    }

    const selected = allChunks.slice(0, 8)
    if (selected.length > 0) {
      const contextBlocks = selected
        .map((c, i) => `Source ${i + 1} (${c.source.title || c.source.url}):\n${c.chunk}`)
        .join('\n\n')

      const systemPrompt = [
        'You are a precise research summarizer.',
        'Rules:',
        '- Only include information strictly relevant to the user query.',
        '- Extract essential facts; avoid speculation and filler.',
        '- For every point, include a citation with the source title or URL.',
        '- If evidence is insufficient or conflicting, state that clearly.',
      ].join('\n')

      const defaultInstructions =
        'Return concise bullet points (3-8) with inline citations [n]. Then add a short synthesis paragraph with citations. Format as plain text.'

      const userPrompt = [
        `Query: ${composedQuery}`,
        '',
        'Context:',
        contextBlocks,
        '',
        'Task:',
        parseResultsPrompt || defaultInstructions,
      ].join('\n')

      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.2,
          max_tokens: 1200,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      })

      if (openaiResponse.ok) {
        const openaiData = (await openaiResponse.json()) as {
          choices: Array<{ message: { content: string } }>
        }
        summary = openaiData.choices?.[0]?.message?.content?.trim() || ''
      }

      citations = selected.map((c) => ({
        url: c.source.url,
        title: c.source.title,
        snippet: c.source.snippet,
      }))
    }
  }

  // Media-only summary fallback
  if (
    (searchType === 'images' || searchType === 'videos' || searchType === 'academic') &&
    summary === ''
  ) {
    const mediaType = searchType === 'academic' ? 'academic sources' : searchType
    let total = 0
    if (searchType === 'images') total = images.length
    else if (searchType === 'videos') total = videos.length
    else if (searchType === 'academic') total = sources.length
    summary =
      total > 0
        ? `Found ${total} ${mediaType} related to "${composedQuery}".`
        : `No ${mediaType} found for "${composedQuery}".`
  }

  // Append media counts for 'all' search
  if (searchType === 'all' && summary && (images.length > 0 || videos.length > 0)) {
    const mediaInfo: string[] = []
    if (images.length > 0) mediaInfo.push(`${images.length} images`)
    if (videos.length > 0) mediaInfo.push(`${videos.length} videos`)
    summary += `\n\nAdditionally, found ${mediaInfo.join(', ')} related to your query.`
  }

  // Normalize assets
  const assets: Asset[] = []
  for (const img of images) {
    assets.push({
      kind: 'image',
      url: img.originalUrl || img.url,
      thumbnailUrl: img.thumbnailUrl,
      width: img.width,
      height: img.height,
      title: img.title,
      attribution: img.source,
    })
  }
  for (const vid of videos) {
    assets.push({
      kind: 'video',
      url: vid.url,
      thumbnailUrl: vid.thumbnailUrl,
      title: vid.title,
      attribution: vid.source,
    })
  }

  return {
    summary,
    citations,
    assets,
    dataset: { sources, images, videos },
  }
}

// ============================================================================
// Exports
// ============================================================================

const advancedSearchSchema = z.object({
  searchPrompt: z.string().min(1),
  queryHints: z.array(z.string()).default([]),
  searchType: z.enum(['web', 'images', 'videos', 'academic', 'all']).default('all'),
  count: z.number().min(1).max(10).default(5),
  parseResultsPrompt: z.string().optional(),
})

export const endpoints: Record<string, EndpointDefinition> = {
  'websearch/advanced-search': {
    handler: advancedSearch,
    billing: {
      model: 'per_request',
      baseCost: 0.02,
      currency: 'USD',
    },
    schema: advancedSearchSchema,
  },
}
