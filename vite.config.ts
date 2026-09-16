/// <reference types="vitest" />
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { c2DataSaverPlugin } from './vite-plugins/c2-data-saver'

// Custom targets and staging branches can never opt into the legacy production route.
const legacyProduction = process.env.VERCEL_ENV === 'production'
  && (!process.env.VERCEL_TARGET_ENV || process.env.VERCEL_TARGET_ENV === 'production')
  && (!process.env.VERCEL_GIT_COMMIT_REF || process.env.VERCEL_GIT_COMMIT_REF === 'main');

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), c2DataSaverPlugin()],
  define: {
    __C2_LEGACY_PRODUCTION__: JSON.stringify(legacyProduction),
    // Even accidentally inherited production VITE credentials must not enter staging bundles.
    ...(legacyProduction ? {} : {
      'import.meta.env.VITE_CONCEPT2_CLIENT_SECRET': JSON.stringify(''),
      'import.meta.env.VITE_CONCEPT2_CLIENT_ID': JSON.stringify(''),
    }),
  },
  resolve: {
    alias: {
      '@readyall/rwn': fileURLToPath(new URL('./packages/rwn/src/index.ts', import.meta.url)),
    },
  },
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
