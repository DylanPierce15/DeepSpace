/**
 * Routing tests for the dispatch worker.
 *
 * Uses a mix of:
 * - Direct unit tests for exported helper functions (extractAppFromSubdomain,
 *   isRootDomain) since these encode the core routing logic
 * - SELF-based integration tests for HTTP-level behavior (redirects, 404s)
 *
 * Note: Workers for Platforms dispatch (USER_APPS binding) cannot be mocked
 * locally in vitest-pool-workers. Tests that reach the dispatch phase verify
 * the worker correctly resolves the app name and attempts dispatch (returning
 * 502 because the namespace is unavailable in tests), rather than returning 404.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { SELF, env } from 'cloudflare:test'
import {
  extractAppFromSubdomain,
  isRootDomain,
  RESERVED_SUBDOMAINS,
} from '../worker'

// ===========================================================================
// Unit tests: extractAppFromSubdomain
// ===========================================================================

describe('extractAppFromSubdomain', () => {
  it('extracts app name from a valid subdomain', () => {
    expect(extractAppFromSubdomain('myapp.app.space')).toBe('myapp')
  })

  it('extracts app name with hyphens', () => {
    expect(extractAppFromSubdomain('my-cool-app.app.space')).toBe('my-cool-app')
  })

  it('returns null for the root domain', () => {
    expect(extractAppFromSubdomain('app.space')).toBeNull()
  })

  it('returns null for www.app.space', () => {
    expect(extractAppFromSubdomain('www.app.space')).toBeNull()
  })

  it('returns null for reserved subdomains', () => {
    for (const reserved of RESERVED_SUBDOMAINS) {
      expect(extractAppFromSubdomain(`${reserved}.app.space`)).toBeNull()
    }
  })

  it('returns null for a completely different domain', () => {
    expect(extractAppFromSubdomain('example.com')).toBeNull()
  })

  it('returns null for a domain that only ends with app.space as substring', () => {
    expect(extractAppFromSubdomain('notapp.space')).toBeNull()
  })

  it('handles deeply nested subdomains (extracts first part)', () => {
    // e.g., deep.nested.app.space has parts.length >= 3, first part is "deep"
    expect(extractAppFromSubdomain('deep.nested.app.space')).toBe('deep')
  })
})

// ===========================================================================
// Unit tests: isRootDomain
// ===========================================================================

describe('isRootDomain', () => {
  it('returns true for app.space', () => {
    expect(isRootDomain('app.space')).toBe(true)
  })

  it('returns true for www.app.space', () => {
    expect(isRootDomain('www.app.space')).toBe(true)
  })

  it('returns false for a subdomain', () => {
    expect(isRootDomain('myapp.app.space')).toBe(false)
  })

  it('returns false for a different domain', () => {
    expect(isRootDomain('example.com')).toBe(false)
  })

  it('returns false for api.app.space', () => {
    expect(isRootDomain('api.app.space')).toBe(false)
  })
})

// ===========================================================================
// Integration tests: HTTP routing via SELF
// ===========================================================================

describe('Dispatch worker routing (HTTP)', () => {
  // -------------------------------------------------------------------------
  // Root domain redirects
  // -------------------------------------------------------------------------
  describe('root domain redirects', () => {
    it('redirects app.space to https://deep.space', async () => {
      const res = await SELF.fetch('https://app.space/', { redirect: 'manual' })
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('https://deep.space')
    })

    it('redirects www.app.space to https://deep.space', async () => {
      const res = await SELF.fetch('https://www.app.space/', { redirect: 'manual' })
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('https://deep.space')
    })

    it('redirects app.space with a path to https://deep.space', async () => {
      const res = await SELF.fetch('https://app.space/some/path', { redirect: 'manual' })
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('https://deep.space')
    })
  })

  // -------------------------------------------------------------------------
  // Reserved subdomain blocking
  // -------------------------------------------------------------------------
  describe('reserved subdomains', () => {
    const reserved = [
      'api', 'auth', 'console', 'platform', 'admin',
      'dashboard', 'mail', 'docs', 'blog', 'status',
      'cdn', 'assets', 'static', 'ws', 'wss',
    ]

    for (const sub of reserved) {
      it(`returns 404 for reserved subdomain: ${sub}.app.space`, async () => {
        const res = await SELF.fetch(`https://${sub}.app.space/`)
        expect(res.status).toBe(404)
        const body = await res.json() as any
        expect(body.error).toBe('App not found')
      })
    }
  })

  // -------------------------------------------------------------------------
  // Valid subdomain dispatch (reaches dispatch phase)
  // -------------------------------------------------------------------------
  describe('subdomain dispatch', () => {
    it('resolves a valid subdomain and attempts dispatch (502 in test env)', async () => {
      // The worker correctly extracts "test-app" from the subdomain and
      // tries to dispatch via USER_APPS. Since the dispatch namespace is
      // unavailable in the test environment, the catch block returns 502.
      // This proves the routing logic is correct (not 404 = app was found).
      const res = await SELF.fetch('https://test-app.app.space/')
      expect(res.status).toBe(502)
      const body = await res.json() as any
      expect(body.error).toBe('App unavailable')
    })

    it('resolves subdomain with path and attempts dispatch', async () => {
      const res = await SELF.fetch('https://test-app.app.space/hello/world')
      expect(res.status).toBe(502)
      const body = await res.json() as any
      expect(body.error).toBe('App unavailable')
    })

    it('resolves subdomain for POST request and attempts dispatch', async () => {
      const res = await SELF.fetch('https://test-app.app.space/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'value' }),
      })
      expect(res.status).toBe(502)
      const body = await res.json() as any
      expect(body.error).toBe('App unavailable')
    })
  })

  // -------------------------------------------------------------------------
  // Custom domain routing via HOSTNAME_MAP KV
  // -------------------------------------------------------------------------
  describe('custom domain routing', () => {
    beforeEach(async () => {
      await env.HOSTNAME_MAP.put('mysite.example.com', 'custom-domain-app')
    })

    it('resolves custom domain via KV and attempts dispatch (502 in test env)', async () => {
      // The HOSTNAME_MAP lookup succeeds (returns "custom-domain-app"),
      // then dispatch fails because USER_APPS is unavailable. Getting 502
      // (not 404) proves the KV lookup path works correctly.
      const res = await SELF.fetch('https://mysite.example.com/')
      expect(res.status).toBe(502)
      const body = await res.json() as any
      expect(body.error).toBe('App unavailable')
    })

    it('resolves custom domain with path via KV and attempts dispatch', async () => {
      const res = await SELF.fetch('https://mysite.example.com/dashboard')
      expect(res.status).toBe(502)
      const body = await res.json() as any
      expect(body.error).toBe('App unavailable')
    })
  })

  // -------------------------------------------------------------------------
  // Unknown hostname
  // -------------------------------------------------------------------------
  describe('unknown hostname', () => {
    it('returns 404 for an unknown hostname not in KV', async () => {
      const res = await SELF.fetch('https://unknown-host.example.com/')
      expect(res.status).toBe(404)
      const body = await res.json() as any
      expect(body.error).toBe('App not found')
    })

    it('returns error for an unknown subdomain with no matching dispatch worker', async () => {
      // "nonexistent" is not a reserved subdomain, so the worker extracts it
      // and tries to dispatch. This returns 502 (dispatch fails) not 404.
      const res = await SELF.fetch('https://nonexistent.app.space/')
      expect(res.status).toBe(502)
      const body = await res.json() as any
      expect(body.error).toBe('App unavailable')
    })
  })
})
