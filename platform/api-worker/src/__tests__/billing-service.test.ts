/**
 * Tests for billing service — validates faithfulness to Miyagi3's
 * IntegrationBillingService and stripeService credit logic.
 *
 * Key invariants from Miyagi3:
 * - COST_MARKUP_MULTIPLIER = 1.3 (30% markup)
 * - 100 credits = $1 USD
 * - EUR → USD conversion at 1.17
 * - Subscription tiers: free=500, starter=1600, premium=4250, admin=100000
 * - Credit burn order: bonus → subscription → purchased
 */

import { describe, it, expect } from 'vitest'
import {
  calculateCost,
  COST_MARKUP_MULTIPLIER,
  dollarsToCredits,
  subscriptionTierToCredits,
} from '../billing/service'

// ==========================================================================
// Constants — must match Miyagi3
// ==========================================================================

describe('billing constants (faithfulness)', () => {
  it('COST_MARKUP_MULTIPLIER is 1.3 (30% markup)', () => {
    expect(COST_MARKUP_MULTIPLIER).toBe(1.3)
  })

  it('100 credits = $1 USD', () => {
    expect(dollarsToCredits(1)).toBe(100)
    expect(dollarsToCredits(0)).toBe(0)
    expect(dollarsToCredits(0.5)).toBe(50)
  })
})

// ==========================================================================
// Subscription tiers — must match Miyagi3's subscriptionTierToCredits()
// ==========================================================================

describe('subscriptionTierToCredits (faithfulness to Miyagi3)', () => {
  it('free tier = 500 credits', () => {
    expect(subscriptionTierToCredits('free')).toBe(500)
  })

  it('starter tier = 1,600 credits', () => {
    expect(subscriptionTierToCredits('starter')).toBe(1600)
  })

  it('premium tier = 4,250 credits', () => {
    expect(subscriptionTierToCredits('premium')).toBe(4250)
  })

  it('admin tier = 100,000 credits', () => {
    expect(subscriptionTierToCredits('admin')).toBe(100000)
  })
})

// ==========================================================================
// Cost calculation
// ==========================================================================

describe('calculateCost', () => {
  describe('per_request billing (Freepik text-to-image-classic)', () => {
    it('returns 1 billing unit regardless of params', () => {
      const result = calculateCost('freepik', 'text-to-image-classic', {})
      expect(result.billingUnits).toBe(1)
    })

    it('cost is $0.005 for classic text-to-image', () => {
      const result = calculateCost('freepik', 'text-to-image-classic', {})
      expect(result.totalCost).toBeCloseTo(0.005, 6)
    })
  })

  describe('per_request with resolution multipliers (Freepik mystic)', () => {
    it('1k resolution: $0.069', () => {
      const result = calculateCost('freepik', 'generate-image-mystic', { resolution: '1k' })
      expect(result.totalCost).toBeCloseTo(0.069, 6)
    })

    it('2k resolution: $0.069 * 1.72464 ≈ $0.119', () => {
      const result = calculateCost('freepik', 'generate-image-mystic', { resolution: '2k' })
      expect(result.totalCost).toBeCloseTo(0.069 * 1.72464, 4)
    })

    it('4k resolution: $0.069 * 5.50725 ≈ $0.38', () => {
      const result = calculateCost('freepik', 'generate-image-mystic', { resolution: '4k' })
      expect(result.totalCost).toBeCloseTo(0.069 * 5.50725, 4)
    })

    it('no resolution param defaults to base cost (no multiplier)', () => {
      const result = calculateCost('freepik', 'generate-image-mystic', {})
      expect(result.totalCost).toBeCloseTo(0.069, 6)
    })
  })

  describe('per_token billing (OpenAI)', () => {
    it('returns 1 billing unit when no token count in response', () => {
      const result = calculateCost('openai', 'chat-completion', {})
      expect(result.billingUnits).toBe(1)
    })

    it('uses token count from response data', () => {
      const result = calculateCost('openai', 'chat-completion', {}, { tokenCount: 500 })
      expect(result.billingUnits).toBe(500)
    })

    it('base cost for gpt-4o: 500 tokens * $0.00003 = $0.015', () => {
      const result = calculateCost('openai', 'chat-completion', { model: 'gpt-4o' }, { tokenCount: 500 })
      expect(result.totalCost).toBeCloseTo(0.015, 6)
    })

    it('gpt-4o-mini is 10x cheaper: 500 tokens * $0.000003 = $0.0015', () => {
      const result = calculateCost('openai', 'chat-completion', { model: 'gpt-4o-mini' }, { tokenCount: 500 })
      expect(result.totalCost).toBeCloseTo(0.0015, 6)
    })
  })

  describe('SerpAPI per-request billing', () => {
    it('1 billing unit per request', () => {
      const result = calculateCost('serpapi', 'search', { q: 'test' })
      expect(result.billingUnits).toBe(1)
    })

    it('cost is $0.01 per request', () => {
      const result = calculateCost('serpapi', 'search', { q: 'test' })
      expect(result.totalCost).toBeCloseTo(0.01, 6)
    })
  })

  describe('unknown integration throws', () => {
    it('throws for unknown integration', () => {
      expect(() => calculateCost('nonexistent', 'endpoint', {})).toThrow(
        /No active configuration found/,
      )
    })
  })

  describe('breakdown structure', () => {
    it('includes baseCostPerUnit, billingModel, currency, modifiers', () => {
      const result = calculateCost('freepik', 'generate-image-flux-dev', {})
      expect(result.breakdown).toHaveProperty('baseCostPerUnit', 0.012)
      expect(result.breakdown).toHaveProperty('billingModel', 'per_request')
      expect(result.breakdown).toHaveProperty('currency', 'USD')
      expect(result.breakdown).toHaveProperty('modifiers')
    })
  })
})

// ==========================================================================
// Markup + credits conversion end-to-end
// ==========================================================================

describe('markup and credits conversion (Miyagi3 parity)', () => {
  it('Freepik classic image: $0.005 → marked up $0.0065 → 0.65 credits', () => {
    const cost = calculateCost('freepik', 'text-to-image-classic', {})
    const markedUp = cost.totalCost * COST_MARKUP_MULTIPLIER
    const credits = dollarsToCredits(markedUp)

    expect(markedUp).toBeCloseTo(0.0065, 4)
    expect(credits).toBeCloseTo(0.65, 2)
  })

  it('SerpAPI search: $0.01 → marked up $0.013 → 1.3 credits', () => {
    const cost = calculateCost('serpapi', 'search', {})
    const markedUp = cost.totalCost * COST_MARKUP_MULTIPLIER
    const credits = dollarsToCredits(markedUp)

    expect(markedUp).toBeCloseTo(0.013, 4)
    expect(credits).toBeCloseTo(1.3, 2)
  })

  it('OpenAI gpt-4o 1000 tokens: $0.03 → marked up $0.039 → 3.9 credits', () => {
    const cost = calculateCost('openai', 'chat-completion', { model: 'gpt-4o' }, { tokenCount: 1000 })
    const markedUp = cost.totalCost * COST_MARKUP_MULTIPLIER
    const credits = dollarsToCredits(markedUp)

    expect(markedUp).toBeCloseTo(0.039, 4)
    expect(credits).toBeCloseTo(3.9, 2)
  })
})
