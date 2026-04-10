/**
 * AI provider helpers — create Vercel AI SDK providers that route through
 * the DeepSpace API worker proxy for per-user billing.
 *
 * Usage (URL-based, e.g. local dev):
 *   const anthropic = createDeepSpaceAI(env.API_WORKER_URL, 'anthropic')
 *   const result = await generateText({ model: anthropic('claude-sonnet-4-20250514'), ... })
 *
 * Usage (service binding, production):
 *   const anthropic = createDeepSpaceAIFromBinding(env.API_WORKER, 'anthropic')
 */

import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'

type Provider = 'anthropic' | 'openai'

/**
 * Create an AI SDK provider instance pointed at the API worker proxy via URL.
 * Use this in development or when you have the API worker URL as a string.
 */
export function createDeepSpaceAI(apiWorkerUrl: string, provider: Provider) {
  const baseURL = `${apiWorkerUrl.replace(/\/$/, '')}/api/proxy/${provider}`

  if (provider === 'anthropic') {
    return createAnthropic({ baseURL, apiKey: 'platform-managed' })
  }
  if (provider === 'openai') {
    return createOpenAI({ baseURL, apiKey: 'platform-managed' })
  }
  throw new Error(`Unknown provider: ${provider}`)
}

/**
 * Create an AI SDK provider instance that routes through a Cloudflare service binding.
 * Use this in production where the API worker is bound as env.API_WORKER.
 */
export function createDeepSpaceAIFromBinding(apiWorker: Fetcher, provider: Provider) {
  // Route fetch through the service binding. The hostname is arbitrary —
  // only the path matters for routing within the target worker.
  const proxyFetch: typeof globalThis.fetch = (input, init) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url
    return apiWorker.fetch(url, init as RequestInit)
  }

  const baseURL = `https://api-worker.internal/api/proxy/${provider}`

  if (provider === 'anthropic') {
    return createAnthropic({ baseURL, apiKey: 'platform-managed', fetch: proxyFetch })
  }
  if (provider === 'openai') {
    return createOpenAI({ baseURL, apiKey: 'platform-managed', fetch: proxyFetch })
  }
  throw new Error(`Unknown provider: ${provider}`)
}
