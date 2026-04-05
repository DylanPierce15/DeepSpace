import { describe, it, expect } from 'vitest'
import { ctx, env } from '../_test-helpers'
import { endpoints } from '.'

describe('Google', () => {
  // ---- Billing verification ----

  it('billing: has 10 endpoints', () => {
    expect(Object.keys(endpoints).length).toBe(10)
  })

  it('billing: all Google endpoints cost $0.01 per request', () => {
    for (const [key, def] of Object.entries(endpoints)) {
      expect(def.billing.baseCost, `${key} baseCost`).toBe(0.01)
      expect(def.billing.model, `${key} model`).toBe('per_request')
      expect(def.billing.currency, `${key} currency`).toBe('USD')
    }
  })

  it('billing: all handlers are functions', () => {
    for (const [key, def] of Object.entries(endpoints)) {
      expect(typeof def.handler, `${key} handler`).toBe('function')
    }
  })

  // ---- OAuth required when no accessToken ----

  const oauthEndpoints = [
    'google/gmail-send',
    'google/gmail-list',
    'google/gmail-get',
    'google/gmail-search',
    'google/calendar-list-events',
    'google/calendar-create-event',
    'google/calendar-delete-event',
    'google/drive-list',
    'google/drive-get',
    'google/contacts-list',
  ]

  for (const key of oauthEndpoints) {
    it(`${key}: returns requiresOAuth when no accessToken`, async () => {
      const result = (await endpoints[key].handler(env as any, {}, ctx)) as any
      expect(result.requiresOAuth).toBe(true)
      expect(result.provider).toBe('google')
      expect(Array.isArray(result.scopes)).toBe(true)
      expect(result.scopes.length).toBeGreaterThan(0)
    })
  }

  // ---- API tests skipped (require real OAuth tokens) ----

  it.skip('gmail-send: sends email (requires real OAuth token)', async () => {
    // Requires a real Google OAuth access token
  })

  it.skip('calendar-list-events: lists events (requires real OAuth token)', async () => {
    // Requires a real Google OAuth access token
  })

  it.skip('drive-list: lists files (requires real OAuth token)', async () => {
    // Requires a real Google OAuth access token
  })

  it.skip('contacts-list: lists contacts (requires real OAuth token)', async () => {
    // Requires a real Google OAuth access token
  })
})
