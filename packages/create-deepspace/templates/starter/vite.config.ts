import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import generouted from '@generouted/react-router/plugin'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    generouted(),
    // Single-process dev: HMR + worker in one. Not needed for build —
    // deploy bundles the worker separately with esbuild.
    ...(command === 'serve' ? [cloudflare()] : []),
  ],
  resolve: {
    dedupe: ['react', 'react-dom', 'better-auth'],
  },
}))
