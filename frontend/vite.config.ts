import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Task Graph',
        short_name: 'Tasks',
        description: 'Tasks as sequences: see only what you can do next.',
        start_url: '/',
        display: 'standalone',
        theme_color: '#4f6bed',
        background_color: '#f7f7f9',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Android: "Share → Tasks" from any app opens /share prefilled (see views/Share handling in App).
        share_target: {
          action: '/share',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
        shortcuts: [{ name: 'Capture a task', short_name: 'Capture', url: '/#inbox' }],
      },
      workbox: {
        navigateFallback: 'index.html',
        // API responses are never cached: tasks must always be fresh.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': process.env.TASKGRAPH_API ?? 'http://127.0.0.1:8000',
    },
  },
})
