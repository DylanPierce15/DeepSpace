/**
 * E2E test app — deployed via WfP to deepspace-sdk-test.app.space.
 *
 * Tests the full DeepSpace SDK stack:
 * - WfP dispatch routing
 * - Auth (session + JWT proxying)
 * - API worker (profile, credits)
 * - Platform worker (health, app registry)
 * - HTML serving
 */

import { handleHealth, handleEcho, handleMeta } from './routes/health'
import { handleAuthCheck, handleGetToken } from './routes/auth-proxy'
import {
  handleProfile,
  handleCredits,
  handlePlatformHealth,
  handleAppRegistry,
} from './routes/api-proxy'
import { indexPage } from './pages/index'

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const { pathname } = url

    // ── API routes ──────────────────────────────────────────
    if (pathname === '/api/health') return handleHealth()
    if (pathname === '/api/echo') return handleEcho(request)
    if (pathname === '/api/meta') return handleMeta(url)

    // Auth proxies
    if (pathname === '/api/auth-check') return handleAuthCheck(request)
    if (pathname === '/api/get-token' && request.method === 'POST') return handleGetToken(request)

    // API worker proxies
    if (pathname === '/api/profile') return handleProfile(request)
    if (pathname === '/api/credits') return handleCredits(request)

    // Platform worker proxies
    if (pathname === '/api/platform-health') return handlePlatformHealth()
    if (pathname === '/api/app-registry') return handleAppRegistry()

    // ── HTML ────────────────────────────────────────────────
    if (pathname === '/' || pathname === '/index.html') {
      return new Response(indexPage, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    return new Response('Not found', { status: 404 })
  },
}
