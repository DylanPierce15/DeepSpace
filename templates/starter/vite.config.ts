import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    proxy: {
      // Auth proxy — same as worker.ts app.all('/api/auth/*')
      '/api/auth': {
        target: 'http://localhost:8794',
        changeOrigin: true,
      },
      // Platform proxy — same as worker.ts app.all('/platform/*')
      '/platform': {
        target: 'http://localhost:8792',
        changeOrigin: true,
        ws: true,
      },
      // WebSocket proxy — same as worker.ts app.get('/ws/:roomId')
      '/ws': {
        target: 'http://localhost:8792',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
