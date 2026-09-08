import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the site under /<repo>/, so the deploy workflow sets BASE_PATH=/TextQR/.
// Local dev and preview stay at the root.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'TextQR',
        short_name: 'TextQR',
        description: 'Convert text to QR codes and back, entirely on your device.',
        theme_color: '#2563eb',
        background_color: '#f6f7f9',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache everything the app needs offline, including the 1 MB decoder wasm.
        globPatterns: ['**/*.{js,css,html,wasm,svg,png,ico,webmanifest}'],
      },
    }),
  ],
})
