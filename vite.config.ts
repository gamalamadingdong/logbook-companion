/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { c2DataSaverPlugin } from './vite-plugins/c2-data-saver'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), c2DataSaverPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('recharts')) return 'vendor-recharts';
          if (id.includes('react-datepicker')) return 'vendor-datepicker';
          if (id.includes('html2canvas') || id.includes('jspdf') || id.includes('xlsx')) return 'vendor-export';
          if (id.includes('@supabase')) return 'vendor-supabase';
          return 'vendor';
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
