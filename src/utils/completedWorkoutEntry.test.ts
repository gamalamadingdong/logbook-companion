import { describe, expect, it } from 'vitest';
import { formatCompletedDuration, normalizeCompletedWorkoutDraft, parseDurationInput, scaffoldSegmentsFromRwn } from './completedWorkoutEntry';
import type { CompletedWorkoutDraft } from '../types/completedWorkoutEntry';

const base: CompletedWorkoutDraft = {
  activity: 'run',
  equipment: null,
  status: 'completed',
  completedAt: '2026-09-18T12:30:00.000Z',
  timezone: 'America/New_York',
  summary: { distanceMeters: 5000, durationSeconds: 1500 },
  detailCoverage: 'none',
  segments: [],
  notes: '',
  plannedRwn: null,
};

describe('completed workout entry', () => {
  it('keeps a summary-only run without inventing equipment or segment detail', () => {
    const result = normalizeCompletedWorkoutDraft(base);
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        _v: 1,
        activity: 'run',
        equipment: null,
        summary: { distanceMeters: 5000, durationSeconds: 1500 },
        detailCoverage: 'none',
        segments: [],
      }),
    });
  });

  it('reconciles mixed work and rest segments while keeping work time separate', () => {
    const result = normalizeCompletedWorkoutDraft({
      ...base,
      activity: 'indoor_row',
      equipment: { brand: 'other', name: 'Gym rower' },
      summary: { distanceMeters: 1200, durationSeconds: 330 },
      detailCoverage: 'full',
      segments: [
        { role: 'work', target: { kind: 'distance', value: 400 }, distanceMeters: 400, durationSeconds: 95 },
        { role: 'rest', target: null, durationSeconds: 30 },
        { role: 'work', target: { kind: 'time', value: 120 }, distanceMeters: 800, durationSeconds: 120 },
        { role: 'rest', target: null, durationSeconds: 85 },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.workTimeSeconds).toBe(215);
      expect(result.value.summary).toEqual({ distanceMeters: 1200, durationSeconds: 330 });
      expect(result.value.segments[2].target).toEqual({ kind: 'time', value: 120 });
    }
  });

  it('keeps a partial detail session total instead of replacing it with segment totals', () => {
    const result = normalizeCompletedWorkoutDraft({
      ...base,
      detailCoverage: 'partial',
      segments: [{ role: 'work', target: null, distanceMeters: 400, durationSeconds: 95 }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.summary).toEqual({ distanceMeters: 5000, durationSeconds: 1500 });
  });

  it('reports a full-detail mismatch at the summary field', () => {
    const result = normalizeCompletedWorkoutDraft({
      ...base,
      detailCoverage: 'full',
      segments: [{ role: 'work', target: null, distanceMeters: 400, durationSeconds: 95 }],
    });
    expect(result).toMatchObject({ ok: false, errors: { 'summary.distanceMeters': expect.any(String) } });
  });

  it('rejects an unmeasured session and invalid finish instant', () => {
    const result = normalizeCompletedWorkoutDraft({
      ...base,
      completedAt: 'not-a-date',
      summary: {},
    });
    expect(result).toMatchObject({
      ok: false,
      errors: { completedAt: expect.any(String), summary: expect.any(String) },
    });
  });

  it('names an activity outside the quick choices', () => {
    const result = normalizeCompletedWorkoutDraft({ ...base, activity: 'other', activityName: '  Hike  ' });
    expect(result).toMatchObject({ ok: true, value: { activity: 'other', activityName: 'Hike' } });
    expect(normalizeCompletedWorkoutDraft({ ...base, activity: 'other', activityName: '' })).toMatchObject({ ok: false, errors: { activityName: expect.any(String) } });
  });

  it('accepts UTC but rejects an absent timezone', () => {
    expect(normalizeCompletedWorkoutDraft({ ...base, timezone: 'UTC' }).ok).toBe(true);
    expect(normalizeCompletedWorkoutDraft({ ...base, timezone: '' })).toMatchObject({ ok: false, errors: { timezone: expect.any(String) } });
  });

  it('parses familiar minute-second and hour-minute-second inputs without rounding', () => {
    expect(parseDurationInput('20:10.5')).toBe(1210.5);
    expect(parseDurationInput('1:02:03')).toBe(3723);
    expect(parseDurationInput('90')).toBe(90);
    expect(parseDurationInput('20:75')).toBeNull();
  });

  it('displays fractional seconds without rounding the saved result', () => {
    expect(formatCompletedDuration(90.5)).toBe('1:30.5');
    expect(formatCompletedDuration(3723.125)).toBe('1:02:03.125');
    expect(formatCompletedDuration(59.9999999)).toBe('1:00');
  });

  it('prefills interval targets from RWN without inventing measured work or rest', () => {
    const segments = scaffoldSegmentsFromRwn('2x500m/1:00r');
    expect(segments).toEqual([
      { role: 'work', target: { kind: 'distance', value: 500 } },
      { role: 'rest', target: { kind: 'time', value: 60 } },
      { role: 'work', target: { kind: 'distance', value: 500 } },
    ]);
    expect(scaffoldSegmentsFromRwn('nonsense')).toBeNull();
  });
});
