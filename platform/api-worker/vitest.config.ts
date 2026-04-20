import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Load real API keys from .dev.vars (synced from Doppler) for integration tests.
// Falls back to fake values for unit tests that don't hit external APIs.
function loadDevVars(): Record<string, string> {
  try {
    const content = readFileSync(resolve(__dirname, '.dev.vars'), 'utf-8')
    const vars: Record<string, string> = {}
    for (const line of content.split('\n')) {
      const idx = line.indexOf('=')
      if (idx > 0) vars[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
    }
    return vars
  } catch {
    return {}
  }
}

const devVars = loadDevVars()

// Test ES256 key pair — used for signing JWTs in integration tests.
// The corresponding private key is in test-helpers.ts.
const TEST_JWT_PUBLIC_KEY = [
  '-----BEGIN PUBLIC KEY-----',
  'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEHdCNTlzfguOe6KiVagYksU5ZTrQ2',
  '9qMZbXQJesZQOsFR7tdd4qSBuVzv+ZhxOdYmDwGbcCyA+9gdTpdqqFxEOw==',
  '-----END PUBLIC KEY-----',
].join('\n')

const TEST_JWT_ISSUER = 'https://auth.test.deep.space'

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: {
        bindings: {
          // Always use the test key pair so test-helpers.ts can sign valid JWTs
          AUTH_JWT_PUBLIC_KEY: TEST_JWT_PUBLIC_KEY,
          AUTH_JWT_ISSUER: TEST_JWT_ISSUER,
          STRIPE_SECRET_KEY: devVars.STRIPE_SECRET_KEY || 'sk_test_fake',
          STRIPE_WEBHOOK_SECRET: devVars.STRIPE_WEBHOOK_SECRET || 'whsec_test_fake',
          STRIPE_PUBLISHABLE_KEY: devVars.STRIPE_PUBLISHABLE_KEY || 'pk_test_fake',
          STRIPE_STARTER_MONTHLY_PRICE_ID: devVars.STRIPE_STARTER_MONTHLY_PRICE_ID || 'price_test_starter',
          STRIPE_PREMIUM_MONTHLY_PRICE_ID: devVars.STRIPE_PREMIUM_MONTHLY_PRICE_ID || 'price_test_premium',
          STRIPE_PAY_PER_CREDIT_PRICE_ID: devVars.STRIPE_PAY_PER_CREDIT_PRICE_ID || 'price_test_credit',
          OPENAI_API_KEY: devVars.OPENAI_API_KEY || 'sk-test-fake',
          FREEPIK_API_KEY: devVars.FREEPIK_API_KEY || 'fpk-test-fake',
          SERPAPI_API_KEY: devVars.SERPAPI_API_KEY || 'serp-test-fake',
          OPENWEATHER_API_KEY: devVars.OPENWEATHER_API_KEY || 'owm-test-fake',
          NASA_API_KEY: devVars.NASA_API_KEY || 'nasa-test-fake',
          EXA_API_KEY: devVars.EXA_API_KEY || 'exa-test-fake',
          NEWS_API_KEY: devVars.NEWS_API_KEY || 'news-test-fake',
          YOUTUBE_API_KEY: devVars.YOUTUBE_API_KEY || 'yt-test-fake',
          GITHUB_TOKEN: devVars.GITHUB_TOKEN || 'gh-test-fake',
          ANTHROPIC_API_KEY: devVars.ANTHROPIC_API_KEY || 'ant-test-fake',
          FINNHUB_API_KEY: devVars.FINNHUB_API_KEY || 'finn-test-fake',
          ALPHA_VANTAGE_API_KEY: devVars.ALPHA_VANTAGE_API_KEY || 'av-test-fake',
          ELEVENLABS_API_KEY: devVars.ELEVENLABS_API_KEY || 'el-test-fake',
          FIRECRAWL_API_KEY: devVars.FIRECRAWL_API_KEY || 'fc-test-fake',
          API_SPORTS_KEY: devVars.API_SPORTS_KEY || 'sports-test-fake',
          CLOUDCONVERT_API_KEY: devVars.CLOUDCONVERT_API_KEY || 'cc-test-fake',
          GEMINI_API_KEY: devVars.GEMINI_API_KEY || 'gem-test-fake',
          RESEND_API_KEY: devVars.RESEND_API_KEY || 'resend-test-fake',
          LATEX_COMPILER_URL: devVars.LATEX_COMPILER_URL || 'http://localhost:2345',
          TIKTOK_API_KEY: devVars.TIKTOK_API_KEY || 'tt-test-fake',
          SUBMAGIC_API_KEY: devVars.SUBMAGIC_API_KEY || 'sm-test-fake',
          LIVEKIT_API_KEY: devVars.LIVEKIT_API_KEY || 'lk-test-fake',
          LIVEKIT_API_SECRET: devVars.LIVEKIT_API_SECRET || 'lk-secret-test-fake',
          LIVEKIT_URL: devVars.LIVEKIT_URL || 'wss://test.livekit.cloud',
          GOOGLE_CLIENT_ID: devVars.GOOGLE_CLIENT_ID || 'google-test-fake',
          GOOGLE_CLIENT_SECRET: devVars.GOOGLE_CLIENT_SECRET || 'google-secret-test-fake',
        },
      },
    }),
  ],
})
