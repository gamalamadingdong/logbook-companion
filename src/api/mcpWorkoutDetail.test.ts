import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ row: null as unknown, error: null as unknown, clients: vi.fn(), eq: vi.fn(), select: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: (...args: unknown[]) => {
  db.clients(...args);
  const query = { select: (...args: unknown[]) => { db.select(...args); return query; }, eq: (...args: unknown[]) => { db.eq(...args); return query; }, maybeSingle: async () => ({ data: db.row, error: db.error }) };
  return { from: () => query };
} }));
import { getWorkoutDetail, getWorkoutSamples, analyzeWorkout } from '../../api/_lib/logbook';
const cfg = { supabaseUrl: 'https://example.supabase.co', anonKey: 'anon', accessToken: 'user-token' };
const fixture = () => ({ id: '002d5264-8278-4679-93ce-5774c35867bd', external_id: '98848028', source: 'concept2', workout_type: 'rower', workout_name: 'FixedTimeSplits', canonical_name: '30:00', duration_seconds: 1800, distance_meters: 7972, manual_rwn: '30:00', template_id: 'template', updated_at: '2026-11-17T00:00:00Z', raw_data: { time_formatted: '30:00.0', workout: { splits: [{ distance: 1000, time: 2250, stroke_rate: 25 }] }, strokes: Array.from({ length: 505 }, (_, i) => ({ t: i * 25, d: i * 100, p: 1129, hr: 180 + i % 15, spm: 25 })) } });
beforeEach(() => { vi.clearAllMocks(); db.error = null; db.row = fixture(); });
describe('MCP workout detail access', () => {
  it('accepts external IDs, UUIDs and LC workout URLs under each caller token', async () => {
    await getWorkoutDetail(cfg, 'https://logbook.readyall.org/workout/98848028');
    expect(db.eq).toHaveBeenCalledWith('external_id', '98848028');
    await getWorkoutDetail({ ...cfg, accessToken: 'second-user' }, fixture().id);
    expect(db.eq).toHaveBeenCalledWith('id', fixture().id);
    expect(db.clients.mock.calls.map(call => call[2].global.headers.Authorization)).toEqual(['Bearer user-token', 'Bearer second-user']);
  });
  it.each(['https://evil.example/workout/98848028', '../98848028', '98848028,or(user_id)', 'https://logbook.readyall.org/team/98848028'])('rejects invalid identifiers before querying: %s', async id => {
    await expect(getWorkoutDetail(cfg, id)).rejects.toThrow(/workout/i); expect(db.clients).not.toHaveBeenCalled();
  });
  it('keeps summary compatibility while exposing splits and sample metadata without raw dump', async () => {
    const detail = await getWorkoutDetail(cfg, '98848028');
    expect(detail).toMatchObject({ external_id: '98848028', duration_seconds: 1800, manual_rwn: '30:00', template_id: 'template' });
    expect(detail).not.toHaveProperty('raw_data');
    expect(JSON.stringify(detail)).not.toContain('"strokes":');
    expect(JSON.stringify(detail)).not.toContain('"samples":[');
    expect(JSON.stringify(detail)).toContain('505');
    expect(JSON.stringify(detail)).toContain('recorded_splits');
  });
  it('paginates full normalized sample data and reports continuation', async () => {
    const first = await getWorkoutSamples(cfg, '98848028', { limit: 500 });
    expect(first?.samples).toHaveLength(500); expect(first?.pagination).toMatchObject({ total: 505, next_offset: 500 });
    const last = await getWorkoutSamples(cfg, '98848028', { offset: 500 });
    expect(last?.samples).toHaveLength(5); expect(last?.pagination.next_offset).toBeNull();
    expect(first?.samples[1]).toMatchObject({ time_seconds: 2.5, distance_meters: 10, heart_rate_bpm: 181 });
  });
  it('preserves legacy detail interval fields while adding normalized measurements', async () => {
    const row = fixture();
    db.row = { ...row, duration_minutes: 30, rest_distance_meters: 125.5, raw_data: { ...row.raw_data, workout: {
      intervals: [{ type: 'distance', distance: 1000, time: 2400, rest_time: 600 }],
    } } };
    const detail = await getWorkoutDetail(cfg, '98848028');
    expect(db.select).toHaveBeenCalledWith(expect.stringContaining('rest_distance_meters'));
    expect(detail).toMatchObject({ duration_minutes: 30, rest_distance_meters: 125.5, time_formatted: '30:00.0',
      intervals: [{ distance: 1000, time: 2400, rest_time: 600 }],
      recorded_intervals: [{ distance_meters: 1000, time_seconds: 240, rest_seconds: 60 }],
      legacy_interval_units: { time: 'deciseconds', rest_time: 'deciseconds', distance: 'meters' },
    });
  });
  it('filters a seconds window before pagination and rejects reversed windows', async () => {
    const result = await getWorkoutSamples(cfg, '98848028', { startSeconds: 5, endSeconds: 10, limit: 2 });
    expect(result?.pagination).toMatchObject({ total: 3, next_offset: 2 });
    expect(result?.samples[0].time_seconds).toBe(5);
    await expect(getWorkoutSamples(cfg, '98848028', { startSeconds: 10, endSeconds: 5 })).rejects.toThrow(/range|end|window/i);
  });
  it('returns analysis without sending samples, and preserves missing/permission-hidden and query failure states', async () => {
    const result = await analyzeWorkout(cfg, '98848028', 190);
    expect(JSON.stringify(result)).not.toContain('"samples":[');
    expect(JSON.stringify(result)).toContain('190');
    db.row = null; expect(await getWorkoutSamples(cfg, '98848028')).toBeNull();
    expect(await analyzeWorkout(cfg, '98848028', 190)).toBeNull();
    db.error = { message: 'denied' }; await expect(getWorkoutDetail(cfg, '98848028')).rejects.toThrow('denied');
  });
});
