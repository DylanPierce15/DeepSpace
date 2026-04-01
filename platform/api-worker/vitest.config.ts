import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          bindings: {
            AUTH_JWT_PUBLIC_KEY: 'test-public-key',
            AUTH_JWT_ISSUER: 'https://auth.test.deep.space',
            STRIPE_SECRET_KEY: 'sk_test_fake',
            STRIPE_WEBHOOK_SECRET: 'whsec_test_fake',
            STRIPE_PUBLISHABLE_KEY: 'pk_test_fake',
            OPENAI_API_KEY: 'sk-test-fake',
            FREEPIK_API_KEY: 'fpk-test-fake',
            SERPAPI_API_KEY: 'serp-test-fake',
          },
        },
      },
    },
  },
})
