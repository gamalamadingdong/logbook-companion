/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { c2DataSaverPlugin } from './vite-plugins/c2-data-saver'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), c2DataSaverPlugin()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
