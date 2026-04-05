/**
 * AUTO-GENERATED — do not edit manually.
 * Run `pnpm generate:registry` to regenerate.
 * Source: scripts/generate-registry.ts
 */

import type { IntegrationHandler, BillingConfig } from './_types'
import { endpoints as exa } from './exa'
import { endpoints as freepik } from './freepik'
import { endpoints as nasa } from './nasa'
import { endpoints as newsapi } from './newsapi'
import { endpoints as openai } from './openai'
import { endpoints as openweathermap } from './openweathermap'
import { endpoints as serpapi } from './serpapi'
import { endpoints as wikipedia } from './wikipedia'

const ALL_ENDPOINTS = {
  ...exa,
  ...freepik,
  ...nasa,
  ...newsapi,
  ...openai,
  ...openweathermap,
  ...serpapi,
  ...wikipedia,
}

export const HANDLER_REGISTRY = new Map<string, IntegrationHandler>()
export const BILLING_CONFIGS: Record<string, BillingConfig & { integrationName: string; endpoint: string }> = {}

for (const [key, def] of Object.entries(ALL_ENDPOINTS)) {
  const [integrationName, endpoint] = key.split('/')
  HANDLER_REGISTRY.set(key, def.handler)
  BILLING_CONFIGS[key] = { ...def.billing, integrationName, endpoint }
}
