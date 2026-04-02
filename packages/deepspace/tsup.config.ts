import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    external: [
      'react', 'react-dom', 'react/jsx-runtime',
      'better-auth', 'better-auth/react', 'better-auth/client/plugins',
      'jose', 'yjs', 'hono', 'zustand',
    ],
    esbuildOptions(options) {
      options.jsx = 'automatic'
    },
  },
  {
    entry: { worker: 'src/worker.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    external: [
      'better-auth', 'better-auth/plugins',
      'jose', 'yjs', 'hono',
      /^cloudflare:.*/, /^node:.*/,
    ],
  },
  {
    entry: { cli: 'src/cli/cli.ts' },
    format: ['esm'],
    sourcemap: true,
    external: ['citty', '@clack/prompts', /^node:.*/],
    banner: { js: '#!/usr/bin/env node' },
  },
])
