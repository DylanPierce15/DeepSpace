/**
 * Cross-cutting integration tests — registry + billing completeness.
 * Per-integration tests live in each integration's folder.
 */

import { describe, it, expect } from 'vitest'
import { HANDLER_REGISTRY, BILLING_CONFIGS } from '../integrations/_registry'

describe('Registry & billing completeness', () => {
  it('every registered handler has a billing config', () => {
    for (const key of HANDLER_REGISTRY.keys()) {
      expect(BILLING_CONFIGS[key], `Missing billing config for handler: ${key}`).toBeDefined()
    }
  })

  it('every billing config has a registered handler', () => {
    for (const key of Object.keys(BILLING_CONFIGS)) {
      expect(HANDLER_REGISTRY.has(key), `Missing handler for billing config: ${key}`).toBe(true)
    }
  })

  it('all existing integrations are registered', () => {
    const expected = [
      'openai/chat-completion',
      'freepik/text-to-image-classic',
      'freepik/generate-image-mystic',
      'freepik/generate-image-flux-dev',
      'serpapi/search',
      'openweathermap/geocoding',
      'openweathermap/current',
      'openweathermap/forecast',
      'wikipedia/search-pages',
      'wikipedia/get-page-summary',
      'wikipedia/get-page-content',
      'wikipedia/get-random-page',
      'nasa/apod',
      'exa/search',
      'exa/answer',
      'newsapi/top-headlines',
      'newsapi/search-everything',
    ]
    for (const key of expected) {
      expect(HANDLER_REGISTRY.has(key), `Missing: ${key}`).toBe(true)
    }
  })
})
