// Bounded manual read-sync. Never follows provider-supplied pagination URLs.
import { PROVIDER, type Dependencies } from './handler.ts';
export type DevelopmentResult = {
  id: number; date: string; type: string; distance: number; time: number;
};
export function parseResults(payload: unknown, page: number) {
  const value = payload as { data?: unknown; meta?: { pagination?: { current_page?: unknown; total_pages?: unknown } } };
  if (!value || !Array.isArray(value.data) || value.data.length > 25) throw new Error('Invalid results');
  const results: DevelopmentResult[] = value.data.map(row => {
    if (!row || !Number.isSafeInteger(row.id) || row.id <= 0 ||
      typeof row.date !== 'string' || row.date.length > 64 || !/^\d{4}-\d{2}-\d{2}/.test(row.date) ||
      typeof row.type !== 'string' || row.type.length > 40 ||
      typeof row.distance !== 'number' || !Number.isFinite(row.distance) || row.distance < 0 ||
      typeof row.time !== 'number' || !Number.isFinite(row.time) || row.time < 0) throw new Error('Invalid result');
    // C2 time is tenths of seconds. Preserve native units, not rounded seconds.
    return { id: row.id, date: row.date, type: row.type, distance: row.distance, time: row.time };
  });
  if (new Set(results.map(row => row.id)).size !== results.length) throw new Error('Duplicate IDs');
  const pagination = value.meta?.pagination;
  if (pagination && (!Number.isSafeInteger(pagination.total_pages) || Number(pagination.total_pages) < 0 ||
    pagination.current_page !== page || Number(pagination.total_pages) < page && results.length > 0)) throw new Error('Invalid pagination');
  // Without metadata a full page means there may be another; an empty page ends it.
  return { results, next_page: pagination ? (page < Number(pagination.total_pages) ? page + 1 : null)
    : (results.length === 25 ? page + 1 : null) };
}
export async function developmentResults(deps: Dependencies, user: string, action: string, page: unknown) {
  if (!deps.syncOperation) throw new Error('Development import unavailable');
  const number = page ?? 1;
  if (!Number.isSafeInteger(number) || Number(number) < 1 || Number(number) > 100000) throw new Error('Invalid page');
  if (action === 'results') return deps.syncOperation(user, 'list', { page: number });
  const claim = await deps.syncOperation(user, 'claim');
  const values = { operation_id: claim.operation_id };
  try {
    const response = await deps.fetch(`${PROVIDER}/api/users/me/results?number=25&page=${number}`, {
      headers: { Authorization: `Bearer ${claim.access_token}`, Accept: 'application/vnd.c2logbook.v1+json' },
      redirect: 'error', signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 401) {
      await deps.syncOperation(user, 'unauthorized', values);
      throw new Error('Check / refresh connection before importing again.');
    }
    if (!response.ok) throw new Error('Provider read failed');
    const parsed = parseResults(await response.json(), Number(number));
    const saved = await deps.syncOperation(user, 'save', { ...values, results: parsed.results });
    return { ...saved, next_page: parsed.next_page };
  } catch {
    // A GET has no rotating credential side effect. Fenced release cannot unlock
    // a newer operation, even if an ambiguous DB save actually committed.
    await deps.syncOperation(user, 'release', values).catch(() => undefined);
    throw new Error('Development import failed. Check / refresh connection and retry this page.');
  }
}

// Read one known provider result after a successful POST. The caller supplies only
// its numeric ID; provider URLs, credentials, and result ownership stay server-side.
export async function developmentReadResult(deps: Dependencies, user: string, resultId: number) {
  if (!deps.syncOperation || !Number.isSafeInteger(resultId) || resultId <= 0) throw new Error('Invalid result ID');
  const claim = await deps.syncOperation(user, 'claim');
  const values = { operation_id: claim.operation_id };
  try {
    const response = await deps.fetch(`${PROVIDER}/api/users/me/results/${resultId}`, {
      headers: { Authorization: `Bearer ${claim.access_token}`, Accept: 'application/vnd.c2logbook.v1+json' },
      redirect: 'error', signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 401) {
      await deps.syncOperation(user, 'unauthorized', values);
      throw new Error('Refresh the development connection before checking this result.');
    }
    if (!response.ok) throw new Error('Provider read failed');
    const payload = await response.json();
    const parsed = parseResults({ data: [payload?.data ?? payload] }, 1);
    if (parsed.results.length !== 1 || parsed.results[0].id !== resultId) throw new Error('Result ID mismatch');
    const saved = await deps.syncOperation(user, 'save', { ...values, results: parsed.results });
    return { ...saved, result_id: resultId };
  } catch {
    await deps.syncOperation(user, 'release', values).catch(() => undefined);
    throw new Error('Could not read back this development result. Retry its exact ID; do not publish again.');
  }
}
