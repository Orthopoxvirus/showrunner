import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { dataBridge } from './plugins/data-bridge'

export default defineConfig({
  // relative base + single-file output: browsers refuse external ES modules on
  // file://, so the standalone build inlines everything into one index.html
  // that works double-clicked.
  base: './',
  plugins: [react(), dataBridge(), viteSingleFile()],
  server: { port: 5199 },
  preview: { port: 5199 },
  build: { chunkSizeWarningLimit: 900 },
})
