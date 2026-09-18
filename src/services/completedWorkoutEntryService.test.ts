import { describe, expect, it } from 'vitest';
import { buildCompletedWorkoutInsert, readCompletedWorkoutFromRow } from './completedWorkoutEntryService';
import type { CompletedWorkoutEntryV1 } from '../types/completedWorkoutEntry';

const result: CompletedWorkoutEntryV1 = {
  _v: 1,
  activity: 'indoor_row',
  equipment: { brand: 'other', name: 'Gym rower' },
  status: 'completed',
  completedAt: '2026-09-18T12:30:00.000Z',
  timezone: 'America/New_York',
  summary: { distanceMeters: 1200, durationSeconds: 330, watts: 145 },
  detailCoverage: 'full',
  segments: [
    { role: 'work', target: { kind: 'distance', value: 400 }, distanceMeters: 400, durationSeconds: 95 },
    { role: 'rest', target: null, durationSeconds: 30 },
    { role: 'work', target: { kind: 'time', value: 120 }, distanceMeters: 800, durationSeconds: 120 },
    { role: 'rest', target: null, durationSeconds: 85 },
  ],
  workTimeSeconds: 215,
  notes: 'Variable session',
  plannedRwn: null,
};

describe('general manual workout persistence', () => {
  it('projects a validated result into the owned log and preserves all ordered detail', () => {
    const insert = buildCompletedWorkoutInsert('user-1', result);
    expect(insert).toMatchObject({
      user_id: 'user-1',
      source: 'manual',
      workout_type: 'row',
      completed_at: '2026-09-18T12:30:00.000Z',
      distance_meters: 1200,
      duration_seconds: 330,
      duration_minutes: 6,
      watts: 145,
      notes: 'Variable session',
      raw_data: {
        source: 'general_manual_entry',
        completed_result: result,
      },
    });
    expect(insert.external_id).toBeUndefined();
    expect(insert.c2_published_at).toBeUndefined();
  });

  it('reads only a versioned general manual result, not another manual or imported row', () => {
    const row = { id: 'workout-1', user_id: 'user-1', source: 'manual', raw_data: { source: 'general_manual_entry', completed_result: result } };
    expect(readCompletedWorkoutFromRow(row)?.segments).toHaveLength(4);
    expect(readCompletedWorkoutFromRow({ ...row, raw_data: { source: 'training_block_manual_entry' } })).toBeNull();
    expect(readCompletedWorkoutFromRow({ ...row, source: 'concept2' })).toBeNull();
  });
});
