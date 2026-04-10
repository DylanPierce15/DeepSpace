/**
 * AI proxy routes — transparent forwarding to LLM providers.
 *
 * These routes swap in the real API key, forward the request unchanged,
 * read token usage from the response for billing, and return the response as-is.
 * This is the same pattern as Cloudflare AI Gateway.
 */

import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { eq } from 'drizzle-orm'
import { verifyJwt, safeJson } from 'deepspace/worker'
import type { Env } from '../worker'
import { getDb } from '../worker'
import { userProfiles } from '../db/schema'
import { subscriptionTierToCredits } from '../billing/service'
import {
  recordUsage,
  creditsAvailableForUser,
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
}

// Fallback pricing when model not in the map
const DEFAULT_PRICING = { input: 0.000003, output: 0.000015 }

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
// Provider configs
// ============================================================================

interface ProviderConfig {
  baseUrl: string
  setAuthHeaders: (headers: Headers, env: Env['Bindings']) => void
  apiKeyEnvVar: keyof Env['Bindings']
  extractUsage: (body: unknown) => UsageData
  extractStreamingUsage: (accumulated: string) => UsageData
}

const PROVIDERS: Record<string, ProviderConfig> = {
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    setAuthHeaders(headers, env) {
      headers.delete('authorization')
      headers.delete('x-api-key')
      headers.set('x-api-key', env.ANTHROPIC_API_KEY)
      if (!headers.has('anthropic-version')) {
        headers.set('anthropic-version', '2023-06-01')
      }
    },
    extractUsage(body: unknown): UsageData {
      const b = body as Record<string, any> | null
      return {
        inputTokens: b?.usage?.input_tokens ?? 0,
        outputTokens: b?.usage?.output_tokens ?? 0,
        model: b?.model ?? 'unknown',
      }
    },
    extractStreamingUsage(accumulated: string): UsageData {
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
    },
  },

  openai: {
    baseUrl: 'https://api.openai.com',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    setAuthHeaders(headers, env) {
      headers.delete('authorization')
      headers.delete('x-api-key')
      headers.set('authorization', `Bearer ${env.OPENAI_API_KEY}`)
    },
    extractUsage(body: unknown): UsageData {
      const b = body as Record<string, any> | null
      return {
        inputTokens: b?.usage?.prompt_tokens ?? 0,
        outputTokens: b?.usage?.completion_tokens ?? 0,
        model: b?.model ?? 'unknown',
      }
    },
    extractStreamingUsage(accumulated: string): UsageData {
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
    },
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
      return safeJson(c, { error: `${providerName} API key not configured` }, 500)
    }

    const userId: string = c.get('userId')
    const billingUserId: string = c.req.header('X-Billing-User-Id') ?? userId
    const db = getDb(c.env)

    // Gate: user must have > 0 credits
    const { credits } = await creditsAvailableForUser(db, billingUserId)
    if (credits <= 0) {
      return safeJson(c, { error: 'Insufficient credits' }, 402)
    }

    // Build target URL — strip the /api/proxy/<provider> prefix
    const url = new URL(c.req.url)
    const upstreamPath = url.pathname.replace(
      new RegExp(`^/api/proxy/${providerName}`),
      '',
    )
    const targetUrl = `${provider.baseUrl}${upstreamPath}${url.search}`

    // Clone headers, swap auth, strip internal headers
    const fwdHeaders = new Headers(c.req.raw.headers)
    fwdHeaders.delete('host')
    fwdHeaders.delete('x-auth-token')
    fwdHeaders.delete('x-billing-user-id')
    provider.setAuthHeaders(fwdHeaders, c.env)

    // Forward request
    const upstream = await fetch(targetUrl, {
      method: c.req.method,
      headers: fwdHeaders,
      body: c.req.method !== 'GET' && c.req.method !== 'HEAD'
        ? c.req.raw.body
        : undefined,
    })

    // Forward error responses unchanged (no billing)
    if (!upstream.ok) {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: upstream.headers,
      })
    }

    const contentType = upstream.headers.get('content-type') ?? ''
    const isStreaming = contentType.includes('text/event-stream')

    if (isStreaming) {
      return handleStreaming(c, upstream, provider, providerName, db, billingUserId, userId)
    }
    return handleNonStreaming(c, upstream, provider, providerName, db, billingUserId, userId)
  }
}

async function handleNonStreaming(
  c: any,
  upstream: Response,
  provider: ProviderConfig,
  providerName: string,
  db: any,
  billingUserId: string,
  callerUserId: string,
): Promise<Response> {
  const body = await upstream.text()

  // Extract usage and record billing
  try {
    const json = JSON.parse(body)
    const usage = provider.extractUsage(json)
    if (usage.inputTokens > 0 || usage.outputTokens > 0) {
      const totalCost = calculateTokenCost(usage)
      const totalTokens = usage.inputTokens + usage.outputTokens
      const calculation: BillingCalculation = {
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
      await recordUsage(db, billingUserId, providerName, 'proxy', calculation, callerUserId, true)
    }
  } catch { /* non-JSON or no usage — skip billing */ }

  return new Response(body, {
    status: upstream.status,
    headers: upstream.headers,
  })
}

function handleStreaming(
  c: any,
  upstream: Response,
  provider: ProviderConfig,
  providerName: string,
  db: any,
  billingUserId: string,
  callerUserId: string,
): Response {
  const [clientStream, billingStream] = upstream.body!.tee()

  // Read billing stream in background via waitUntil
  c.executionCtx.waitUntil(
    (async () => {
      const reader = billingStream.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
      }
      const usage = provider.extractStreamingUsage(accumulated)
      if (usage.inputTokens > 0 || usage.outputTokens > 0) {
        const totalCost = calculateTokenCost(usage)
        const totalTokens = usage.inputTokens + usage.outputTokens
        const calculation: BillingCalculation = {
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
        await recordUsage(db, billingUserId, providerName, 'proxy', calculation, callerUserId, true)
      }
    })().catch((err) => {
      console.error(`[proxy] Failed to record billing for ${providerName}:`, err)
    }),
  )

  return new Response(clientStream, {
    status: upstream.status,
    headers: upstream.headers,
  })
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
    return safeJson(c, { error: 'Missing authorization token' }, 401)
  }

  const { result, error } = await verifyJwt(
    { publicKey: c.env.AUTH_JWT_PUBLIC_KEY, issuer: c.env.AUTH_JWT_ISSUER },
    jwt,
  )

  if (!result) {
    return safeJson(c, { error: 'Invalid or expired token' }, 401)
  }

  c.set('userId', result.userId)
  c.set('claims', result.claims)

  // Ensure billing profile exists (same logic as authMiddleware)
  const db = getDb(c.env)
  const [existing] = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(eq(userProfiles.id, result.userId))
    .limit(1)

  if (!existing) {
    const isTest = !!result.claims.isTestAccount
    const tier = isTest ? 'test' : 'free'
    const now = new Date()
    await db.insert(userProfiles).values({
      id: result.userId,
      subscriptionTier: tier,
      subscriptionCredits: subscriptionTierToCredits(tier),
      createdAt: now,
      updatedAt: now,
    })
  }

  await next()
})

// ============================================================================
// Routes
// ============================================================================

proxy.all('/anthropic/*', proxyAuth, createProxyHandler('anthropic'))
proxy.all('/openai/*', proxyAuth, createProxyHandler('openai'))

export default proxy
