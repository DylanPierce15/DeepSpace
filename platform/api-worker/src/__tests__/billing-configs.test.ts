/**
 * Tests for billing configs — ensures pricing matches Miyagi3's IntegrationConfigs.ts.
 */

import { describe, it, expect } from 'vitest'
import { getIntegrationConfig, INTEGRATION_CONFIGS } from '../billing/configs'

describe('billing/configs', () => {
  describe('getIntegrationConfig', () => {
    it('returns config for known integration/endpoint', () => {
      const config = getIntegrationConfig('openai', 'chat-completion')
      expect(config).toBeDefined()
      expect(config!.integrationName).toBe('openai')
      expect(config!.endpoint).toBe('chat-completion')
    })

    it('returns undefined for unknown integration', () => {
      expect(getIntegrationConfig('nonexistent', 'endpoint')).toBeUndefined()
    })

    it('returns undefined for known integration but unknown endpoint', () => {
      expect(getIntegrationConfig('openai', 'nonexistent')).toBeUndefined()
    })
  })

  describe('OpenAI pricing (per-token)', () => {
    const config = INTEGRATION_CONFIGS['openai/chat-completion']

    it('exists and is active', () => {
      expect(config).toBeDefined()
      expect(config.isActive).toBe(true)
    })

    it('uses per_token billing model', () => {
      expect(config.billingModel).toBe('per_token')
    })

    it('has USD currency', () => {
      expect(config.currency).toBe('USD')
    })

    it('has base cost $0.00003 per token', () => {
      expect(config.baseCostPerUnit).toBe(0.00003)
    })

    it('has model-based cost multipliers', () => {
      const multipliers = config.costModifiers?.baseMultipliers?.model
      expect(multipliers).toBeDefined()
      expect(multipliers!['gpt-4o']).toBe(1.0)
      expect(multipliers!['gpt-4o-mini']).toBe(0.1)
    })
  })

  describe('Freepik text-to-image-classic pricing (per-request)', () => {
    const config = INTEGRATION_CONFIGS['freepik/text-to-image-classic']

    it('exists and is active', () => {
      expect(config).toBeDefined()
      expect(config.isActive).toBe(true)
    })

    it('uses per_request billing', () => {
      expect(config.billingModel).toBe('per_request')
    })

    // Miyagi3 has $0.005 per image
    it('has base cost $0.005 per image (matches Miyagi3)', () => {
      expect(config.baseCostPerUnit).toBe(0.005)
    })

    it('has USD currency', () => {
      expect(config.currency).toBe('USD')
    })
  })

  describe('Freepik mystic pricing with resolution multipliers', () => {
    const config = INTEGRATION_CONFIGS['freepik/generate-image-mystic']

    it('has base cost $0.069 (matches Miyagi3)', () => {
      expect(config.baseCostPerUnit).toBe(0.069)
    })

    it('has resolution multipliers matching Miyagi3', () => {
      const res = config.costModifiers?.baseMultipliers?.resolution
      expect(res).toBeDefined()
      expect(res!['1k']).toBe(1.0)
      expect(res!['2k']).toBe(1.72464)
      expect(res!['4k']).toBe(5.50725)
    })
  })

  describe('Freepik flux-dev pricing', () => {
    const config = INTEGRATION_CONFIGS['freepik/generate-image-flux-dev']

    it('has base cost $0.012 (matches Miyagi3)', () => {
      expect(config.baseCostPerUnit).toBe(0.012)
    })

    it('uses per_request billing', () => {
      expect(config.billingModel).toBe('per_request')
    })
  })

  describe('SerpAPI search pricing (per-request)', () => {
    const config = INTEGRATION_CONFIGS['serpapi/search']

    it('exists and is active', () => {
      expect(config).toBeDefined()
      expect(config.isActive).toBe(true)
    })

    it('uses per_request billing', () => {
      expect(config.billingModel).toBe('per_request')
    })

    it('has base cost $0.01 per request', () => {
      expect(config.baseCostPerUnit).toBe(0.01)
    })

    it('has USD currency', () => {
      expect(config.currency).toBe('USD')
    })
  })

  describe('all configs are active', () => {
    it('every config has isActive=true', () => {
      for (const [key, config] of Object.entries(INTEGRATION_CONFIGS)) {
        expect(config.isActive, `${key} should be active`).toBe(true)
      }
    })
  })
})
