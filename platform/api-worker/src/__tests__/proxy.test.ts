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
  })

  // ========================================================================
  // X-Billing-User-Id header
  // ========================================================================

  describe('billing user override', () => {
    it.skipIf(!hasRealKey('ANTHROPIC_API_KEY'))(
      'charges the X-Billing-User-Id user instead of the caller',
      async () => {
        // Create two users: caller and billing target
        const db = getDb()
        const now = new Date()
        await db.insert(userProfiles).values([
          {
            id: 'caller-user',
            subscriptionTier: 'starter',
            subscriptionCredits: 1600,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'billing-target-user',
            subscriptionTier: 'premium',
            subscriptionCredits: 4250,
            createdAt: now,
            updatedAt: now,
          },
        ])

        const token = await signTestJwt('caller-user')
        await SELF.fetch('https://fake-host/api/proxy/anthropic/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'X-Billing-User-Id': 'billing-target-user',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Say "hello" and nothing else.' }],
          }),
        })

        // Usage should be recorded against billing-target-user
        const rows = await db
          .select()
          .from(integrationUsage)
          .where(eq(integrationUsage.userId, 'billing-target-user'))

        expect(rows.length).toBeGreaterThanOrEqual(1)
        expect(rows[0].callerUserId).toBe('caller-user')
      },
      30_000,
    )
  })
})
