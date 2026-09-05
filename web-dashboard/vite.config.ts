import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const prerenderPlugin = require('./scripts/prerender-plugin.js').default

export default defineConfig({
  plugins: [react(), prerenderPlugin()],
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'https://api.aicontextbrain.me',
        changeOrigin: true,
      }
    }
  }
})
