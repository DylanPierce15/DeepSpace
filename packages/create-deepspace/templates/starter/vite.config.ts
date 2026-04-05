import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  resolve: {
    dedupe: ['react', 'react-dom', 'better-auth'],
  },
  server: {
    proxy: {
      // All API and WebSocket routes → app worker (running via wrangler dev)
      '/api': {
        target: 'http://localhost:8780',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:8780',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
