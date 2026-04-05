/**
 * AUTO-GENERATED — do not edit manually.
 * Run `pnpm generate:registry` to regenerate.
 * Source: scripts/generate-registry.ts
 */

import type { IntegrationHandler, BillingConfig } from './_types'
import { endpoints as amazon } from './amazon'
import { endpoints as anthropic } from './anthropic'
import { endpoints as cloudconvert } from './cloudconvert'
import { endpoints as elevenlabs } from './elevenlabs'
import { endpoints as email } from './email'
import { endpoints as exa } from './exa'
import { endpoints as finance } from './finance'
import { endpoints as firecrawl } from './firecrawl'
import { endpoints as freepik } from './freepik'
import { endpoints as gemini } from './gemini'
import { endpoints as github } from './github'
import { endpoints as google } from './google'
import { endpoints as instagram } from './instagram'
import { endpoints as latex } from './latex'
import { endpoints as linkedin } from './linkedin'
import { endpoints as livekit } from './livekit'
import { endpoints as mta } from './mta'
import { endpoints as nasa } from './nasa'
import { endpoints as newsapi } from './newsapi'
import { endpoints as openai } from './openai'
import { endpoints as openweathermap } from './openweathermap'
import { endpoints as polymarket } from './polymarket'
import { endpoints as serpapi } from './serpapi'
import { endpoints as slack } from './slack'
import { endpoints as speech } from './speech'
import { endpoints as sports } from './sports'
import { endpoints as submagic } from './submagic'
import { endpoints as tiktok } from './tiktok'
import { endpoints as websearch } from './websearch'
import { endpoints as wikipedia } from './wikipedia'
import { endpoints as youtube } from './youtube'

const ALL_ENDPOINTS = {
  ...amazon,
  ...anthropic,
  ...cloudconvert,
  ...elevenlabs,
  ...email,
  ...exa,
  ...finance,
  ...firecrawl,
  ...freepik,
  ...gemini,
  ...github,
  ...google,
  ...instagram,
  ...latex,
  ...linkedin,
  ...livekit,
  ...mta,
  ...nasa,
  ...newsapi,
  ...openai,
  ...openweathermap,
  ...polymarket,
  ...serpapi,
  ...slack,
  ...speech,
  ...sports,
  ...submagic,
  ...tiktok,
  ...websearch,
  ...wikipedia,
  ...youtube,
}

export const HANDLER_REGISTRY = new Map<string, IntegrationHandler>()
export const BILLING_CONFIGS: Record<string, BillingConfig & { integrationName: string; endpoint: string }> = {}

for (const [key, def] of Object.entries(ALL_ENDPOINTS)) {
  const [integrationName, endpoint] = key.split('/')
  HANDLER_REGISTRY.set(key, def.handler)
  BILLING_CONFIGS[key] = { ...def.billing, integrationName, endpoint }
}
