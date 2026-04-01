import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        main: './src/worker.ts',
        miniflare: {
          compatibilityDate: '2024-12-01',
          compatibilityFlags: ['nodejs_compat'],
          bindings: {
            INTERNAL_STORAGE_HMAC_SECRET: 'test-hmac-secret',
          },
          kvNamespaces: ['HOSTNAME_MAP', 'CRON_TASKS'],
        },
      },
    },
  },
})
