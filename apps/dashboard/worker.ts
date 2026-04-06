/**
 * Dashboard worker — serves static assets and proxies API calls to platform workers
 * via service bindings. Handles OAuth flow with code exchange pattern (same as user apps).
 */

interface Env {
  ASSETS: Fetcher
  AUTH_WORKER: Fetcher
  API_WORKER: Fetcher
  DEPLOY_WORKER: Fetcher
  AUTH_WORKER_URL: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const { pathname } = url

    // ── OAuth redirect → auth worker's /login/social ──────────────
    if (pathname === '/api/auth/social-redirect') {
      const provider = url.searchParams.get('provider')
      if (!provider) {
        return new Response(JSON.stringify({ error: 'Missing provider' }), { status: 400 })
      }
      const authOrigin = new URL(env.AUTH_WORKER_URL).origin
      const appOrigin = url.origin
      return Response.redirect(
        `${authOrigin}/login/social?provider=${encodeURIComponent(provider)}&returnTo=${encodeURIComponent(appOrigin)}`,
        302,
      )
    }

    // ── OAuth complete — exchange code for session cookie ─────────
    if (pathname === '/api/auth/oauth-complete') {
      const code = url.searchParams.get('code')
      if (!code) {
        return Response.redirect(url.origin, 302)
      }

      // Exchange code for session token via auth-worker service binding
      const exchangeRes = await env.AUTH_WORKER.fetch(
        new Request(`${url.origin}/api/auth/exchange-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        }),
      )

      if (!exchangeRes.ok) {
        return Response.redirect(url.origin, 302)
      }

      const { sessionToken } = (await exchangeRes.json()) as { sessionToken: string }

      return new Response(null, {
        status: 302,
        headers: {
          Location: url.origin,
          'Set-Cookie': `__Secure-better-auth.session_token=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`,
        },
      })
    }

    // ── Sign out — clear session cookie directly ───────────────────
    if (pathname === '/api/auth/sign-out') {
      // Invalidate session on the auth-worker (best-effort), then clear cookie
      try { await env.AUTH_WORKER.fetch(request) } catch {}
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': '__Secure-better-auth.session_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
        },
      })
    }

    // ── API proxying via service bindings ─────────────────────────
    if (pathname.startsWith('/api/auth')) return env.AUTH_WORKER.fetch(request)
    if (pathname.startsWith('/api/apps')) return env.DEPLOY_WORKER.fetch(request)
    if (pathname.startsWith('/api/deploy')) return env.DEPLOY_WORKER.fetch(request)
    if (pathname.startsWith('/api/users')) return env.API_WORKER.fetch(request)
    if (pathname.startsWith('/api/usage')) return env.API_WORKER.fetch(request)
    if (pathname.startsWith('/api/stripe')) return env.API_WORKER.fetch(request)

    // ── Static assets (SPA fallback) ─────────────────────────────
    return env.ASSETS.fetch(request)
  },
}
