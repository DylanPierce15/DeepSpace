/**
 * Instagram integration -- content extraction from post URLs.
 * Ported from Miyagi3 InstagramService.ts.
 *
 * Scrapes Instagram pages and extracts post data using multiple strategies:
 * 1. xdt_api embedded JSON (full caption + metadata)
 * 2. OG meta tags (truncated caption ~200 chars)
 * 3. JSON-LD structured data
 * 4. window._sharedData (legacy)
 */

import { z } from 'zod'
import type { IntegrationHandler, EndpointDefinition } from '../_types'

// ============================================================================
// Helpers
// ============================================================================

const BROWSER_HEADERS = {
  Accept: 'text/html',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Cache-Control': 'max-age=0',
}

/**
 * Parse Instagram URL to extract the shortcode.
 * Supports /p/, /reel/, /reels/, /tv/ formats.
 */
function parseInstagramUrl(url: string): string {
  const patterns = [
    /instagram\.com\/p\/([^\/\?]+)/,
    /instagram\.com\/reel\/([^\/\?]+)/,
    /instagram\.com\/reels\/([^\/\?]+)/,
    /instagram\.com\/tv\/([^\/\?]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match?.[1]) return match[1]
  }

  throw new Error(
    `Invalid Instagram URL format: ${url}. Must contain /p/, /reel/, or /tv/`,
  )
}

/**
 * Decode HTML entities in a string.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#x2019;/g, '\u2019')
    .replace(/&#x[0-9a-fA-F]+;/g, (match) => {
      const code = parseInt(match.slice(3, -1), 16)
      return String.fromCodePoint(code)
    })
    .replace(/&#\d+;/g, (match) => {
      const code = parseInt(match.slice(2, -1), 10)
      return String.fromCodePoint(code)
    })
}

/**
 * Decode JSON string escapes (\\n, \\u0027, etc.)
 */
function decodeJsonEscapes(raw: string): string {
  return raw
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\//g, '/')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) => {
      const code = parseInt(hex, 16)
      if (code >= 0xd800 && code <= 0xdfff) return ''
      return String.fromCharCode(code)
    })
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\')
}

/**
 * Extract post data from Instagram's embedded xdt_api JSON.
 * Returns null if not found.
 */
function extractFromXdtApi(html: string): Record<string, unknown> | null {
  try {
    const xdtIdx = html.indexOf('xdt_api__v1__')
    if (xdtIdx < 0) return null

    const scriptStart = html.lastIndexOf('<script', xdtIdx)
    const scriptEnd = html.indexOf('</script>', xdtIdx)
    if (scriptStart < 0 || scriptEnd < 0) return null

    const scriptContent = html.slice(scriptStart, scriptEnd)
    const jsonStart = scriptContent.indexOf('{')
    if (jsonStart < 0) return null

    const jsonStr = scriptContent.slice(jsonStart)

    const captionMatch = jsonStr.match(/"caption":\{"text":"((?:[^"\\]|\\.)*)"/s)
    if (!captionMatch) return null

    const caption = decodeJsonEscapes(captionMatch[1])

    const userMatch = jsonStr.match(/"user":\{"id":"[^"]*","username":"([^"]*)"/)
    const username = userMatch?.[1] || ''

    const userIdMatch = jsonStr.match(/"user":\{"id":"([^"]*)"/)
    const userId = userIdMatch?.[1] || ''

    const mediaTypeMatch = jsonStr.match(/"media_type":(\d)/)
    const mediaTypeNum = mediaTypeMatch ? parseInt(mediaTypeMatch[1]) : 1
    const mediaType =
      mediaTypeNum === 2 ? 'VIDEO' : mediaTypeNum === 8 ? 'CAROUSEL_ALBUM' : 'IMAGE'

    let thumbnailUrl = ''
    const imageMatch = jsonStr.match(
      /"image_versions2":\{"candidates":\[\{"height":\d+,"url":"([^"]*)"/,
    )
    if (imageMatch) {
      thumbnailUrl = imageMatch[1].replace(/\\\//g, '/')
    }

    const likeMatch = jsonStr.match(/"like_count":(\d+)/)
    const commentMatch = jsonStr.match(/"comment_count":(\d+)/)
    const takenAtMatch = jsonStr.match(/"taken_at":(\d+)/)
    const takenAt = takenAtMatch
      ? new Date(parseInt(takenAtMatch[1]) * 1000).toISOString()
      : undefined

    return {
      caption,
      mediaType,
      thumbnailUrl,
      username,
      userId,
      extractionMethod: 'xdt_api',
      likeCount: likeMatch ? parseInt(likeMatch[1]) : undefined,
      commentCount: commentMatch ? parseInt(commentMatch[1]) : undefined,
      takenAt,
      mediaTypeRaw: mediaTypeNum,
    }
  } catch {
    return null
  }
}

/**
 * Extract post data from OG meta tags.
 */
function extractFromOgTags(html: string): Record<string, unknown> | null {
  const ogDescMatch = html.match(
    /<meta property="og:description" content="([^"]*)"/,
  )
  const ogImageMatch = html.match(
    /<meta property="og:image" content="([^"]*)"/,
  )
  const ogTypeMatch = html.match(/<meta property="og:type" content="([^"]*)"/)

  if (!ogDescMatch || !ogImageMatch) return null

  const rawDescription = ogDescMatch[1]
  let caption = rawDescription

  const usernameMatch = rawDescription.match(/- (\w+) on/)
  const username = usernameMatch?.[1] || ''

  const captionMatch = rawDescription.match(/: &quot;(.*)&quot;$/)
  if (captionMatch) caption = captionMatch[1]

  caption = decodeHtmlEntities(caption)

  const thumbnailUrl = ogImageMatch[1].replace(/&amp;/g, '&')
  const mediaType =
    ogTypeMatch?.[1] === 'video' ? 'VIDEO' : 'IMAGE'

  return {
    caption,
    mediaType,
    thumbnailUrl,
    username,
    userId: '',
    extractionMethod: 'og_tags',
  }
}

/**
 * Extract post data from JSON-LD structured data.
 */
function extractFromJsonLd(html: string): Record<string, unknown> | null {
  const jsonLdMatch = html.match(
    /<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/s,
  )
  if (!jsonLdMatch) return null

  try {
    const jsonData = JSON.parse(jsonLdMatch[1])
    return {
      caption: jsonData.articleBody || jsonData.caption || '',
      mediaType: jsonData['@type'] === 'VideoObject' ? 'VIDEO' : 'IMAGE',
      thumbnailUrl: jsonData.thumbnailUrl || jsonData.image || '',
      username: jsonData.author?.name || jsonData.author?.identifier?.name || '',
      userId: jsonData.author?.identifier?.value || '',
      extractionMethod: 'json_ld',
    }
  } catch {
    return null
  }
}

/**
 * Extract post data from window._sharedData (legacy).
 */
function extractFromSharedData(html: string): Record<string, unknown> | null {
  const sharedDataMatch = html.match(/window\._sharedData\s*=\s*({.+?});/s)
  if (!sharedDataMatch) return null

  try {
    const sharedData = JSON.parse(sharedDataMatch[1])
    const media =
      sharedData?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media
    if (!media) return null

    return {
      caption: media.edge_media_to_caption?.edges?.[0]?.node?.text || '',
      mediaType: media.is_video ? 'VIDEO' : 'IMAGE',
      thumbnailUrl: media.display_url || media.thumbnail_src || '',
      username: media.owner?.username || '',
      userId: media.owner?.id || '',
      extractionMethod: 'shared_data',
    }
  } catch {
    return null
  }
}

// ============================================================================
// Handler
// ============================================================================

const extractContent: IntegrationHandler = async (_env, body) => {
  const url = body.url as string
  if (!url) throw new Error('Instagram URL is required')

  const shortcode = parseInstagramUrl(url)

  const response = await fetch(url, { method: 'GET', headers: BROWSER_HEADERS })
  if (!response.ok) {
    throw new Error(`Failed to fetch Instagram page: HTTP ${response.status}`)
  }

  const html = await response.text()

  // Try extraction strategies in order of quality
  const extracted =
    extractFromXdtApi(html) ||
    extractFromOgTags(html) ||
    extractFromJsonLd(html) ||
    extractFromSharedData(html)

  if (!extracted) {
    throw new Error(
      'Could not extract post data from Instagram page. The page structure may have changed.',
    )
  }

  return {
    postId: shortcode,
    caption: extracted.caption,
    mediaType: extracted.mediaType,
    mediaUrls: extracted.thumbnailUrl ? [extracted.thumbnailUrl] : [],
    thumbnailUrl: extracted.thumbnailUrl,
    permalink: url,
    timestamp: (extracted.takenAt as string) || new Date().toISOString(),
    author: extracted.username
      ? { username: extracted.username, id: (extracted.userId as string) || shortcode }
      : undefined,
    extractionMethod: extracted.extractionMethod,
  }
}

// ============================================================================
// Exports
// ============================================================================

const extractContentSchema = z.object({
  url: z.string(),
})

export const endpoints: Record<string, EndpointDefinition> = {
  'instagram/extract-content': {
    handler: extractContent,
    billing: { model: 'per_request', baseCost: 0.02, currency: 'USD' },
    schema: extractContentSchema,
  },
}
