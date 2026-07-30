import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT || 5173),
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})
