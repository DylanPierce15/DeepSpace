/**
 * AI proxy routes — transparent forwarding to LLM providers.
 *
 * These routes swap in the real API key, forward the request unchanged,
 * read token usage from the response for billing, and return the response as-is.
 * This is the same pattern as Cloudflare AI Gateway.
 */

import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { verifyJwt } from 'deepspace/worker'
import type { Env } from '../worker'
import { getDb } from '../worker'
import { ensureBillingProfile } from '../middleware/auth'
import {
  recordUsage,
  creditsAvailableForUser,
  dollarsToCredits,
  COST_MARKUP_MULTIPLIER,
} from '../billing/service'
import type { BillingCalculation } from '../billing/service'
import {
  type UsageData,
  calculateTokenCost,
  totalUsageTokens,
  estimateMaxCost,
  extractAnthropicUsage,
  extractAnthropicStreamingUsage,
  extractOpenAIUsage,
  extractOpenAIStreamingUsage,
} from './proxy-pricing'

const proxy = new Hono<Env>()

// ============================================================================
// Response header sanitization
// ============================================================================

/**
 * Build a Headers object safe to return to the client. Drops:
 *   - content-encoding / content-length: stale after we read & re-emit
 *     the body. Cloudflare auto-decodes upstream gzip/br, so the upstream
 *     headers no longer match the bytes we forward.
 *   - transfer-encoding: managed by the runtime.
 *   - connection / keep-alive: hop-by-hop.
 */
function sanitizeUpstreamHeaders(upstream: Headers): Headers {
  const out = new Headers(upstream)
  out.delete('content-encoding')
  out.delete('content-length')
  out.delete('transfer-encoding')
  out.delete('connection')
  out.delete('keep-alive')
  return out
}

// ============================================================================
// Provider configs
//
// Each entry only declares what's actually different between providers:
//   - the upstream base URL
//   - the env var holding the real API key
//   - how the upstream auth header is set (Anthropic uses x-api-key, the
//     OpenAI-compatible providers use Authorization: Bearer)
//   - usage extraction (Anthropic vs. OpenAI-compatible response shapes)
//
// The shared proxy handler strips client-supplied auth headers
// (`authorization`, `x-api-key`) before calling `setAuthHeader`, so
// providers don't need to clear them themselves.
// ============================================================================

interface ProviderConfig {
  baseUrl: string
  apiKeyEnvVar: keyof Env['Bindings']
  setAuthHeader: (headers: Headers, apiKey: string) => void
  extractUsage: (body: unknown) => UsageData
  extractStreamingUsage: (accumulated: string) => UsageData
}

const setBearerAuth = (headers: Headers, apiKey: string) => {
  headers.set('authorization', `Bearer ${apiKey}`)
}

const PROVIDERS: Record<string, ProviderConfig> = {
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    setAuthHeader(headers, apiKey) {
      headers.set('x-api-key', apiKey)
      if (!headers.has('anthropic-version')) {
        headers.set('anthropic-version', '2023-06-01')
      }
    },
    extractUsage: extractAnthropicUsage,
    extractStreamingUsage: extractAnthropicStreamingUsage,
  },

  openai: {
    baseUrl: 'https://api.openai.com',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    setAuthHeader: setBearerAuth,
    extractUsage: extractOpenAIUsage,
    extractStreamingUsage: extractOpenAIStreamingUsage,
  },

  // Cerebras exposes an OpenAI-compatible API at https://api.cerebras.ai/v1.
  cerebras: {
    baseUrl: 'https://api.cerebras.ai',
    apiKeyEnvVar: 'CEREBRAS_API_KEY',
    setAuthHeader: setBearerAuth,
    extractUsage: extractOpenAIUsage,
    extractStreamingUsage: extractOpenAIStreamingUsage,
  },
}

// ============================================================================
// Shared proxy handler
// ============================================================================

function createProxyHandler(providerName: string) {
  const provider = PROVIDERS[providerName]

  return async (c: any) => {
    const apiKey = c.env[provider.apiKeyEnvVar]
    if (!apiKey) {
      return c.json({ error: `${providerName} API key not configured` }, 500)
    }

    // Billing is always against the JWT subject. To bill a different user
    // (e.g. the app owner for server-side autonomous calls), mint a JWT for
    // that user and send it as the proxy auth token — do NOT rely on a
    // client-supplied header, which would be forgeable by any signed-in user.
    const userId: string = c.get('userId')
    const db = getDb(c.env)

    // Buffer the request body so we can estimate cost up-front and forward
    // it without consuming the underlying stream twice. Chat requests are
    // small (a handful of KB at most).
    const hasBody = c.req.method !== 'GET' && c.req.method !== 'HEAD'
    const requestBody = hasBody ? await c.req.raw.text() : null
    let parsedBody: Record<string, unknown> | null = null
    if (requestBody) {
      try { parsedBody = JSON.parse(requestBody) } catch { /* leave null */ }
    }

    // Pre-flight credit gate. Estimate the worst-case dollar cost for this
    // request (max output tokens at the model's output price plus input
    // tokens approximated from message char counts), apply the same markup
    // recordUsage uses, and reject if the user can't afford the worst case.
    // Without this, a user with 1 credit could bypass the old `credits<=0`
    // gate and consume an unbounded amount before billing catches up.
    const estimatedDollars = estimateMaxCost(parsedBody)
    const estimatedCredits = dollarsToCredits(estimatedDollars * COST_MARKUP_MULTIPLIER)
    const { credits } = await creditsAvailableForUser(db, userId)
    if (credits < estimatedCredits) {
      return c.json(
        {
          error: 'Insufficient credits',
          required: estimatedCredits,
          available: credits,
        },
        402,
      )
    }

    // Build target URL — strip the /api/proxy/<provider> prefix
    const url = new URL(c.req.url)
    const upstreamPath = url.pathname.replace(
      new RegExp(`^/api/proxy/${providerName}`),
      '',
    )
    const targetUrl = `${provider.baseUrl}${upstreamPath}${url.search}`

    // Clone headers, then strip everything provider-specific or internal
    // before letting the provider config set its own auth header.
    const fwdHeaders = new Headers(c.req.raw.headers)
    fwdHeaders.delete('host')
    // Internal proxy headers — never forward these upstream.
    fwdHeaders.delete('x-auth-token')
    fwdHeaders.delete('x-billing-user-id')
    // Any client-supplied provider-auth header (e.g. our placeholder
    // "platform-managed" apiKey from the AI SDK). The provider config sets
    // the real one below.
    fwdHeaders.delete('authorization')
    fwdHeaders.delete('x-api-key')
    // content-length / content-encoding are for the original request body.
    // We re-emit the buffered body as a string, so let the runtime recompute.
    fwdHeaders.delete('content-length')
    fwdHeaders.delete('content-encoding')
    provider.setAuthHeader(fwdHeaders, apiKey)

    // Forward request
    const upstream = await fetch(targetUrl, {
      method: c.req.method,
      headers: fwdHeaders,
      body: requestBody,
    })

    const responseHeaders = sanitizeUpstreamHeaders(upstream.headers)

    // Forward error responses unchanged (no billing)
    if (!upstream.ok) {
      const errorBody = await upstream.text()
      return new Response(errorBody, {
        status: upstream.status,
        headers: responseHeaders,
      })
    }

    const contentType = upstream.headers.get('content-type') ?? ''
    const isStreaming = contentType.includes('text/event-stream')

    if (isStreaming) {
      return handleStreaming(c, upstream, provider, providerName, db, userId, responseHeaders)
    }
    return handleNonStreaming(upstream, provider, providerName, db, userId, responseHeaders)
  }
}

async function handleNonStreaming(
  upstream: Response,
  provider: ProviderConfig,
  providerName: string,
  db: any,
  userId: string,
  responseHeaders: Headers,
): Promise<Response> {
  const body = await upstream.text()

  // Extract usage and record billing
  try {
    const json = JSON.parse(body)
    const usage = provider.extractUsage(json)
    if (totalUsageTokens(usage) > 0) {
      const calculation = buildBillingCalculation(usage, providerName)
      await recordUsage(db, userId, providerName, 'proxy', calculation, undefined, true)
    }
  } catch { /* non-JSON or no usage — skip billing */ }

  return new Response(body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

/**
 * Stream upstream → client via an explicit pump loop. We don't use
 * `upstream.body.tee()` because if the client side gets cancelled (browser
 * disconnect), the upstream reader stops draining and the billing accumulator
 * never finishes — usage would silently fail to record.
 *
 * Instead we run one reader against upstream, write each chunk to a
 * TransformStream the client reads from, and on each chunk also append to a
 * billing buffer. If the client is gone, write() throws, we swallow it and
 * keep reading upstream until done so the billing record is accurate.
 */
function handleStreaming(
  c: any,
  upstream: Response,
  provider: ProviderConfig,
  providerName: string,
  db: any,
  userId: string,
  responseHeaders: Headers,
): Response {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()
  const decoder = new TextDecoder()
  let accumulated = ''
  let clientLive = true

  c.executionCtx.waitUntil(
    (async () => {
      const reader = upstream.body!.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          accumulated += decoder.decode(value, { stream: true })
          if (clientLive) {
            try {
              await writer.write(value)
            } catch {
              clientLive = false
            }
          }
        }
      } finally {
        try { await writer.close() } catch { /* client gone */ }

        const usage = provider.extractStreamingUsage(accumulated)
        if (totalUsageTokens(usage) > 0) {
          try {
            const calculation = buildBillingCalculation(usage, providerName)
            await recordUsage(db, userId, providerName, 'proxy', calculation, undefined, true)
          } catch (err) {
            console.error(`[proxy] Failed to record billing for ${providerName}:`, err)
          }
        }
      }
    })(),
  )

  return new Response(readable, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

function buildBillingCalculation(usage: UsageData, providerName: string): BillingCalculation {
  const totalCost = calculateTokenCost(usage)
  const totalTokens = totalUsageTokens(usage)
  return {
    billingUnits: totalTokens,
    unitCost: totalCost / totalTokens,
    totalCost,
    breakdown: {
      provider: providerName,
      model: usage.model,
      inputTokens: usage.inputTokens,
      cacheReadTokens: usage.cacheReadTokens,
      cacheWriteTokens: usage.cacheWriteTokens,
      outputTokens: usage.outputTokens,
    },
  }
}

// ============================================================================
// Auth — accepts Authorization: Bearer <jwt> OR X-Auth-Token: <jwt>
//
// AI SDK providers set their own auth headers (x-api-key for Anthropic,
// Authorization for OpenAI). X-Auth-Token avoids conflicts so the proxy
// can authenticate the calling user independently of the provider auth.
// ============================================================================

const proxyAuth = createMiddleware<Env>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const altToken = c.req.header('X-Auth-Token')
  const jwt = token ?? altToken ?? null

  if (!jwt) {
    return c.json({ error: 'Missing authorization token' }, 401)
  }

  const { result, error } = await verifyJwt(
    { publicKey: c.env.AUTH_JWT_PUBLIC_KEY, issuer: c.env.AUTH_JWT_ISSUER },
    jwt,
  )

  if (!result) {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }

  c.set('userId', result.userId)
  c.set('claims', result.claims)

  await ensureBillingProfile(c.env, result.userId, result.claims)

  await next()
})

// ============================================================================
// Routes
// ============================================================================

proxy.all('/anthropic/*', proxyAuth, createProxyHandler('anthropic'))
proxy.all('/openai/*', proxyAuth, createProxyHandler('openai'))
proxy.all('/cerebras/*', proxyAuth, createProxyHandler('cerebras'))

export default proxy
