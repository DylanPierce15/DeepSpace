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

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: {
        bindings: {
          AUTH_JWT_PUBLIC_KEY: devVars.AUTH_JWT_PUBLIC_KEY || 'test-public-key',
          AUTH_JWT_ISSUER: devVars.AUTH_JWT_ISSUER || 'https://auth.test.deep.space',
          STRIPE_SECRET_KEY: devVars.STRIPE_SECRET_KEY || 'sk_test_fake',
          STRIPE_WEBHOOK_SECRET: devVars.STRIPE_WEBHOOK_SECRET || 'whsec_test_fake',
          STRIPE_PUBLISHABLE_KEY: devVars.STRIPE_PUBLISHABLE_KEY || 'pk_test_fake',
          OPENAI_API_KEY: devVars.OPENAI_API_KEY || 'sk-test-fake',
          FREEPIK_API_KEY: devVars.FREEPIK_API_KEY || 'fpk-test-fake',
          SERPAPI_API_KEY: devVars.SERPAPI_API_KEY || 'serp-test-fake',
          OPENWEATHER_API_KEY: devVars.OPENWEATHER_API_KEY || 'owm-test-fake',
          NASA_API_KEY: devVars.NASA_API_KEY || 'nasa-test-fake',
          EXA_API_KEY: devVars.EXA_API_KEY || 'exa-test-fake',
          NEWS_API_KEY: devVars.NEWS_API_KEY || 'news-test-fake',
        },
      },
    }),
  ],
})
