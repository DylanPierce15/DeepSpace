/**
 * Unit tests for pricing math and per-provider usage extraction.
 *
 * These are pure-function tests with no DB / network — they exercise the
 * cache-token bookkeeping that's hard to cover via the integration tests
 * without a mock upstream.
 */

import { describe, it, expect } from 'vitest'
import {
  calculateTokenCost,
  totalUsageTokens,
  extractAnthropicUsage,
  extractAnthropicStreamingUsage,
  extractOpenAIUsage,
  extractOpenAIStreamingUsage,
} from '../routes/proxy-pricing'

describe('calculateTokenCost', () => {
  it('Anthropic Sonnet: applies discounted cache_read and marked-up cache_write rates', () => {
    // claude-sonnet-4-20250514 pricing:
    //   input  $3/MTok    output $15/MTok
    //   read   $0.30/MTok write  $3.75/MTok
    const cost = calculateTokenCost({
      model: 'claude-sonnet-4-20250514',
      inputTokens: 1000,
      cacheReadTokens: 1000,
      cacheWriteTokens: 1000,
      outputTokens: 1000,
    })
    // 1000 * (3 + 0.30 + 3.75 + 15) / 1_000_000 = 0.02205
    expect(cost).toBeCloseTo(0.02205, 10)
  })

  it('OpenAI gpt-4o: applies cached_input rate (50% of input)', () => {
    // gpt-4o pricing:
    //   input  $2.50/MTok output $10/MTok cached $1.25/MTok
    const cost = calculateTokenCost({
      model: 'gpt-4o',
      inputTokens: 100,        // non-cached portion
      cacheReadTokens: 900,    // cached portion (cheaper)
      cacheWriteTokens: 0,
      outputTokens: 500,
    })
    // 100*$2.50 + 900*$1.25 + 500*$10 per 1M =
    //   (250 + 1125 + 5000) / 1_000_000 = 0.006375
    expect(cost).toBeCloseTo(0.006375, 10)
  })

  it('unknown model: falls back to most-expensive default and treats cache rates as full input', () => {
    // DEFAULT_PRICING is Opus rates: $15/$75 per MTok, no cache discount
    const cost = calculateTokenCost({
      model: 'made-up-model-9000',
      inputTokens: 1000,
      cacheReadTokens: 1000,
      cacheWriteTokens: 0,
      outputTokens: 0,
    })
    // 2000 * $15/MTok = 0.03 (no discount applied to unknown models)
    expect(cost).toBeCloseTo(0.03, 10)
  })

  it('zero usage returns zero cost', () => {
    const cost = calculateTokenCost({
      model: 'claude-haiku-4-5-20251001',
      inputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 0,
    })
    expect(cost).toBe(0)
  })
})

describe('totalUsageTokens', () => {
  it('sums all four token classes', () => {
    expect(
      totalUsageTokens({
        model: 'claude-sonnet-4-20250514',
        inputTokens: 100,
        cacheReadTokens: 200,
        cacheWriteTokens: 300,
        outputTokens: 400,
      }),
    ).toBe(1000)
  })
})

describe('extractAnthropicUsage', () => {
  it('reads input/output and the two cache categories from a Messages API response', () => {
    const usage = extractAnthropicUsage({
      model: 'claude-sonnet-4-20250514',
      usage: {
        input_tokens: 25,
        output_tokens: 42,
        cache_creation_input_tokens: 100,
        cache_read_input_tokens: 800,
      },
    })
    expect(usage).toEqual({
      model: 'claude-sonnet-4-20250514',
      inputTokens: 25,
      cacheReadTokens: 800,
      cacheWriteTokens: 100,
      outputTokens: 42,
    })
  })

  it('handles a response with no cache fields (caching disabled)', () => {
    const usage = extractAnthropicUsage({
      model: 'claude-haiku-4-5-20251001',
      usage: { input_tokens: 10, output_tokens: 5 },
    })
    expect(usage.cacheReadTokens).toBe(0)
    expect(usage.cacheWriteTokens).toBe(0)
  })
})

describe('extractAnthropicStreamingUsage', () => {
  it('captures input + cache fields from message_start and final output_tokens from message_delta', () => {
    const sse = [
      'event: message_start',
      'data: {"type":"message_start","message":{"id":"x","model":"claude-sonnet-4-20250514","usage":{"input_tokens":25,"output_tokens":1,"cache_creation_input_tokens":50,"cache_read_input_tokens":900}}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}',
      '',
      'event: message_delta',
      'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":42}}',
      '',
      'event: message_stop',
      'data: {"type":"message_stop"}',
      '',
    ].join('\n')

    const usage = extractAnthropicStreamingUsage(sse)
    expect(usage).toEqual({
      model: 'claude-sonnet-4-20250514',
      inputTokens: 25,
      cacheReadTokens: 900,
      cacheWriteTokens: 50,
      outputTokens: 42,
    })
  })
})

describe('extractOpenAIUsage', () => {
  it('splits prompt_tokens into cached + non-cached using prompt_tokens_details', () => {
    const usage = extractOpenAIUsage({
      model: 'gpt-4o',
      usage: {
        prompt_tokens: 1000,
        completion_tokens: 200,
        total_tokens: 1200,
        prompt_tokens_details: { cached_tokens: 800 },
      },
    })
    expect(usage).toEqual({
      model: 'gpt-4o',
      inputTokens: 200,        // 1000 - 800
      cacheReadTokens: 800,
      cacheWriteTokens: 0,
      outputTokens: 200,
    })
  })

  it('treats prompt_tokens as fully non-cached when prompt_tokens_details is absent', () => {
    const usage = extractOpenAIUsage({
      model: 'gpt-4o-mini',
      usage: { prompt_tokens: 50, completion_tokens: 25 },
    })
    expect(usage.inputTokens).toBe(50)
    expect(usage.cacheReadTokens).toBe(0)
  })
})

describe('extractOpenAIStreamingUsage', () => {
  it('reads usage from the final pre-DONE chunk and ignores null usage on intermediate chunks', () => {
    // OpenAI streams emit `usage: null` on every chunk except the final one
    // (when stream_options.include_usage is set). Make sure we don't get
    // confused by the nulls.
    const sse = [
      'data: {"id":"x","model":"gpt-4o","choices":[{"delta":{"content":"Hi"}}],"usage":null}',
      '',
      'data: {"id":"x","model":"gpt-4o","choices":[{"delta":{"content":" there"}}],"usage":null}',
      '',
      'data: {"id":"x","model":"gpt-4o","choices":[],"usage":{"prompt_tokens":1000,"completion_tokens":50,"prompt_tokens_details":{"cached_tokens":700}}}',
      '',
      'data: [DONE]',
      '',
    ].join('\n')

    const usage = extractOpenAIStreamingUsage(sse)
    expect(usage).toEqual({
      model: 'gpt-4o',
      inputTokens: 300,
      cacheReadTokens: 700,
      cacheWriteTokens: 0,
      outputTokens: 50,
    })
  })

  it('returns zero usage when no usage chunk arrives (stream_options.include_usage was not set)', () => {
    // This is the silent-billing-leak case the deepspace SDK guards against
    // by passing compatibility:'strict' / includeUsage:true. If a client
    // hits the proxy directly without that flag, we end up here.
    const sse = [
      'data: {"id":"x","model":"gpt-4o","choices":[{"delta":{"content":"Hi"}}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n')

    const usage = extractOpenAIStreamingUsage(sse)
    expect(usage.inputTokens).toBe(0)
    expect(usage.outputTokens).toBe(0)
  })
})
