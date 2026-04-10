/**
 * Pure pricing & usage-extraction helpers for the AI proxy.
 *
 * Kept in its own module so the unit tests can import these functions
 * without pulling in `worker.ts` (which has Hono route side-effects).
 */

// ============================================================================
// Token pricing per model (cost per token in USD)
//
// Models that support prompt caching split input tokens into three classes:
//   - input        regular (non-cached) input
//   - cacheRead    tokens served from the prompt cache (much cheaper)
//   - cacheWrite   tokens written to the cache (Anthropic only; ~1.25x normal)
//
// If a model entry doesn't specify a cache rate, the calculator falls back
// to the regular `input` price (so we never under-bill an unknown model).
// ============================================================================

export interface ModelPricing {
  input: number
  output: number
  /** Anthropic: cache_read_input_tokens. OpenAI: prompt_tokens_details.cached_tokens. */
  cacheRead?: number
  /** Anthropic: cache_creation_input_tokens. OpenAI: not exposed. */
  cacheWrite?: number
}

export const TOKEN_PRICING: Record<string, ModelPricing> = {
  // Anthropic — cache read = 0.1x input, cache write (5min) = 1.25x input
  'claude-sonnet-4-20250514': {
    input: 0.000003, output: 0.000015,
    cacheRead: 0.0000003, cacheWrite: 0.00000375,
  },
  'claude-haiku-4-5-20251001': {
    input: 0.000001, output: 0.000005,
    cacheRead: 0.0000001, cacheWrite: 0.00000125,
  },
  'claude-opus-4-6-20250626': {
    input: 0.000015, output: 0.000075,
    cacheRead: 0.0000015, cacheWrite: 0.00001875,
  },

  // OpenAI — cached input pricing varies by model family
  'gpt-4o':       { input: 0.0000025, output: 0.00001,   cacheRead: 0.00000125 },
  'gpt-4o-mini':  { input: 0.00000015, output: 0.0000006, cacheRead: 0.000000075 },
  'gpt-4.1':      { input: 0.000002, output: 0.000008,   cacheRead: 0.0000005 },
  'gpt-4.1-mini': { input: 0.0000004, output: 0.0000016, cacheRead: 0.0000001 },
  'gpt-4.1-nano': { input: 0.0000001, output: 0.0000004, cacheRead: 0.000000025 },

  // Cerebras (no published cache pricing as of late 2025 — fall back to input)
  'llama3.1-8b':                    { input: 0.0000001, output: 0.0000001 },
  'llama-3.3-70b':                  { input: 0.00000085, output: 0.0000012 },
  'gpt-oss-120b':                   { input: 0.00000025, output: 0.00000069 },
  'qwen-3-32b':                     { input: 0.0000004, output: 0.0000008 },
  'qwen-3-235b-a22b-instruct-2507': { input: 0.0000006, output: 0.0000012 },
}

// Fallback pricing when model is not in the map. We bias toward the most
// expensive listed model so a typo or new model name over-bills (and the
// pre-flight credit gate over-rejects) rather than under-bills. Cache rates
// fall back to the regular input price for the same reason.
export const DEFAULT_PRICING: ModelPricing = { input: 0.000015, output: 0.000075 }

// Default max output tokens when the request body doesn't specify one. Used
// only by the pre-flight credit estimate. 4096 is a safe upper bound for the
// common Anthropic / OpenAI chat default.
const DEFAULT_MAX_OUTPUT_TOKENS = 4096

export interface UsageData {
  /** Non-cached input tokens (full input price). */
  inputTokens: number
  /** Cached input tokens (cacheRead price, falls back to input). */
  cacheReadTokens: number
  /** Tokens written to the prompt cache (cacheWrite price; Anthropic only). */
  cacheWriteTokens: number
  outputTokens: number
  model: string
}

const ZERO_USAGE: Omit<UsageData, 'model'> = {
  inputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  outputTokens: 0,
}

export function calculateTokenCost(usage: UsageData): number {
  const pricing = TOKEN_PRICING[usage.model] ?? DEFAULT_PRICING
  const cacheReadPrice = pricing.cacheRead ?? pricing.input
  const cacheWritePrice = pricing.cacheWrite ?? pricing.input
  return (
    usage.inputTokens * pricing.input +
    usage.cacheReadTokens * cacheReadPrice +
    usage.cacheWriteTokens * cacheWritePrice +
    usage.outputTokens * pricing.output
  )
}

export function totalUsageTokens(usage: UsageData): number {
  return usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens + usage.outputTokens
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
export function estimateMaxCost(body: Record<string, unknown> | null): number {
  const model = typeof body?.model === 'string' ? (body.model as string) : 'unknown'
  const pricing = TOKEN_PRICING[model] ?? DEFAULT_PRICING
  const inputTokens = estimateInputTokens(body)
  const outputTokens = readMaxOutputTokens(body)
  return inputTokens * pricing.input + outputTokens * pricing.output
}

// ============================================================================
// Provider-specific usage extraction
// ============================================================================

// Anthropic exposes input as 3 disjoint counts: input_tokens (non-cached),
// cache_read_input_tokens, cache_creation_input_tokens. We pass them through
// directly. https://docs.anthropic.com/en/api/messages#response-usage
function readAnthropicUsage(usage: Record<string, any> | undefined, model: string): UsageData {
  return {
    inputTokens: usage?.input_tokens ?? 0,
    cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage?.cache_creation_input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    model,
  }
}

export function extractAnthropicUsage(body: unknown): UsageData {
  const b = body as Record<string, any> | null
  return readAnthropicUsage(b?.usage, b?.model ?? 'unknown')
}

// Anthropic SSE stream: input + cache fields arrive on `message_start`,
// output_tokens is updated cumulatively on each `message_delta`.
export function extractAnthropicStreamingUsage(accumulated: string): UsageData {
  let usage: UsageData = { ...ZERO_USAGE, model: 'unknown' }
  for (const line of accumulated.split('\n')) {
    if (!line.startsWith('data: ')) continue
    try {
      const data = JSON.parse(line.slice(6))
      if (data.type === 'message_start' && data.message) {
        usage = readAnthropicUsage(data.message.usage, data.message.model ?? usage.model)
      } else if (data.type === 'message_delta' && data.usage) {
        usage.outputTokens = data.usage.output_tokens ?? usage.outputTokens
      }
    } catch { /* skip non-JSON lines */ }
  }
  return usage
}

// OpenAI exposes prompt_tokens as the TOTAL input including cached, with
// cached_tokens broken out separately. We split them so the cached portion
// gets the (cheaper) cacheRead price and the rest gets the full input price.
// https://platform.openai.com/docs/api-reference/chat/object#chat/object-usage
function readOpenAIUsage(usage: Record<string, any> | undefined, model: string): UsageData {
  const totalPrompt = usage?.prompt_tokens ?? 0
  const cached = usage?.prompt_tokens_details?.cached_tokens ?? 0
  return {
    inputTokens: Math.max(0, totalPrompt - cached),
    cacheReadTokens: cached,
    cacheWriteTokens: 0,  // OpenAI doesn't bill separately for cache writes
    outputTokens: usage?.completion_tokens ?? 0,
    model,
  }
}

export function extractOpenAIUsage(body: unknown): UsageData {
  const b = body as Record<string, any> | null
  return readOpenAIUsage(b?.usage, b?.model ?? 'unknown')
}

// OpenAI-compatible SSE stream: when stream_options.include_usage is set
// (createDeepSpaceAI does this for openai/cerebras), usage arrives in the
// final pre-`[DONE]` chunk. Earlier chunks may also carry a usage field
// with a null value, which we skip.
export function extractOpenAIStreamingUsage(accumulated: string): UsageData {
  let usage: UsageData = { ...ZERO_USAGE, model: 'unknown' }
  for (const line of accumulated.split('\n')) {
    if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
    try {
      const data = JSON.parse(line.slice(6))
      if (data.model) usage.model = data.model
      if (data.usage) usage = readOpenAIUsage(data.usage, usage.model)
    } catch { /* skip non-JSON lines */ }
  }
  return usage
}
