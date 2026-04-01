import { API_URL, PLATFORM_URL } from '../constants'

function getAuthHeader(request: Request): string | null {
  return request.headers.get('Authorization')
}

/** Proxy: user profile via JWT */
export async function handleProfile(request: Request): Promise<Response> {
  const auth = getAuthHeader(request)
  if (!auth) return Response.json({ error: 'No auth header' }, { status: 401 })
  const res = await fetch(`${API_URL}/api/users/me`, { headers: { Authorization: auth } })
  return new Response(res.body, { status: res.status, headers: res.headers })
}

/** Proxy: credits check via JWT */
export async function handleCredits(request: Request): Promise<Response> {
  const auth = getAuthHeader(request)
  if (!auth) return Response.json({ error: 'No auth header' }, { status: 401 })
  const res = await fetch(`${API_URL}/api/stripe/credits-available`, { headers: { Authorization: auth } })
  return new Response(res.body, { status: res.status, headers: res.headers })
}

/** Proxy: platform health */
export async function handlePlatformHealth(): Promise<Response> {
  const res = await fetch(`${PLATFORM_URL}/api/health`)
  return new Response(res.body, { status: res.status, headers: res.headers })
}

/** Proxy: app registry listing */
export async function handleAppRegistry(): Promise<Response> {
  const res = await fetch(`${PLATFORM_URL}/api/app-registry`)
  return new Response(res.body, { status: res.status, headers: res.headers })
}
