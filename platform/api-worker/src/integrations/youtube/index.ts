/**
 * YouTube integration — search, video details, trending.
 * Ported from Miyagi3 YouTubeService.ts.
 */

import { z } from 'zod'
import type { IntegrationHandler, EndpointDefinition } from '../_types'

const HEADERS = { 'User-Agent': 'DeepSpace-YouTube/1.0' }

function formatNumber(num: number): string {
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B'
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M'
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K'
  return num.toString()
}

function formatDuration(duration: string): string {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return duration
  const h = parseInt(match[1] || '0')
  const m = parseInt(match[2] || '0')
  const s = parseInt(match[3] || '0')
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`
}

function addVideoLinks(items: any[]): any[] {
  return items.map((item: any) => {
    const videoId = item.id?.videoId || item.id
    if (!videoId) return item
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`
    const embedUrl = `https://www.youtube.com/embed/${videoId}`
    return {
      ...item,
      links: { watch: watchUrl, embed: embedUrl, thumbnail: item.snippet?.thumbnails?.medium?.url },
      embedHtml: `<iframe width="560" height="315" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>`,
      markdownLink: `[${item.snippet?.title || 'YouTube Video'}](${watchUrl})`,
      ...(item.statistics?.viewCount ? { formatted: { views: formatNumber(parseInt(item.statistics.viewCount)) } } : {}),
      ...(item.contentDetails?.duration ? { formatted: { ...((item as any).formatted || {}), duration: formatDuration(item.contentDetails.duration) } } : {}),
    }
  })
}

async function youtubeGet(apiKey: string, url: string, params: URLSearchParams): Promise<any[]> {
  params.append('key', apiKey)
  const response = await fetch(`${url}?${params}`, { headers: HEADERS })
  if (!response.ok) throw new Error(`YouTube API error ${response.status}: ${await response.text()}`)
  const data: any = await response.json()
  if (data.error) throw new Error(`YouTube API error: ${data.error.message}`)
  return addVideoLinks(data.items || [])
}

const searchVideos: IntegrationHandler = async (env, body) => {
  if (!env.YOUTUBE_API_KEY) throw new Error('YOUTUBE_API_KEY not configured')
  if (!body.q) throw new Error('Search query (q) is required')

  const params = new URLSearchParams({ part: 'snippet', type: 'video', q: String(body.q) })
  if (body.order) params.append('order', String(body.order))
  if (body.maxResults) params.append('maxResults', String(body.maxResults))
  if (body.regionCode) params.append('regionCode', String(body.regionCode))
  if (body.publishedAfter) params.append('publishedAfter', String(body.publishedAfter))
  if (body.publishedBefore) params.append('publishedBefore', String(body.publishedBefore))

  const videos = await youtubeGet(env.YOUTUBE_API_KEY, 'https://www.googleapis.com/youtube/v3/search', params)
  return { videos, totalResults: videos.length }
}

const getVideoDetails: IntegrationHandler = async (env, body) => {
  if (!env.YOUTUBE_API_KEY) throw new Error('YOUTUBE_API_KEY not configured')
  if (!body.id) throw new Error('Video ID is required')

  const params = new URLSearchParams({ part: 'snippet,statistics,contentDetails', id: String(body.id) })
  const videos = await youtubeGet(env.YOUTUBE_API_KEY, 'https://www.googleapis.com/youtube/v3/videos', params)
  return { videos }
}

const getTrendingVideos: IntegrationHandler = async (env, body) => {
  if (!env.YOUTUBE_API_KEY) throw new Error('YOUTUBE_API_KEY not configured')

  const params = new URLSearchParams({ part: 'snippet,statistics', chart: 'mostPopular' })
  if (body.regionCode) params.append('regionCode', String(body.regionCode))
  if (body.maxResults) params.append('maxResults', String(body.maxResults))

  const videos = await youtubeGet(env.YOUTUBE_API_KEY, 'https://www.googleapis.com/youtube/v3/videos', params)
  return { videos, totalResults: videos.length }
}

const searchVideosSchema = z.object({
  q: z.string(),
  order: z.string().optional(),
  maxResults: z.number().min(1).max(50).optional(),
  regionCode: z.string().optional(),
  publishedAfter: z.string().optional(),
  publishedBefore: z.string().optional(),
})

const getVideoDetailsSchema = z.object({
  id: z.string(),
})

const getTrendingVideosSchema = z.object({
  regionCode: z.string().optional(),
  maxResults: z.number().min(1).max(50).optional(),
})

export const endpoints: Record<string, EndpointDefinition> = {
  'youtube/search-videos':      { handler: searchVideos,      billing: { model: 'per_request', baseCost: 0.01, currency: 'USD' }, schema: searchVideosSchema },
  'youtube/get-video-details':  { handler: getVideoDetails,   billing: { model: 'per_request', baseCost: 0.005, currency: 'USD' }, schema: getVideoDetailsSchema },
  'youtube/get-trending-videos': { handler: getTrendingVideos, billing: { model: 'per_request', baseCost: 0.01, currency: 'USD' }, schema: getTrendingVideosSchema },
}
