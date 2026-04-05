import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api/auth': {
        target: 'http://localhost:8794',
        changeOrigin: true,
      },
      '/api/apps': {
        target: 'http://localhost:8796',
        changeOrigin: true,
      },
      '/api/deploy': {
        target: 'http://localhost:8796',
        changeOrigin: true,
      },
      '/api/users': {
        target: 'http://localhost:8795',
        changeOrigin: true,
      },
      '/api/usage': {
        target: 'http://localhost:8795',
        changeOrigin: true,
      },
      '/api/stripe': {
        target: 'http://localhost:8795',
        changeOrigin: true,
      },
    },
  },
})
