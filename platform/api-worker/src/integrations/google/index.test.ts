import { describe, it, expect } from 'vitest'
import { endpoints } from '.'

// Behavioral coverage (OAuth fallback, token refresh, real API calls) belongs
// in tests/e2e against the deployed api-worker — handlers now hit D1, and we
// don't stand up local D1/oauth_tokens stubs in unit tests.

describe('Google', () => {
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

})
