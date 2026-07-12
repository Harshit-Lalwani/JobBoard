import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
      // Uploaded resumes are served by the backend's express.static('/uploads') — without this,
      // the dev server falls back to the SPA's index.html for any /uploads/* request instead of
      // forwarding it, since it only knows about /api by default.
      '/uploads': 'http://localhost:4000',
    },
  },
})
