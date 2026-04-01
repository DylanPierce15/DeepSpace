/**
 * Integration tests for the auth worker.
 * Uses SELF from cloudflare:test to send real HTTP requests against the worker.
 *
 * These tests cover routes that can be verified without a fully-seeded
 * Better Auth database (health, CORS, 401 on unauthenticated token requests,
 * and 404 for unknown routes).
 */

import { describe, it, expect } from 'vitest'
import { SELF } from 'cloudflare:test'

describe('Auth worker', () => {
  // --------------------------------------------------------------------------
  // Health check
  // --------------------------------------------------------------------------

  describe('GET /health', () => {
    it('returns 200 with status ok', async () => {
      const res = await SELF.fetch('https://fake-host/health')
      expect(res.status).toBe(200)
      const body = (await res.json()) as any
      expect(body.status).toBe('ok')
      expect(body.service).toBe('deepspace-auth')
    })
  })

  // --------------------------------------------------------------------------
  // Token endpoint — unauthenticated
  // --------------------------------------------------------------------------

  describe('POST /api/auth/token', () => {
    it('rejects requests without a valid session cookie', async () => {
      const res = await SELF.fetch('https://fake-host/api/auth/token', {
        method: 'POST',
      })
      // Better Auth may return 401 (no session) or 500 (DB not migrated)
      // — either way, it must NOT return a token
      expect([401, 500]).toContain(res.status)
      const body = (await res.text())
      expect(body).not.toContain('"token"')
    })
  })

  // --------------------------------------------------------------------------
  // CORS
  // --------------------------------------------------------------------------

  describe('CORS headers', () => {
    it('reflects origin for *.app.space', async () => {
      const origin = 'https://myapp.app.space'
      const res = await SELF.fetch('https://fake-host/health', {
        headers: { Origin: origin },
      })
      expect(res.headers.get('access-control-allow-origin')).toBe(origin)
      expect(res.headers.get('access-control-allow-credentials')).toBe('true')
    })

    it('reflects origin for *.deep.space', async () => {
      const origin = 'https://console.deep.space'
      const res = await SELF.fetch('https://fake-host/health', {
        headers: { Origin: origin },
      })
      expect(res.headers.get('access-control-allow-origin')).toBe(origin)
    })

    it('reflects origin for localhost', async () => {
      const origin = 'http://localhost:3000'
      const res = await SELF.fetch('https://fake-host/health', {
        headers: { Origin: origin },
      })
      expect(res.headers.get('access-control-allow-origin')).toBe(origin)
    })

    it('returns wildcard for unrecognized origins', async () => {
      const origin = 'https://evil.example.com'
      const res = await SELF.fetch('https://fake-host/health', {
        headers: { Origin: origin },
      })
      expect(res.headers.get('access-control-allow-origin')).toBe('*')
    })

    it('handles preflight OPTIONS requests', async () => {
      const origin = 'https://dashboard.app.space'
      const res = await SELF.fetch('https://fake-host/api/auth/token', {
        method: 'OPTIONS',
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization, Cookie',
        },
      })
      // Hono CORS middleware returns 204 for preflight
      expect(res.status).toBe(204)
      expect(res.headers.get('access-control-allow-origin')).toBe(origin)
      expect(res.headers.get('access-control-allow-methods')).toContain('POST')
      expect(res.headers.get('access-control-allow-credentials')).toBe('true')
    })
  })

  // --------------------------------------------------------------------------
  // Unknown routes
  // --------------------------------------------------------------------------

  describe('Unknown routes', () => {
    it('returns 404 for nonexistent path', async () => {
      const res = await SELF.fetch('https://fake-host/api/nonexistent')
      expect(res.status).toBe(404)
    })

    it('returns 404 for GET on root path', async () => {
      const res = await SELF.fetch('https://fake-host/')
      expect(res.status).toBe(404)
    })
  })
})
