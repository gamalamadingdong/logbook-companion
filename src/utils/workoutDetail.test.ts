import { describe, expect, it } from 'vitest';
import { analyzeHeartRate, normalizeWorkoutDetail, samplesToCsv, type WorkoutDetailRow } from '../../shared/workoutDetail';

const row = (raw_data: unknown, extra: Partial<WorkoutDetailRow> = {}): WorkoutDetailRow => ({
  id: 'lc-id', source: 'concept2', raw_data, ...extra,
});
const heart = (values: Array<[number, unknown]>) => normalizeWorkoutDetail(row({ strokes: values.map(([t, hr]) => ({ t: t * 10, hr })) }));

describe('normalizeWorkoutDetail', () => {
  it('converts Concept2 scaled fields without a pace-vs-power heuristic', () => {
    const doc = normalizeWorkoutDetail(row({ strokes: [{ t: 125, d: 1234, p: 2000, spm: 24, hr: 150 }, { t: 130, d: 1240, p: 900, watts: 300 }] }));
    expect(doc.samples[0]).toEqual({ sequence_index: 0, segment_index: 0, time_seconds: 12.5, distance_meters: 123.4, pace_seconds_per_500m: 200, watts: 43.75, stroke_rate_spm: 24, heart_rate_bpm: 150 });
    expect(doc.samples[1].pace_seconds_per_500m).toBe(90);
    expect(doc.samples[1].watts).toBe(300);
    expect(doc.sample_availability.status).toBe('available');
  });
  it('keeps measured splits distinct from effort intervals and saved structure', () => {
    const doc = normalizeWorkoutDetail(row({ workout_structure: { type: 'continuous' }, workout: { splits: [{ distance: 500, time: 1250 }], intervals: [{ type: 'distance', distance: 1000, time: 2500, rest_time: 600 }] } }, { manual_rwn: '1000m', template_id: 'template' }));
    expect(doc.splits[0]).toMatchObject({ distance_meters: 500, time_seconds: 125, rest_seconds: null });
    expect(doc.intervals[0]).toMatchObject({ distance_meters: 1000, time_seconds: 250, rest_seconds: 60 });
    expect(doc.structure).toEqual({ manual_rwn: '1000m', template_id: 'template', workout_structure: { type: 'continuous' } });
    expect(normalizeWorkoutDetail(row({ workout: { splits: [{ distance: 500, time: 1200 }] } })).intervals).toEqual([]);
  });
  it('copies only public workout metadata, preserves zero values, and avoids owner/raw data leaks', () => {
    const input = { ...row({ user_id: 999 }), user_id: 'secret', external_id: '98848028', distance_meters: 0, duration_seconds: 0, duration_minutes: 2, notes: '=private', average_heart_rate: 0 };
    const doc = normalizeWorkoutDetail(input);
    expect(doc.summary).toMatchObject({ id: 'lc-id', external_id: '98848028', distance_meters: 0, duration_seconds: 0, notes: '=private', average_heart_rate: null });
    expect(JSON.stringify(doc)).not.toContain('user_id');
    expect(doc).not.toHaveProperty('raw_data');
  });
  it('preserves measured rest distance including legitimate zero and rejects invalid distances', () => {
    expect(normalizeWorkoutDetail(row(null, { rest_distance_meters: 125.5 })).summary.rest_distance_meters).toBe(125.5);
    expect(normalizeWorkoutDetail(row(null, { rest_distance_meters: 0 })).summary.rest_distance_meters).toBe(0);
    expect(normalizeWorkoutDetail(row(null, { rest_distance_meters: -1 })).summary.rest_distance_meters).toBeNull();
  });
  it('retains recorded display time and update provenance without leaking raw metadata', () => {
    const doc = normalizeWorkoutDetail(row({ time_formatted: '2:05.0' }, { updated_at: '2026-11-17T12:00:00Z' }));
    expect(doc.summary.time_formatted).toBe('2:05.0');
    expect(doc.provenance.updated_at).toBe('2026-11-17T12:00:00Z');
  });
  it('preserves sequence and assigns new segments at clock resets, retaining duplicate timestamps', () => {
    const doc = heart([[0, 140], [2, 150], [2, 155], [1, 160], [3, 170]]);
    expect(doc.samples.map(s => [s.time_seconds, s.segment_index])).toEqual([[0, 0], [2, 0], [2, 0], [1, 1], [3, 1]]);
    expect(doc.samples.map(s => s.sequence_index)).toEqual([0, 1, 2, 3, 4]);
  });
  it('rejects malformed timestamps and samples while nulling invalid optional metrics', () => {
    const doc = normalizeWorkoutDetail(row({ strokes: [null, {}, { t: -1 }, { t: '10' }, { t: Infinity }, { t: 0, d: 0, p: 0, hr: 0 }, { t: 10, d: -1, p: NaN, hr: -1, spm: Infinity, watts: -3 }] }));
    expect(doc.sample_availability).toMatchObject({ total_count: 7, valid_count: 2, rejected_count: 5 });
    expect(doc.samples[0]).toMatchObject({ time_seconds: 0, distance_meters: 0, heart_rate_bpm: null, watts: null });
    expect(doc.samples[1]).toMatchObject({ distance_meters: null, pace_seconds_per_500m: null, watts: null, stroke_rate_spm: null, heart_rate_bpm: null });
  });
  it.each([
    [null, 'concept2', 'missing'],
    [{ strokes: [] }, 'concept2', 'missing'],
    [{ strokes: 'bad' }, 'concept2', 'invalid'],
    [{ strokes: [{}] }, 'concept2', 'invalid'],
    [{ strokes: [{ t: 100, hr: 150 }] }, 'manual', 'unsupported'],
    [{ strokes: [{ t: 100, hr: 150 }] }, null, 'unsupported'],
  ])('reports explicit availability for %j from %s', (raw, source, status) => {
    expect(normalizeWorkoutDetail(row(raw, { source })).sample_availability.status).toBe(status);
  });
});

describe('analyzeHeartRate', () => {
  it('weights irregular sample spacing and interpolates threshold crossings', () => {
    // 0..3: crossing at 1.5 => 1.5 above. 3..10: crossing at 6.5 => 3.5 above.
    const analysis = analyzeHeartRate(heart([[0, 140], [3, 160], [10, 140]]), 150);
    expect(analysis).toMatchObject({ status: 'available', secondsAboveThreshold: 5, coveredSeconds: 10, gapSeconds: 0, missingHrSeconds: 0, observedSpanSeconds: 10, firstSampleTimeSeconds: 0, lastSampleTimeSeconds: 10, thresholdBpm: 150, maxGapSeconds: 10, method: 'linear_interpolation_strictly_above' });
  });
  it('excludes exact threshold plateaus but includes positive slopes from equality', () => {
    expect(analyzeHeartRate(heart([[0, 150], [4, 150], [6, 160], [9, 150]]), 150)).toMatchObject({ secondsAboveThreshold: 5, coveredSeconds: 9 });
    expect(analyzeHeartRate(heart([[0, 140], [10, 150]]), 150)).toMatchObject({ status: 'available', secondsAboveThreshold: 0, coveredSeconds: 10 });
  });
  it('does not bridge missing HR, large gaps, duplicate times or resets', () => {
    const analysis = analyzeHeartRate(heart([[0, 160], [2, null], [5, 160], [25, 160], [25, 180], [1, 170], [4, 170]]), 150);
    expect(analysis).toMatchObject({ secondsAboveThreshold: 3, coveredSeconds: 3, missingHrSeconds: 5, gapSeconds: 20, observedSpanSeconds: 28, firstSampleTimeSeconds: 0, lastSampleTimeSeconds: 4 });
  });
  it('does not bridge discarded records with invalid timestamps', () => {
    const doc = normalizeWorkoutDetail(row({ strokes: [{ t: 0, hr: 160 }, { t: 'bad', hr: 160 }, { t: 40, hr: 160 }] }));
    expect(analyzeHeartRate(doc, 150)).toMatchObject({ status: 'unavailable', secondsAboveThreshold: null, coveredSeconds: 0, missingHrSeconds: 4, observedSpanSeconds: 4 });
  });
  it('never extrapolates to workout summary endpoints and respects configurable gap', () => {
    const doc = heart([[10, 140], [25, 170]]);
    doc.summary.duration_seconds = 100;
    expect(analyzeHeartRate(doc, 150)).toMatchObject({ status: 'unavailable', secondsAboveThreshold: null, gapSeconds: 15, observedSpanSeconds: 15 });
    expect(analyzeHeartRate(doc, 150, 15)).toMatchObject({ status: 'available', secondsAboveThreshold: 10, coveredSeconds: 15 });
  });
  it.each([{ values: [] }, { values: [[0, 160]] }, { values: [[0, 0], [4, null]] }])('reports unavailable with no measured duration: %j', ({ values }) => {
    expect(analyzeHeartRate(heart(values as Array<[number, unknown]>), 150)).toMatchObject({ status: 'unavailable', secondsAboveThreshold: null, coveredSeconds: 0 });
  });
  it('rejects invalid analytical parameters', () => {
    const doc = heart([[0, 140], [4, 160]]);
    expect(() => analyzeHeartRate(doc, NaN)).toThrow();
    expect(() => analyzeHeartRate(doc, 0)).toThrow();
    expect(() => analyzeHeartRate(doc, 150, -1)).toThrow();
  });
});

describe('samplesToCsv', () => {
  it('emits numeric normalized fields and empty cells without metadata or formulas', () => {
    const doc = normalizeWorkoutDetail(row({ strokes: [{ t: 0, d: 0, hr: 150 }, { t: 10, d: 10, p: 2000, hr: '=formula' }] }, { notes: '=formula' }));
    expect(samplesToCsv(doc)).toBe('sequence_index,segment_index,time_seconds,distance_meters,pace_seconds_per_500m,watts,stroke_rate_spm,heart_rate_bpm\r\n0,0,0,0,,,,150\r\n1,0,1,1,200,43.75,,\r\n');
  });
  it('returns a header-only CSV for empty samples', () => {
    expect(samplesToCsv(normalizeWorkoutDetail(row(null))).split('\r\n')).toHaveLength(2);
  });
});
