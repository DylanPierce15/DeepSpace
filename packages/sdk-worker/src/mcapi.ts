/**
 * McAPI Proxy - forwards requests to the DeepSpace backend API.
 * 
 * IMPORTANT: Environment-specific routing rules:
 * 
 * - Deployed sites (miniapps): Do NOT pass apiBaseUrl. Deployed miniapps
 *   ALWAYS go to production (https://api.deep.space), regardless of where
 *   they were created or deployed from. This is intentional.
 * 
 * @param apiBaseUrl - Optional. If provided, uses this URL. If omitted,
 *                     falls back to production API (for deployed sites).
 */

const PRODUCTION_API = 'https://api.deep.space'

export async function handleMcAPIProxy(request: Request, url: URL, apiBaseUrl?: string): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  // Deployed sites (miniapps) don't pass apiBaseUrl → always use production
  const effectiveApiUrl = apiBaseUrl || PRODUCTION_API

  const endpoint = url.pathname.replace('/api/mcapi/', '')
  if (!endpoint) {
    return Response.json({ error: 'Missing endpoint' }, { status: 400 })
  }

  const targetUrl = `${effectiveApiUrl.replace(/\/+$/, '')}/api/integrations/${endpoint}${url.search}`

  const headers = new Headers()
  const authHeader = request.headers.get('Authorization')
  if (authHeader) headers.set('Authorization', authHeader)
  const contentType = request.headers.get('Content-Type')
  if (contentType) headers.set('Content-Type', contentType)

  try {
    const body = request.method !== 'GET' && request.method !== 'HEAD' 
      ? await request.text() 
      : undefined

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
    })

    const responseHeaders = new Headers(response.headers)
    responseHeaders.set('Access-Control-Allow-Origin', '*')

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('McAPI proxy error:', error)
    return Response.json(
      { error: 'Failed to proxy request' },
      { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }
}

