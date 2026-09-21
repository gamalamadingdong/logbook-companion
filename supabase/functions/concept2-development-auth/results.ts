// Bounded manual read-sync. Never follows provider-supplied pagination URLs.
import { PROVIDER, type Dependencies } from './handler.ts';
export type DevelopmentResult = {
  id: number; date: string; type: string; distance: number; time: number;
  workout?: { splits?: Record<string, unknown>[]; intervals?: Record<string, unknown>[] };
  stroke_data?: Record<string, number>[];
  verified?: boolean; ranked?: boolean;
  rest_distance?: number; rest_time?: number; stroke_rate?: number; stroke_count?: number;
  calories_total?: number; wattminutes_total?: number; drag_factor?: number;
};

export type DevelopmentProjectionComparison = {
  matches: boolean;
  differences: string[];
};

function optionalInteger(row: Record<string, unknown>, key: string): number | undefined {
  const value = row[key];
  if (value === undefined || value === null) return undefined;
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(`Invalid ${key}`);
  return Number(value);
}

function detailRows(value: unknown, limit: number, keys: string[]): Record<string, unknown>[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length > limit) throw new Error('Invalid result detail');
  return value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid result detail row');
    const row = item as Record<string, unknown>;
    for (const key of keys) optionalInteger(row, key);
    if (row.type !== undefined && !['time', 'distance', 'calorie', 'wattminute'].includes(String(row.type))) {
      throw new Error('Invalid interval type');
    }
    return Object.fromEntries(Object.entries(row).filter(([key]) => keys.includes(key) || key === 'type'));
  });
}
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
    const raw = row as Record<string, unknown>;
    const workoutValue = raw.workout as Record<string, unknown> | undefined;
    const splits = detailRows(workoutValue?.splits, 100, ['distance', 'time', 'stroke_rate', 'calories_total', 'wattminutes_total']);
    const intervals = detailRows(workoutValue?.intervals, 100, ['distance', 'time', 'stroke_rate', 'calories_total', 'wattminutes_total', 'rest_time', 'rest_distance']);
    const strokeData = detailRows(raw.strokes ?? raw.stroke_data, 5000, ['t', 'd', 'p', 'spm', 'hr']) as Record<string, number>[] | undefined;
    if (raw.verified !== undefined && typeof raw.verified !== 'boolean') throw new Error('Invalid verified state');
    if (raw.ranked !== undefined && typeof raw.ranked !== 'boolean') throw new Error('Invalid ranked state');
    const optional = Object.fromEntries([
      'rest_distance', 'rest_time', 'stroke_rate', 'stroke_count', 'calories_total',
      'wattminutes_total', 'drag_factor',
    ].flatMap(key => {
      const value = optionalInteger(raw, key);
      return value === undefined ? [] : [[key, value]];
    }));
    return {
      id: row.id, date: row.date, type: row.type, distance: row.distance, time: row.time,
      ...optional,
      ...(splits || intervals ? { workout: { ...(splits ? { splits } : {}), ...(intervals ? { intervals } : {}) } } : {}),
      ...(strokeData ? { stroke_data: strokeData } : {}),
      ...(typeof raw.verified === 'boolean' ? { verified: raw.verified } : {}),
      ...(typeof raw.ranked === 'boolean' ? { ranked: raw.ranked } : {}),
    };
  });
  if (new Set(results.map(row => row.id)).size !== results.length) throw new Error('Duplicate IDs');
  const pagination = value.meta?.pagination;
  if (pagination && (!Number.isSafeInteger(pagination.total_pages) || Number(pagination.total_pages) < 0 ||
    pagination.current_page !== page || Number(pagination.total_pages) < page && results.length > 0)) throw new Error('Invalid pagination');
  // Without metadata a full page means there may be another; an empty page ends it.
  return { results, next_page: pagination ? (page < Number(pagination.total_pages) ? page + 1 : null)
    : (results.length === 25 ? page + 1 : null) };
}
export function compareDevelopmentProjection(
  expected: Record<string, unknown>, actual: DevelopmentResult,
): DevelopmentProjectionComparison {
  const differences: string[] = [];
  const actualRecord = actual as unknown as Record<string, unknown>;
  for (const key of [
    'type', 'date', 'distance', 'time', 'workout_type', 'rest_distance', 'rest_time',
    'stroke_rate', 'stroke_count', 'calories_total', 'wattminutes_total', 'drag_factor',
    'workout', 'stroke_data',
  ]) {
    if (expected[key] !== undefined && JSON.stringify(expected[key]) !== JSON.stringify(actualRecord[key])) {
      differences.push(key);
    }
  }
  return { matches: differences.length === 0, differences };
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
    const response = await deps.fetch(`${PROVIDER}/api/users/me/results/${resultId}?include=strokes`, {
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
    const expected = await deps.loadPublication?.(user, resultId);
    const comparison = expected ? compareDevelopmentProjection(expected, parsed.results[0]) : null;
    return { ...saved, result_id: resultId, detail: parsed.results[0], comparison };
  } catch {
    await deps.syncOperation(user, 'release', values).catch(() => undefined);
    throw new Error('Could not read back this development result. Retry its exact ID; do not publish again.');
  }
}
