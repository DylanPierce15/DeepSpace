/**
 * AI provider helpers — create Vercel AI SDK providers that route through
 * the DeepSpace API worker proxy for per-user billing.
 *
 * Supported providers: anthropic, openai, groq, cerebras.
 *
 * The API worker can be reached in two ways:
 *   - Service binding `env.API_WORKER` (Cloudflare Fetcher) — preferred in
 *     production if the app has declared the binding in wrangler.toml.
 *   - HTTPS URL `env.API_WORKER_URL` — used in local dev and in production
 *     for apps that don't declare the binding. `deepspace dev` writes this
 *     into `.dev.vars` automatically.
 *
 * Auth is automatic by default:
 *   - For server-side autonomous calls (cron, DO alarms, background agents),
 *     the helper reads the long-lived `env.APP_OWNER_JWT` minted at deploy
 *     time (or by `deepspace dev` in local development) and uses it for the
 *     proxy auth header. The owner is billed automatically via the JWT sub.
 *   - For user-initiated calls (e.g. an `/api/ai/chat` route handling a
 *     browser request), pass `options.authToken` explicitly with the user's
 *     own JWT so the call is billed to the user.
 *
 * Usage:
 *
 *   // Server-side autonomous — no auth config needed
 *   import { createDeepSpaceAI } from 'deepspace/worker'
 *   const cerebras = createDeepSpaceAI(env, 'cerebras')
 *   const result = await generateText({ model: cerebras('llama-3.3-70b'), ... })
 *
 *   // User-initiated (inside a request handler)
 *   const jwt = c.req.header('Authorization')!.slice(7)
 *   const anthropic = createDeepSpaceAI(c.env, 'anthropic', { authToken: jwt })
 */

import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGroq } from '@ai-sdk/groq'
import { createCerebras } from '@ai-sdk/cerebras'

type Provider = 'anthropic' | 'openai' | 'groq' | 'cerebras'

export interface DeepSpaceAIEnv {
  /** Cloudflare service binding for the DeepSpace API worker. Preferred. */
  API_WORKER?: Fetcher
  /** HTTPS URL for the DeepSpace API worker. Used when the binding is absent. */
  API_WORKER_URL?: string
  /**
   * Long-lived owner-scoped JWT minted at deploy time (or by `deepspace dev`).
   * Used as the default proxy auth token when `options.authToken` is absent.
   * Bills the app owner.
   */
  APP_OWNER_JWT?: string
}

export interface DeepSpaceAIOptions {
  /**
   * Explicit auth token for this call. Use this for user-initiated flows
   * where the caller's own JWT should be billed. If omitted, the helper
   * falls back to `env.APP_OWNER_JWT`.
   */
  authToken?: string
  /** Override the billing user (defaults to the JWT subject). */
  billingUserId?: string
}

/**
 * Build an AI SDK provider that routes through the DeepSpace API worker.
 *
 * Resolves the transport (service binding or URL) and the auth token
 * (explicit or `env.APP_OWNER_JWT`) automatically. Throws a clear error if
 * either is unconfigured.
 */
export function createDeepSpaceAI(
  env: DeepSpaceAIEnv,
  provider: Provider,
  options: DeepSpaceAIOptions = {},
) {
  const transport = resolveTransport(env)
  const authToken = options.authToken ?? env.APP_OWNER_JWT
  if (!authToken) {
    throw new Error(
      'createDeepSpaceAI: no auth token available. Either pass `options.authToken` ' +
        'explicitly (for user-initiated calls), or ensure `env.APP_OWNER_JWT` is set ' +
        '(injected at deploy time or by `deepspace dev`).',
    )
  }

  const proxyFetch: typeof globalThis.fetch = (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url

    const headers = new Headers(init?.headers)
    headers.set('X-Auth-Token', authToken)
    if (options.billingUserId) headers.set('X-Billing-User-Id', options.billingUserId)

    if (transport.kind === 'binding') {
      return transport.fetcher.fetch(url, { ...init, headers } as RequestInit)
    }

    // URL transport: rewrite the internal host to the real API worker URL.
    const original = new URL(url)
    const rewritten = `${transport.baseUrl}${original.pathname}${original.search}`
    return fetch(rewritten, { ...init, headers })
  }

  // Every provider's SDK expects baseURL to end in /v1 — it then appends
  // the provider-specific suffix (/messages for Anthropic, /chat/completions
  // for OpenAI/Groq/Cerebras).
  const baseURL = `https://api-worker.internal/api/proxy/${provider}/v1`

  switch (provider) {
    case 'anthropic':
      return createAnthropic({ baseURL, apiKey: 'platform-managed', fetch: proxyFetch })
    case 'openai':
      return createOpenAI({ baseURL, apiKey: 'platform-managed', fetch: proxyFetch })
    case 'groq':
      return createGroq({ baseURL, apiKey: 'platform-managed', fetch: proxyFetch })
    case 'cerebras':
      return createCerebras({ baseURL, apiKey: 'platform-managed', fetch: proxyFetch })
    default: {
      const _exhaustive: never = provider
      throw new Error(`Unknown provider: ${String(_exhaustive)}`)
    }
  }
}

type Transport =
  | { kind: 'binding'; fetcher: Fetcher }
  | { kind: 'url'; baseUrl: string }

function resolveTransport(env: DeepSpaceAIEnv): Transport {
  if (env.API_WORKER) return { kind: 'binding', fetcher: env.API_WORKER }
  if (env.API_WORKER_URL) {
    return { kind: 'url', baseUrl: env.API_WORKER_URL.replace(/\/$/, '') }
  }
  throw new Error(
    'createDeepSpaceAI: neither env.API_WORKER nor env.API_WORKER_URL is set. ' +
      'Add a service binding in wrangler.toml for production, or let `deepspace dev` ' +
      'write API_WORKER_URL into .dev.vars for local development.',
  )
}
