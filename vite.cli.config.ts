import { defineConfig } from 'vite'

// Bundles the command-line tool. The web app has its own config in vite.config.ts.
export default defineConfig({
  build: {
    ssr: 'cli/textqr.ts',
    outDir: 'dist-cli',
    emptyOutDir: true,
    target: 'node20',
    minify: false,
    sourcemap: false,
    rollupOptions: {
      external: ['qrcode', 'zxing-wasm', 'zxing-wasm/reader'],
      output: {
        entryFileNames: 'textqr.js',
        banner: '#!/usr/bin/env node',
      },
    },
  },
})
