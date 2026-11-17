// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { from } }));
import { downloadWorkoutExport, loadWorkoutForExport, serializeWorkoutExport } from './workoutExportService';
import { normalizeWorkoutDetail, samplesToCsv } from '../../shared/workoutDetail';
const row = { id: '11111111-1111-4111-8111-111111111111', external_id: '123', source: 'concept2', raw_data: { strokes: [{ t: 10, d: 20, p: 1200, spm: 20, hr: 150 }] } };
function query(result: unknown) {
  const q = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue(result) };
  from.mockReturnValue(q); return q;
}
beforeEach(() => vi.clearAllMocks());
it('loads only the owner workout by resolved UUID with narrow columns', async () => {
  const q = query({ data: row, error: null });
  expect(await loadWorkoutForExport(row.id, 'owner')).toEqual(normalizeWorkoutDetail(row));
  expect(from).toHaveBeenCalledWith('workout_logs');
  expect(q.eq.mock.calls).toEqual([['user_id', 'owner'], ['id', row.id]]);
  const columns = q.select.mock.calls[0][0];
  expect(columns).toContain('raw_data'); expect(columns).not.toContain('*'); expect(columns.split(',')).not.toContain('workout_structure');
});
it('supports external IDs while retaining owner scope', async () => {
  const q = query({ data: row }); await loadWorkoutForExport('123', 'owner');
  expect(q.eq).toHaveBeenCalledWith('external_id', '123'); expect(q.eq).toHaveBeenCalledWith('user_id', 'owner');
});
it('rejects errors, missing rows and absent owner before querying', async () => {
  query({ error: { message: 'offline' } }); await expect(loadWorkoutForExport('123', 'owner')).rejects.toThrow('Retry');
  query({ data: null }); await expect(loadWorkoutForExport('123', 'owner')).rejects.toThrow('not available');
  from.mockClear(); await expect(loadWorkoutForExport('123', '')).rejects.toThrow('Sign in'); expect(from).not.toHaveBeenCalled();
});
it('serializes exactly the shared document and numeric CSV, refusing unavailable sample CSV', () => {
  const document = normalizeWorkoutDetail(row);
  expect(JSON.parse(serializeWorkoutExport(document, 'json').content)).toEqual(document);
  expect(document.samples).toHaveLength(1);
  expect(serializeWorkoutExport(document, 'csv').content).toBe(samplesToCsv(document));
  expect(() => serializeWorkoutExport(normalizeWorkoutDetail({ id: 'manual', source: 'manual' }), 'csv')).toThrow('JSON');
});

it('creates the requested file and removes its anchor and object URL', () => {
  vi.useFakeTimers();
  const create = vi.fn().mockReturnValue('blob:workout');
  const revoke = vi.fn();
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.download).toBe(`workout-${row.id}.json`);
    expect(this.isConnected).toBe(true);
  });
  try {
    downloadWorkoutExport(normalizeWorkoutDetail(row), 'json');
    expect(create.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(click).toHaveBeenCalledTimes(1);
    expect(document.querySelector('a')).toBeNull();
    vi.runAllTimers(); expect(revoke).toHaveBeenCalledWith('blob:workout');
  } finally { click.mockRestore(); vi.unstubAllGlobals(); vi.useRealTimers(); }
});
