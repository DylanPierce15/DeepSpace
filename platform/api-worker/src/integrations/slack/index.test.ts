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

  // ---- accessToken required ----

  const tokenRequiredEndpoints = [
    'slack/list-channels',
    'slack/send-message',
    'slack/channel-history',
    'slack/team-info',
  ]

  for (const key of tokenRequiredEndpoints) {
    it(`${key}: throws when no accessToken`, async () => {
      await expect(endpoints[key].handler(env as any, {}, ctx)).rejects.toThrow(
        'accessToken is required',
      )
    })
  }

  // ---- API tests skipped (require real access tokens) ----

  it.skip('list-channels: lists channels (requires real access token)', async () => {
    // Requires a real Slack user access token
  })

  it.skip('send-message: sends message (requires real access token)', async () => {
    // Requires a real Slack user access token
  })

  it.skip('channel-history: gets history (requires real access token)', async () => {
    // Requires a real Slack user access token
  })

  it.skip('team-info: gets team info (requires real access token)', async () => {
    // Requires a real Slack user access token
  })
})
