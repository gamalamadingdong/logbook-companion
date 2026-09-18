// Set from Vercel's server-owned deployment metadata, not a VITE toggle.
declare const __C2_LEGACY_PRODUCTION__: boolean;
export const legacyConcept2Enabled = typeof __C2_LEGACY_PRODUCTION__ !== 'undefined' && __C2_LEGACY_PRODUCTION__;
export const DEVELOPMENT_SYNC_DISABLED = 'Legacy Concept2 sync is disabled in staging. Use the isolated development import on the Sync page.';
export function requireProductionConcept2() {
  if (!legacyConcept2Enabled) throw new Error(DEVELOPMENT_SYNC_DISABLED);
}

// Defense in depth for shared-Supabase staging. This is an application guard,
// not an RLS/security boundary against a hostile authenticated database client.
function isGeneralManualWorkoutWrite(url: URL, method: string, body: BodyInit | null | undefined): boolean {
  if ((method !== 'POST' && method !== 'PATCH') || typeof body !== 'string') return false;
  let payload: unknown;
  try { payload = JSON.parse(body); } catch { return false; }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const row = payload as Record<string, unknown>;
  if (row.source !== 'manual' || 'external_id' in row || 'c2_published_at' in row) return false;
  if (!row.raw_data || typeof row.raw_data !== 'object' || Array.isArray(row.raw_data)) return false;
  const raw = row.raw_data as Record<string, unknown>;
  if (raw.source !== 'general_manual_entry') return false;
  if (!raw.completed_result || typeof raw.completed_result !== 'object' || Array.isArray(raw.completed_result)
    || (raw.completed_result as Record<string, unknown>)._v !== 1) return false;
  if (method === 'POST') return typeof row.user_id === 'string' && row.user_id.length > 0;
  const filters = url.searchParams;
  return filters.get('id')?.startsWith('eq.') === true
    && filters.get('user_id')?.startsWith('eq.') === true
    && filters.get('source') === 'eq.manual'
    && filters.get('raw_data')?.includes('general_manual_entry') === true;
}

export function blockedDevelopmentRequest(url: string, method: string, body?: BodyInit | null) {
  const requestUrl = new URL(url);
  const path = requestUrl.pathname;
  const verb = method.toUpperCase();
  if (/\/rest\/v1\/(user_integrations|c2_sync_jobs|c2_sync_job_items)(\/|$)/.test(path)) return true;
  if (/\/functions\/v1\/(start-c2-sync|run-c2-sync-batch|publish-to-c2)(\/|$)/.test(path)) return true;
  if (verb === 'GET') return false;
  if (/\/rest\/v1\/workout_logs(\/|$)/.test(path))
    return !isGeneralManualWorkoutWrite(requestUrl, verb, body);
  return /\/rest\/v1\/(workout_structure|workout_power_buckets)(\/|$)/.test(path);
}
