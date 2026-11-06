import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// BASE_PATH lets the same build run at a sub-folder (GitHub Pages: /comrade/). Default: site root.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { host: true },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
