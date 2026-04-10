/**
 * AI provider helpers — create Vercel AI SDK providers that route through
 * the DeepSpace API worker proxy for per-user billing.
 *
 * Usage:
 *   const anthropic = createDeepSpaceAIFromBinding(env.API_WORKER, 'anthropic', { authToken: jwt })
 *   const result = await generateText({ model: anthropic('claude-sonnet-4-20250514'), ... })
 */

import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'

type Provider = 'anthropic' | 'openai'

interface ProxyAuthOptions {
  /** JWT token for proxy authentication (sent as X-Auth-Token to avoid conflicts with provider auth headers) */
  authToken: string
  /** Override billing user (defaults to the authenticated user) */
  billingUserId?: string
}

/**
 * Create an AI SDK provider instance that routes through the API worker proxy
 * via a Cloudflare service binding. All LLM calls go through the deployed
 * API worker for key management and per-user billing.
 */
export function createDeepSpaceAIFromBinding(
  apiWorker: Fetcher,
  provider: Provider,
  options: ProxyAuthOptions,
) {
  // Route fetch through the service binding with proxy auth headers.
  // The hostname is arbitrary — only the path matters for routing.
  const proxyFetch: typeof globalThis.fetch = (input, init) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url

    const headers = new Headers(init?.headers)
    headers.set('X-Auth-Token', options.authToken)
    if (options.billingUserId) {
      headers.set('X-Billing-User-Id', options.billingUserId)
    }

    return apiWorker.fetch(url, { ...init, headers } as RequestInit)
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
