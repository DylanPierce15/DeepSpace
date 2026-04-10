/**
 * Tests for AI proxy routes (/api/proxy/anthropic/*, /api/proxy/openai/*).
 *
 * Tests auth gating, credit checks, request forwarding, and billing recording.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { userProfiles, integrationUsage } from '../db/schema'
import { migrateTestDb, cleanTables, authedFetch, signTestJwt } from './test-helpers'
import { hasRealKey } from '../integrations/_test-helpers'

function getDb() {
  return drizzle(env.BILLING_DB)
}

async function insertProfile(overrides: Partial<typeof userProfiles.$inferInsert> = {}) {
  const db = getDb()
  const now = new Date()
  await db.insert(userProfiles).values({
    id: 'proxy-test-user',
    subscriptionTier: 'starter',
    subscriptionCredits: 1600,
    purchasedCredits: 0,
    bonusCreditsRemaining: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  })
}

describe('AI proxy routes', () => {
  beforeEach(async () => {
    await migrateTestDb()
    await cleanTables()
  })

  // ========================================================================
  // Auth gating
  // ========================================================================

  describe('auth', () => {
    it('POST /api/proxy/anthropic/v1/messages returns 401 without auth', async () => {
      const res = await SELF.fetch('https://fake-host/api/proxy/anthropic/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 10, messages: [] }),
      })
      expect(res.status).toBe(401)
    })

    it('POST /api/proxy/openai/v1/chat/completions returns 401 without auth', async () => {
      const res = await SELF.fetch('https://fake-host/api/proxy/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o', messages: [] }),
      })
      expect(res.status).toBe(401)
    })
  })

  // ========================================================================
  // X-Auth-Token alternative auth (for AI SDK calls)
  // ========================================================================

  describe('X-Auth-Token auth', () => {
    it('accepts JWT via X-Auth-Token header instead of Authorization', async () => {
      await insertProfile()
      const token = await signTestJwt('proxy-test-user')

      // Send JWT as X-Auth-Token (no Authorization header)
      // With fake API key this will get an upstream error, but NOT a 401 from our proxy
      const res = await SELF.fetch('https://fake-host/api/proxy/anthropic/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
          'x-api-key': 'platform-managed',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      })

      // Should NOT be 401 (our proxy accepted the auth).
      // It will be 402 (no credits) or an upstream error depending on credit state.
      expect(res.status).not.toBe(401)
    })

    it('returns 401 when X-Auth-Token contains an invalid JWT', async () => {
      const res = await SELF.fetch('https://fake-host/api/proxy/anthropic/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': 'invalid-token',
        },
        body: JSON.stringify({ messages: [] }),
      })
      expect(res.status).toBe(401)
    })
  })

  // ========================================================================
  // Credit gating
  // ========================================================================

  describe('credit check', () => {
    it('returns 402 when user has 0 credits', async () => {
      await insertProfile({
        subscriptionCredits: 0,
        purchasedCredits: 0,
        bonusCreditsRemaining: 0,
      })

      const res = await authedFetch(
        '/api/proxy/anthropic/v1/messages',
        'proxy-test-user',
        {
          method: 'POST',
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'hi' }],
          }),
        },
      )
      expect(res.status).toBe(402)
      const body = await res.json() as any
      expect(body.error).toMatch(/Insufficient credits/i)
    })

    it('rejects when credits cover < estimated worst-case cost', async () => {
      // 1 credit ≈ $0.01. Sonnet output is $0.000015/tok with 1.3x markup.
      // A request with max_tokens=100000 worst-cases at:
      //   100_000 * 0.000015 * 1.3 ≈ $1.95 ≈ 195 credits
      // A user with only 5 credits should be rejected before any upstream call.
      await insertProfile({
        subscriptionCredits: 5,
        purchasedCredits: 0,
        bonusCreditsRemaining: 0,
      })

      const res = await authedFetch(
        '/api/proxy/anthropic/v1/messages',
        'proxy-test-user',
        {
          method: 'POST',
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 100_000,
            messages: [{ role: 'user', content: 'hi' }],
          }),
        },
      )
      expect(res.status).toBe(402)
      const body = await res.json() as { error: string; required: number; available: number }
      expect(body.error).toMatch(/Insufficient credits/i)
      expect(body.available).toBe(5)
      expect(body.required).toBeGreaterThan(5)
    })

    it('rejects X-Billing-User-Id from an end-user JWT (abuse vector)', async () => {
      // A signed-in "attacker" with zero credits must not be able to charge
      // another user by setting X-Billing-User-Id. Only internal/service
      // callers (HMAC-signed or service binding) may override the billing
      // subject.
      const db = getDb()
      const now = new Date()
      await db.insert(userProfiles).values([
        {
          id: 'attacker',
          subscriptionTier: 'free',
          subscriptionCredits: 0,
          purchasedCredits: 0,
          bonusCreditsRemaining: 0,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'victim',
          subscriptionTier: 'premium',
          subscriptionCredits: 4250,
          createdAt: now,
          updatedAt: now,
        },
      ])

      const token = await signTestJwt('attacker')
      const res = await SELF.fetch('https://fake-host/api/proxy/anthropic/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Billing-User-Id': 'victim',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      })

      // Attacker is broke, so if the header is ignored they hit the 402 gate.
      // If the header were honored, they'd pass the gate and hit upstream.
      expect(res.status).toBe(402)

      // And no usage row should be attributed to the victim.
      const rows = await db
        .select()
        .from(integrationUsage)
        .where(eq(integrationUsage.userId, 'victim'))
      expect(rows.length).toBe(0)
    })
  })

  // ========================================================================
  // Request forwarding (requires real API keys)
  // ========================================================================

  describe('Anthropic proxy', () => {
    it.skipIf(!hasRealKey('ANTHROPIC_API_KEY'))(
      'forwards request and returns a valid response',
      async () => {
        await insertProfile()

        const res = await authedFetch(
          '/api/proxy/anthropic/v1/messages',
          'proxy-test-user',
          {
            method: 'POST',
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 10,
              messages: [{ role: 'user', content: 'Say "hello" and nothing else.' }],
            }),
          },
        )

        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body).toHaveProperty('content')
        expect(body).toHaveProperty('usage')
        expect(body.usage.input_tokens).toBeGreaterThan(0)
      },
      30_000,
    )

    it.skipIf(!hasRealKey('ANTHROPIC_API_KEY'))(
      'records billing usage after a successful proxy call',
      async () => {
        await insertProfile()

        await authedFetch(
          '/api/proxy/anthropic/v1/messages',
          'proxy-test-user',
          {
            method: 'POST',
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 10,
              messages: [{ role: 'user', content: 'Say "hello" and nothing else.' }],
            }),
          },
        )

        // Check integration_usage table for a billing record
        const db = getDb()
        const rows = await db
          .select()
          .from(integrationUsage)
          .where(eq(integrationUsage.userId, 'proxy-test-user'))

        expect(rows.length).toBeGreaterThanOrEqual(1)
        const record = rows[0]
        expect(record.integrationName).toBe('anthropic')
        expect(record.endpoint).toBe('proxy')
        expect(record.status).toBe('completed')
        expect(parseFloat(record.totalCost)).toBeGreaterThan(0)
      },
      30_000,
    )

    it.skipIf(!hasRealKey('ANTHROPIC_API_KEY'))(
      'forwards streaming response',
      async () => {
        await insertProfile()

        const res = await authedFetch(
          '/api/proxy/anthropic/v1/messages',
          'proxy-test-user',
          {
            method: 'POST',
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 10,
              stream: true,
              messages: [{ role: 'user', content: 'Say "hello" and nothing else.' }],
            }),
          },
        )

        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toContain('text/event-stream')

        // Read the full stream
        const text = await res.text()
        expect(text).toContain('event:')
        expect(text).toContain('message_start')
      },
      30_000,
    )
  })

  describe('OpenAI proxy', () => {
    it.skipIf(!hasRealKey('OPENAI_API_KEY'))(
      'forwards request and returns a valid response',
      async () => {
        await insertProfile()

        const res = await authedFetch(
          '/api/proxy/openai/v1/chat/completions',
          'proxy-test-user',
          {
            method: 'POST',
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              max_tokens: 10,
              messages: [{ role: 'user', content: 'Say "hello" and nothing else.' }],
            }),
          },
        )

        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body).toHaveProperty('choices')
        expect(body).toHaveProperty('usage')
        expect(body.usage.prompt_tokens).toBeGreaterThan(0)
      },
      30_000,
    )

    it.skipIf(!hasRealKey('OPENAI_API_KEY'))(
      'records billing usage after a successful proxy call',
      async () => {
        await insertProfile()

        await authedFetch(
          '/api/proxy/openai/v1/chat/completions',
          'proxy-test-user',
          {
            method: 'POST',
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              max_tokens: 10,
              messages: [{ role: 'user', content: 'Say "hello" and nothing else.' }],
            }),
          },
        )

        const db = getDb()
        const rows = await db
          .select()
          .from(integrationUsage)
          .where(eq(integrationUsage.userId, 'proxy-test-user'))

        expect(rows.length).toBeGreaterThanOrEqual(1)
        const record = rows[0]
        expect(record.integrationName).toBe('openai')
        expect(record.endpoint).toBe('proxy')
        expect(record.status).toBe('completed')
        expect(parseFloat(record.totalCost)).toBeGreaterThan(0)
      },
      30_000,
    )
  })

  // ========================================================================
  // Forwarding with fake keys (no real API key needed)
  // ========================================================================

  describe('error forwarding', () => {
    it('forwards upstream auth errors unchanged', async () => {
      await insertProfile()

      // With fake API key, upstream returns 401
      const res = await authedFetch(
        '/api/proxy/anthropic/v1/messages',
        'proxy-test-user',
        {
          method: 'POST',
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'test' }],
          }),
        },
      )

      // Should be an error from upstream (401 from Anthropic with fake key)
      if (!hasRealKey('ANTHROPIC_API_KEY')) {
        expect(res.status).toBeGreaterThanOrEqual(400)
      }
    })

    it('strips content-encoding and content-length from forwarded responses', async () => {
      // Cloudflare auto-decodes upstream gzip/br, so the upstream
      // content-encoding header would no longer match the body bytes we
      // re-emit. Returning it would make clients fail to decode plain text.
      // content-length is similarly stale after we read & re-emit the body.
      await insertProfile()
      const res = await authedFetch(
        '/api/proxy/anthropic/v1/messages',
        'proxy-test-user',
        {
          method: 'POST',
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'test' }],
          }),
        },
      )

      expect(res.headers.get('content-encoding')).toBeNull()
      // content-length may be re-set by the runtime; if present it must match
      // the actual decoded body length, not whatever upstream said.
      const len = res.headers.get('content-length')
      if (len !== null) {
        const body = await res.clone().text()
        expect(parseInt(len, 10)).toBe(new TextEncoder().encode(body).length)
      }
    })
  })

  // ========================================================================
  // Billing always uses the JWT subject — X-Billing-User-Id is NOT honored.
  // To bill a different user (e.g. the app owner for autonomous server-side
  // calls), use a JWT whose subject is that user (e.g. APP_OWNER_JWT).
  // ========================================================================
})
