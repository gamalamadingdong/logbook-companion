/// <reference types="vite/client" />

export {};

declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_TURNSTILE_SITE_KEY?: string;
    readonly VITE_LC_BUILD_SHA: string;
    readonly VITE_LC_BUILD_MODE: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
