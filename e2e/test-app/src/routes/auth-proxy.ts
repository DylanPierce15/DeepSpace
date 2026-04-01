import { AUTH_URL } from '../constants'

/** Proxy: check session via Better Auth */
export async function handleAuthCheck(request: Request): Promise<Response> {
  const cookie = request.headers.get('Cookie') ?? ''
  const res = await fetch(`${AUTH_URL}/api/auth/get-session`, {
    headers: { Cookie: cookie, Origin: AUTH_URL },
  })
  const session = await res.json()
  return Response.json({ authenticated: res.ok, session })
}

/** Proxy: get JWT from session cookie */
export async function handleGetToken(request: Request): Promise<Response> {
  const cookie = request.headers.get('Cookie') ?? ''
  const res = await fetch(`${AUTH_URL}/api/auth/token`, {
    method: 'POST',
    headers: { Cookie: cookie, Origin: AUTH_URL },
  })
  return new Response(res.body, { status: res.status, headers: res.headers })
}
