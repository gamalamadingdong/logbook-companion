// Set from Vercel's server-owned deployment metadata, not a VITE toggle.
declare const __C2_LEGACY_PRODUCTION__: boolean;
export const legacyConcept2Enabled = typeof __C2_LEGACY_PRODUCTION__ !== 'undefined' && __C2_LEGACY_PRODUCTION__;
export const DEVELOPMENT_SYNC_DISABLED = 'Development Concept2 sync is disabled until workout storage and jobs are environment-isolated.';
export function requireProductionConcept2() {
  if (!legacyConcept2Enabled) throw new Error(DEVELOPMENT_SYNC_DISABLED);
}

// Defense in depth for shared-Supabase staging. This is an application guard,
// not an RLS/security boundary against a hostile authenticated database client.
export function blockedDevelopmentRequest(url: string, method: string) {
  const path = new URL(url).pathname;
  if (/\/rest\/v1\/(user_integrations|c2_sync_jobs|c2_sync_job_items)(\/|$)/.test(path)) return true;
  if (/\/functions\/v1\/(start-c2-sync|run-c2-sync-batch|publish-to-c2)(\/|$)/.test(path)) return true;
  return method.toUpperCase() !== 'GET' && /\/rest\/v1\/(workout_logs|workout_structure|workout_power_buckets)(\/|$)/.test(path);
}
