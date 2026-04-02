import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: {
        bindings: {
          BETTER_AUTH_SECRET: 'test-better-auth-secret-at-least-32-chars-long',
          AUTH_BASE_URL: 'https://auth.test.deep.space',
          JWT_PRIVATE_KEY: 'placeholder-es256-private-key',
        },
      },
    }),
  ],
})
