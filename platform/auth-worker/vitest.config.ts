import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          bindings: {
            BETTER_AUTH_SECRET: 'test-better-auth-secret-at-least-32-chars-long',
            AUTH_BASE_URL: 'https://auth.test.deep.space',
            // ES256 private key PEM — placeholder; tests that need real signing
            // should use @deep-space/test-utils/jwt to generate a key pair at runtime.
            JWT_PRIVATE_KEY: 'placeholder-es256-private-key',
          },
        },
      },
    },
  },
})
