/**
 * LinkedIn integration -- profile search via SerpAPI.
 * Ported from Miyagi3 LinkedInService.ts.
 *
 * Endpoints:
 * - search-profiles: Search LinkedIn profiles by name, company, title, education, location
 * - analyze-profile-url: Look up a LinkedIn profile URL via SerpAPI and return enriched data
 *
 * Note: The Miyagi3 service also had analyze-profiles and generate-messages endpoints
 * that used an LLM (TextGenerationService). Those are omitted here since LLM calls
 * should go through the openai/anthropic integrations directly. This integration
 * focuses on the SerpAPI-powered data retrieval.
 */

import type { IntegrationHandler, EndpointDefinition } from '../_types'

// ============================================================================
// Types
// ============================================================================

interface LinkedInProfile {
  id: string
  name: string
  headline: string
  location: string
  company: string
  profileUrl: string
  imageUrl: string | null
  summary: string
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parse a SerpAPI organic result into a LinkedInProfile.
 */
function parseProfileResult(result: any): LinkedInProfile | null {
  if (!result.link?.includes('linkedin.com/in/')) return null

  try {
    const profileId =
      result.link.match(/linkedin\.com\/in\/([^\/\?]+)/)?.[1] || result.link

    return {
      id: profileId,
      name: result.title?.replace(/ - LinkedIn.*/i, '') || 'Unknown',
      headline: result.snippet?.split('\u00b7')[0]?.trim() || '',
      location: result.snippet?.split('\u00b7')[1]?.trim() || '',
      company: result.snippet?.split('\u00b7')[2]?.trim() || '',
      profileUrl: result.link,
      imageUrl: result.thumbnail || null,
      summary: result.snippet || '',
    }
  } catch {
    return null
  }
}

// ============================================================================
// search-profiles
// ============================================================================

const searchProfiles: IntegrationHandler = async (env, body) => {
  if (!env.SERPAPI_API_KEY) throw new Error('SERPAPI_API_KEY not configured')

  const searchTerms: string[] = []
  if (body.name) searchTerms.push(String(body.name))
  if (body.company) searchTerms.push(String(body.company))
  if (body.title) searchTerms.push(String(body.title))
  if (body.education) searchTerms.push(String(body.education))

  if (searchTerms.length === 0) {
    throw new Error('At least one search term (name, company, title, or education) is required')
  }

  const baseQuery = `site:linkedin.com/in ${searchTerms.join(' ')}`

  const page = Math.max(1, Math.floor(Number(body.page) || 1))

  const params = new URLSearchParams({
    engine: 'google',
    q: baseQuery,
    hl: 'en',
    api_key: env.SERPAPI_API_KEY,
    num: '10',
    start: String((page - 1) * 10),
  })

  if (body.location) params.set('location', String(body.location))

  const response = await fetch(`https://serpapi.com/search.json?${params}`)

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`SerpAPI error ${response.status}: ${errorText}`)
  }

  const data: any = await response.json()

  const profiles: LinkedInProfile[] = (data.organic_results || [])
    .map(parseProfileResult)
    .filter(Boolean)

  return { profiles, total: profiles.length, page }
}

// ============================================================================
// analyze-profile-url
// ============================================================================

const analyzeProfileUrl: IntegrationHandler = async (env, body) => {
  if (!env.SERPAPI_API_KEY) throw new Error('SERPAPI_API_KEY not configured')

  const profileUrl = body.profileUrl as string
  if (!profileUrl?.includes('linkedin.com/in/')) {
    throw new Error('Invalid LinkedIn profile URL')
  }

  const username = profileUrl.match(/linkedin\.com\/in\/([^\/\?]+)/)?.[1]
  if (!username) {
    throw new Error('Could not extract username from LinkedIn URL')
  }

  const params = new URLSearchParams({
    engine: 'google',
    q: profileUrl,
    hl: 'en',
    api_key: env.SERPAPI_API_KEY,
    num: '5',
  })

  const response = await fetch(`https://serpapi.com/search.json?${params}`)

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`SerpAPI error ${response.status}: ${errorText}`)
  }

  const data: any = await response.json()
  const results = data.organic_results || []

  // Find the best matching result for this profile
  const best =
    results.find(
      (r: any) =>
        r.link?.includes('linkedin.com/in/') &&
        (r.link.includes(username) || r.link === profileUrl),
    ) || results[0]

  const profile: LinkedInProfile | null = best
    ? parseProfileResult(best) || {
        id: username,
        name: best.title?.replace(/ - LinkedIn.*/i, '') || username,
        headline: best.snippet?.split('\u00b7')[0]?.trim() || '',
        location: '',
        company: '',
        profileUrl,
        imageUrl: best.thumbnail || null,
        summary: best.snippet || '',
      }
    : {
        id: username,
        name: username,
        headline: '',
        location: '',
        company: '',
        profileUrl,
        imageUrl: null,
        summary: '',
      }

  return { profile }
}

// ============================================================================
// Exports
// ============================================================================

export const endpoints: Record<string, EndpointDefinition> = {
  'linkedin/search-profiles': {
    handler: searchProfiles,
    billing: { model: 'per_request', baseCost: 0.02, currency: 'USD' },
  },
  'linkedin/analyze-profile-url': {
    handler: analyzeProfileUrl,
    billing: { model: 'per_request', baseCost: 0.05, currency: 'USD' },
  },
}
