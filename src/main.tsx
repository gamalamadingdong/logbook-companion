import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { hasSupabaseEnv, missingSupabaseEnvVars } from './services/supabase'

const storedTheme = localStorage.getItem('logbook_theme_preference');
const isThemePreference = storedTheme === 'dark' || storedTheme === 'light' || storedTheme === 'system';
const initialPreference = isThemePreference ? storedTheme : 'dark';
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const initialTheme = initialPreference === 'system'
  ? (prefersDark ? 'dark' : 'light')
  : initialPreference;

document.documentElement.classList.toggle('dark', initialTheme === 'dark');
document.documentElement.classList.toggle('light', initialTheme === 'light');
document.documentElement.style.colorScheme = initialTheme;

if (import.meta.env.PROD) {
  const manifestLink = document.createElement('link');
  manifestLink.rel = 'manifest';
  manifestLink.href = '/manifest.json';
  document.head.appendChild(manifestLink);
}

function MissingEnvScreen() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">Local setup required</p>
        <h1 className="mt-3 text-3xl font-semibold">Supabase environment variables are missing.</h1>
        <p className="mt-4 text-sm leading-6 text-slate-300">
          The app cannot connect to its backend until the required Vite env vars are present in a local
          <code className="mx-1 rounded bg-slate-800 px-1.5 py-0.5 text-slate-100">.env</code>
          file.
        </p>
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Missing: {missingSupabaseEnvVars.join(', ')}
        </div>
        <div className="mt-6 rounded-xl bg-slate-950 p-4">
          <p className="mb-3 text-sm font-medium text-slate-200">Add this to <code>.env</code>:</p>
          <pre className="overflow-x-auto text-sm leading-6 text-emerald-300">
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
          </pre>
        </div>
        <p className="mt-6 text-xs leading-5 text-slate-400">
          The manifest CORS error from the dev tunnel is unrelated. This patch disables manifest loading in local
          development so the real setup issue is easier to see.
        </p>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {hasSupabaseEnv ? <App /> : <MissingEnvScreen />}
  </StrictMode>,
)
