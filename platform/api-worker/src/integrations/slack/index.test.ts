import { describe, it, expect } from 'vitest'
import { ctx, env } from '../_test-helpers'
import { endpoints } from '.'

describe('Slack', () => {
  // ---- Billing verification ----

  it('billing: has 4 endpoints', () => {
    expect(Object.keys(endpoints).length).toBe(4)
  })

  it('billing: read endpoints cost $0.001', () => {
    for (const key of ['slack/list-channels', 'slack/channel-history', 'slack/team-info']) {
      expect(endpoints[key].billing.baseCost, `${key} baseCost`).toBe(0.001)
      expect(endpoints[key].billing.model, `${key} model`).toBe('per_request')
      expect(endpoints[key].billing.currency, `${key} currency`).toBe('USD')
    }
  })

  it('billing: send-message costs $0.01', () => {
    expect(endpoints['slack/send-message'].billing.baseCost).toBe(0.01)
    expect(endpoints['slack/send-message'].billing.model).toBe('per_request')
    expect(endpoints['slack/send-message'].billing.currency).toBe('USD')
  })

  it('billing: all handlers are functions', () => {
    for (const [key, def] of Object.entries(endpoints)) {
      expect(typeof def.handler, `${key} handler`).toBe('function')
    }
  })

  // ---- OAuth required when no accessToken ----

  const oauthEndpoints = [
    'slack/list-channels',
    'slack/send-message',
    'slack/channel-history',
    'slack/team-info',
  ]

  for (const key of oauthEndpoints) {
    it(`${key}: returns requiresOAuth when no accessToken`, async () => {
      const result = (await endpoints[key].handler(env as any, {}, ctx)) as any
      expect(result.requiresOAuth).toBe(true)
      expect(result.provider).toBe('slack')
      expect(Array.isArray(result.scopes)).toBe(true)
      expect(result.scopes.length).toBeGreaterThan(0)
    })
  }

  // ---- API tests skipped (require real OAuth tokens) ----

  it.skip('list-channels: lists channels (requires real OAuth token)', async () => {
    // Requires a real Slack OAuth access token
  })

  it.skip('send-message: sends message (requires real OAuth token)', async () => {
    // Requires a real Slack OAuth access token
  })

  it.skip('channel-history: gets history (requires real OAuth token)', async () => {
    // Requires a real Slack OAuth access token
  })

  it.skip('team-info: gets team info (requires real OAuth token)', async () => {
    // Requires a real Slack OAuth access token
  })
})
