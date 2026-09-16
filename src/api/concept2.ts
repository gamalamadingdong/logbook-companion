import { legacyConcept2Enabled, DEVELOPMENT_SYNC_DISABLED } from '../services/concept2Environment';

// The production module (including browser refresh credentials) is excluded from
// development builds, not merely protected by an interceptor at runtime.
const loadProduction = legacyConcept2Enabled ? () => import('./concept2Legacy') : null;
async function production() {
  if (!loadProduction) throw new Error(DEVELOPMENT_SYNC_DISABLED);
  return loadProduction();
}
export async function getProfile() { return (await production()).getProfile(); }
export async function getResults(userId: number | string = 'me', page?: number, params: Record<string, string | number> = {}) {
  return (await production()).getResults(userId, page, params);
}
export async function getResultDetail(resultId: number) { return (await production()).getResultDetail(resultId); }
export async function getStrokes(resultId: number) { return (await production()).getStrokes(resultId); }
