import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative base so the same build works both at the domain root (Netlify) and
  // under a sub-path (GitHub Pages: /world-cup-viewer/).
  base: './',
  plugins: [react()],
  build: {
    // Two apps, one deploy: the World Cup tracker at the root and the Champions
    // League tracker at /ucl/ (its own page, manifest and home-screen icon).
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ucl: resolve(__dirname, 'ucl/index.html'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.js'],
    coverage: {
      provider: 'v8',
      all: true, // count untested files too, so the badge isn't flattered
      include: ['src/**'],
      exclude: ['src/main.jsx', 'src/ucl/main.jsx', 'src/**/*.test.{js,jsx}'],
      reporter: ['text-summary', 'json-summary'],
    },
  },
})
