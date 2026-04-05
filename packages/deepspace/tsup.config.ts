import { defineConfig } from 'tsup'
import { resolve } from 'path'

const alias = { '@': resolve(__dirname, 'src') }

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
      'lucide-react', 'framer-motion', 'react-router-dom',
      'class-variance-authority', 'clsx', 'tailwind-merge',
      /^@radix-ui\/.*/,
    ],
    esbuildOptions(options) {
      options.jsx = 'automatic'
      options.alias = alias
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
    esbuildOptions(options) {
      options.alias = alias
    },
  },
  {
    entry: { cli: 'src/cli/cli.ts' },
    format: ['esm'],
    sourcemap: true,
    external: ['citty', '@clack/prompts', /^node:.*/],
    banner: { js: '#!/usr/bin/env node' },
    esbuildOptions(options) {
      options.alias = alias
    },
  },
])
