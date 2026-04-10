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

const proxy = new Hono<Env>()

// ============================================================================
// Token pricing per model (cost per token in USD)
// ============================================================================

const TOKEN_PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  'claude-sonnet-4-20250514': { input: 0.000003, output: 0.000015 },
  'claude-haiku-4-5-20251001': { input: 0.000001, output: 0.000005 },
  'claude-opus-4-6-20250626': { input: 0.000015, output: 0.000075 },
  // OpenAI
  'gpt-4o': { input: 0.0000025, output: 0.00001 },
  'gpt-4o-mini': { input: 0.00000015, output: 0.0000006 },
  'gpt-4.1': { input: 0.000002, output: 0.000008 },
  'gpt-4.1-mini': { input: 0.0000004, output: 0.0000016 },
  'gpt-4.1-nano': { input: 0.0000001, output: 0.0000004 },
  // Cerebras (public pricing as of late 2025 — very fast, very cheap)
  'llama3.1-8b': { input: 0.0000001, output: 0.0000001 },
  'llama-3.3-70b': { input: 0.00000085, output: 0.0000012 },
  'gpt-oss-120b': { input: 0.00000025, output: 0.00000069 },
  'qwen-3-32b': { input: 0.0000004, output: 0.0000008 },
  'qwen-3-235b-a22b-instruct-2507': { input: 0.0000006, output: 0.0000012 },
}

// Fallback pricing when model is not in the map. We bias toward the most
// expensive listed model so a typo or new model name over-bills (and the
// pre-flight credit gate over-rejects) rather than under-bills.
const DEFAULT_PRICING = { input: 0.000015, output: 0.000075 }

// Default max output tokens when the request body doesn't specify one. Used
// only by the pre-flight credit estimate. 4096 is a safe upper bound for the
// common Anthropic / OpenAI chat default.
const DEFAULT_MAX_OUTPUT_TOKENS = 4096

interface UsageData {
  inputTokens: number
  outputTokens: number
  model: string
}

function calculateTokenCost(usage: UsageData): number {
  const pricing = TOKEN_PRICING[usage.model] ?? DEFAULT_PRICING
  return (usage.inputTokens * pricing.input) + (usage.outputTokens * pricing.output)
}

// ============================================================================
// Pre-flight cost estimation
// ============================================================================

/**
 * Rough character → token approximation. The real tokenizer would be more
 * accurate but is too heavy to ship in a Worker. 4 chars/token is the
 * commonly-cited average for English text across GPT and Claude tokenizers.
 */
function estimateInputTokens(body: Record<string, unknown> | null): number {
  if (!body) return 0
  let chars = 0
  const messages = body.messages
  if (Array.isArray(messages)) {
    for (const m of messages) {
      const content = (m as Record<string, unknown>)?.content
      if (typeof content === 'string') chars += content.length
      else if (Array.isArray(content)) {
        for (const part of content) {
          const text = (part as Record<string, unknown>)?.text
          if (typeof text === 'string') chars += text.length
        }
      }
    }
  }
  if (typeof body.system === 'string') chars += body.system.length
  if (typeof body.prompt === 'string') chars += body.prompt.length
  return Math.ceil(chars / 4)
}

function readMaxOutputTokens(body: Record<string, unknown> | null): number {
  if (!body) return DEFAULT_MAX_OUTPUT_TOKENS
  const fromBody =
    (typeof body.max_tokens === 'number' && body.max_tokens) ||
    (typeof body.max_completion_tokens === 'number' && body.max_completion_tokens) ||
    (typeof body.max_output_tokens === 'number' && body.max_output_tokens)
  return fromBody || DEFAULT_MAX_OUTPUT_TOKENS
}

/**
 * Worst-case dollar cost for a request, used for the pre-flight credit gate.
 * Assumes the model will return its full max_tokens output and that the
 * input is roughly chars/4 tokens.
 */
function estimateMaxCost(body: Record<string, unknown> | null): number {
  const model = typeof body?.model === 'string' ? (body.model as string) : 'unknown'
  const pricing = TOKEN_PRICING[model] ?? DEFAULT_PRICING
  const inputTokens = estimateInputTokens(body)
  const outputTokens = readMaxOutputTokens(body)
  return inputTokens * pricing.input + outputTokens * pricing.output
}

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

// Anthropic Messages API: usage on the response root.
function extractAnthropicUsage(body: unknown): UsageData {
  const b = body as Record<string, any> | null
  return {
    inputTokens: b?.usage?.input_tokens ?? 0,
    outputTokens: b?.usage?.output_tokens ?? 0,
    model: b?.model ?? 'unknown',
  }
}

// Anthropic SSE stream: input_tokens on `message_start`, output_tokens
// updated on each `message_delta`.
function extractAnthropicStreamingUsage(accumulated: string): UsageData {
  let inputTokens = 0
  let outputTokens = 0
  let model = 'unknown'
  for (const line of accumulated.split('\n')) {
    if (!line.startsWith('data: ')) continue
    try {
      const data = JSON.parse(line.slice(6))
      if (data.type === 'message_start' && data.message) {
        if (data.message.model) model = data.message.model
        if (data.message.usage?.input_tokens) {
          inputTokens = data.message.usage.input_tokens
        }
      }
      if (data.type === 'message_delta' && data.usage) {
        outputTokens = data.usage.output_tokens ?? outputTokens
      }
    } catch { /* skip non-JSON lines */ }
  }
  return { inputTokens, outputTokens, model }
}

// OpenAI chat-completions shape, also used by every OpenAI-compatible
// provider (Cerebras, etc).
function extractOpenAIUsage(body: unknown): UsageData {
  const b = body as Record<string, any> | null
  return {
    inputTokens: b?.usage?.prompt_tokens ?? 0,
    outputTokens: b?.usage?.completion_tokens ?? 0,
    model: b?.model ?? 'unknown',
  }
}

// OpenAI-compatible SSE stream: emits `data: {...}` chunks ending with
// `data: [DONE]`. Final chunks may include a `usage` block.
function extractOpenAIStreamingUsage(accumulated: string): UsageData {
  let inputTokens = 0
  let outputTokens = 0
  let model = 'unknown'
  for (const line of accumulated.split('\n')) {
    if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
    try {
      const data = JSON.parse(line.slice(6))
      if (data.model) model = data.model
      if (data.usage) {
        inputTokens = data.usage.prompt_tokens ?? inputTokens
        outputTokens = data.usage.completion_tokens ?? outputTokens
      }
    } catch { /* skip non-JSON lines */ }
  }
  return { inputTokens, outputTokens, model }
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
    if (usage.inputTokens > 0 || usage.outputTokens > 0) {
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
        if (usage.inputTokens > 0 || usage.outputTokens > 0) {
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
  const totalTokens = usage.inputTokens + usage.outputTokens
  return {
    billingUnits: totalTokens,
    unitCost: totalCost / totalTokens,
    totalCost,
    breakdown: {
      provider: providerName,
      model: usage.model,
      inputTokens: usage.inputTokens,
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
