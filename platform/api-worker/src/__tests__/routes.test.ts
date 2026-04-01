/**
 * Route-level integration tests for the API worker.
 * Uses SELF from cloudflare:test to make real HTTP requests against the worker.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { SELF } from 'cloudflare:test'
import { migrateTestDb, cleanTables } from './test-helpers'

describe('API routes', () => {
  beforeEach(async () => {
    await migrateTestDb()
    await cleanTables()
  })

  describe('GET /api/health', () => {
    it('returns 200 with status ok', async () => {
      const res = await SELF.fetch('https://fake-host/api/health')
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.status).toBe('ok')
      expect(body.service).toBe('deepspace-api')
      expect(body).toHaveProperty('timestamp')
    })
  })

  describe('GET /api/stripe/config', () => {
    it('returns 200 with Stripe config (public, no auth needed)', async () => {
      const res = await SELF.fetch('https://fake-host/api/stripe/config')
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body).toHaveProperty('enabled')
      expect(body).toHaveProperty('publishableKey')
      expect(body).toHaveProperty('priceIds')
    })
  })

  describe('auth-protected routes without token', () => {
    it('GET /api/users/me returns 401 without auth', async () => {
      const res = await SELF.fetch('https://fake-host/api/users/me')
      expect(res.status).toBe(401)
    })

    it('GET /api/stripe/credits-available returns 401 without auth', async () => {
      const res = await SELF.fetch('https://fake-host/api/stripe/credits-available')
      expect(res.status).toBe(401)
    })

    it('POST /api/stripe/create-checkout-session returns 401 without auth', async () => {
      const res = await SELF.fetch('https://fake-host/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: 'test' }),
      })
      expect(res.status).toBe(401)
    })

    it('POST /api/integrations/openai/chat-completion returns 401 without auth', async () => {
      const res = await SELF.fetch(
        'https://fake-host/api/integrations/openai/chat-completion',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [] }),
        },
      )
      expect(res.status).toBe(401)
    })
  })

  describe('404 for unknown routes', () => {
    it('returns 404 for nonexistent path', async () => {
      const res = await SELF.fetch('https://fake-host/api/nonexistent')
      expect(res.status).toBe(404)
    })
  })
})
