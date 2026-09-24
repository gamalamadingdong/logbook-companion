/// <reference types="vitest" />
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { c2DataSaverPlugin } from './vite-plugins/c2-data-saver'

// Custom targets and staging branches can never opt into the legacy production route.
const legacyProduction = process.env.VERCEL_ENV === 'production'
  && (!process.env.VERCEL_TARGET_ENV || process.env.VERCEL_TARGET_ENV === 'production')
  && (!process.env.VERCEL_GIT_COMMIT_REF || process.env.VERCEL_GIT_COMMIT_REF === 'main');

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const buildEnv = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  if (mode === 'mobile' && (!buildEnv.VITE_SUPABASE_URL || !buildEnv.VITE_SUPABASE_ANON_KEY)) {
    throw new Error('Mobile builds require VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  return {
  plugins: [react(), c2DataSaverPlugin()],
  define: {
    __C2_LEGACY_PRODUCTION__: JSON.stringify(legacyProduction && mode !== 'mobile'),
    'import.meta.env.VITE_LC_BUILD_SHA': JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'local'),
    'import.meta.env.VITE_LC_BUILD_MODE': JSON.stringify(mode),
    // Even accidentally inherited production VITE credentials must not enter staging bundles.
    ...(legacyProduction && mode !== 'mobile' ? {} : {
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
  };
})
