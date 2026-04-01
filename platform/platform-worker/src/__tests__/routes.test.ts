/**
 * Route-level integration tests for the platform worker.
 * Uses SELF from cloudflare:test to make real HTTP requests against the worker.
 *
 * These tests focus on routing, auth gating, and basic response shapes
 * without exercising Durable Object internals.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { SELF } from 'cloudflare:test'
import { signJwt, cleanRegistry } from './test-helpers'

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Platform worker routes', () => {
  // Clean R2 once before all tests in this file
  beforeAll(async () => {
    await cleanRegistry()
  })

  // ── Health ──────────────────────────────────────────────────────────────

  describe('GET /api/health', () => {
    it('returns 200 with status ok and service name', async () => {
      const res = await SELF.fetch('https://fake-host/api/health')
      expect(res.status).toBe(200)

      const body = (await res.json()) as Record<string, unknown>
      expect(body.status).toBe('ok')
      expect(body.service).toBe('deepspace-platform')
      expect(body).toHaveProperty('timestamp')
    })
  })

  // ── App Registry (public reads) ─────────────────────────────────────────

  describe('GET /api/app-registry', () => {
    it('returns a list (array) of app IDs', async () => {
      const res = await SELF.fetch('https://fake-host/api/app-registry')
      expect(res.status).toBe(200)

      const body = (await res.json()) as { apps: string[] }
      expect(Array.isArray(body.apps)).toBe(true)
    })
  })

  // ── App Registry (auth-protected writes) ────────────────────────────────

  describe('PUT /api/app-registry/:appId', () => {
    it('returns 401 without auth', async () => {
      const res = await SELF.fetch('https://fake-host/api/app-registry/test-app', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test App' }),
      })
      expect(res.status).toBe(401)

      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('Unauthorized')
    })
  })

  // ── WebSocket auth gating ──────────────────────────────────────────────

  describe('GET /ws/:scopeId', () => {
    it('returns 401 for app: scope without auth', async () => {
      const res = await SELF.fetch('https://fake-host/ws/app:test')
      expect(res.status).toBe(401)

      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('Authentication required for app scopes')
    })

    it('allows anonymous access for conv: scopes', async () => {
      // conv: scopes are routed to the RecordRoom DO without auth.
      // The stub DO returns 501 for non-WebSocket requests, which
      // confirms routing succeeded (we got past the auth check).
      const res = await SELF.fetch('https://fake-host/ws/conv:test-conv')
      // Consume body to ensure the DO response stream is fully read
      await res.text()
      // The stub RecordRoom returns 501 for non-WebSocket fetch
      expect(res.status).toBe(501)
    })
  })

  // ── Mux WebSocket auth gating ──────────────────────────────────────────

  describe('GET /mux/ws', () => {
    it('returns 401 without auth', async () => {
      const res = await SELF.fetch('https://fake-host/mux/ws')
      expect(res.status).toBe(401)

      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('Authentication required')
    })
  })

  // ── API passthrough ────────────────────────────────────────────────────

  describe('ALL /api/*', () => {
    it('returns 400 without scopeId query parameter', async () => {
      // Use a path that won't match more-specific /api/health or /api/app-registry routes
      const res = await SELF.fetch('https://fake-host/api/some-endpoint')
      expect(res.status).toBe(400)

      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('scopeId query parameter required')
    })

    it('returns 400 for POST without scopeId', async () => {
      const res = await SELF.fetch('https://fake-host/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'test' }),
      })
      expect(res.status).toBe(400)

      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('scopeId query parameter required')
    })
  })

  // ── Authenticated routes ───────────────────────────────────────────────

  describe('Authenticated requests', () => {
    it('PUT /api/app-registry/:appId succeeds with valid JWT', async () => {
      const token = await signJwt()
      const res = await SELF.fetch('https://fake-host/api/app-registry/routes-auth-test', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: 'Auth Test App', description: 'testing' }),
      })
      expect(res.status).toBe(200)

      const body = (await res.json()) as { success: boolean }
      expect(body.success).toBe(true)
    })

    it('GET /mux/ws with valid JWT but missing appId returns 400', async () => {
      const token = await signJwt()
      const res = await SELF.fetch('https://fake-host/mux/ws', {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(400)

      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('appId required')
    })
  })
})
