import { describe, expect, it } from 'vitest';
import { completedWorkoutFromRow, mapCompletedWorkoutToConcept2, type CompletedWorkoutV1 } from '../../supabase/functions/_shared/concept2/publication';

const fixedDistance: CompletedWorkoutV1 = {
  _v: 1,
  workoutId: 'f7e75f35-2dda-4a5a-87b8-bbbecf1e8013',
  source: 'manual',
  machine: 'rower',
  shape: { kind: 'fixed_distance' },
  completedAt: '2026-09-13T13:04:00.000Z',
  distanceMeters: 8455,
  workTimeSeconds: 2400,
  restDistanceMeters: 0,
  restTimeSeconds: 0,
};

describe('Concept2 completed-workout publication mapper', () => {
  it('preserves the proven fixed-distance development payload', () => {
    expect(mapCompletedWorkoutToConcept2(fixedDistance, {
      timezone: 'America/New_York', weightClass: 'H', privacy: 'private',
    })).toEqual({
      type: 'rower',
      date: '2026-09-13 09:04:00',
      timezone: 'America/New_York',
      distance: 8455,
      time: 24000,
      workout_type: 'unknown',
      weight_class: 'H',
      privacy: 'private',
      comments: 'Logbook Companion workout ID: f7e75f35-2dda-4a5a-87b8-bbbecf1e8013',
    });
  });

  it('maps a completed fixed-time workout with measured distance', () => {
    expect(mapCompletedWorkoutToConcept2({
      ...fixedDistance,
      workoutId: '11111111-2222-4333-8444-555555555555',
      shape: { kind: 'fixed_time' },
      completedAt: '2026-09-17T12:30:00.000Z',
      distanceMeters: 7321,
      workTimeSeconds: 1800,
    }, {
      timezone: 'America/New_York', weightClass: 'L', privacy: 'partners',
    })).toEqual({
      type: 'rower',
      date: '2026-09-17 08:30:00',
      timezone: 'America/New_York',
      distance: 7321,
      time: 18000,
      workout_type: 'FixedTimeSplits',
      weight_class: 'L',
      privacy: 'partners',
      comments: 'Logbook Companion workout ID: 11111111-2222-4333-8444-555555555555',
    });
  });

  it('normalizes an owned fixed-time manual row without losing measured totals', () => {
    expect(completedWorkoutFromRow({
      id: '11111111-2222-4333-8444-555555555555',
      source: 'manual', workout_type: 'row', completed_at: '2026-09-17T12:30:00.000Z',
      distance_meters: 7321, duration_seconds: 1800, rest_distance_meters: 0,
      manual_rwn: '1800s', external_id: null, template_id: null,
      raw_data: { source: 'training_block_manual_entry', mode: 'row',
        entry_surface: 'concept2_development_test', publication_shape: 'fixed_time' },
    })).toEqual({
      _v: 1,
      workoutId: '11111111-2222-4333-8444-555555555555',
      source: 'manual', machine: 'rower', shape: { kind: 'fixed_time' },
      completedAt: '2026-09-17T12:30:00.000Z', distanceMeters: 7321, workTimeSeconds: 1800,
      restDistanceMeters: 0, restTimeSeconds: 0,
    });
  });

  it('formats provider dates across a UTC day boundary and rounds to deciseconds', () => {
    const payload = mapCompletedWorkoutToConcept2({
      ...fixedDistance,
      completedAt: '2026-09-18T00:15:00.000Z',
      workTimeSeconds: 90.04,
    }, { timezone: 'America/Los_Angeles', weightClass: 'H', privacy: 'private' });
    expect(payload.date).toBe('2026-09-17 17:15:00');
    expect(payload.time).toBe(900);
  });

  it('rejects an unsupported manual shape instead of flattening it', () => {
    expect(() => completedWorkoutFromRow({
      id: '11111111-2222-4333-8444-555555555555', source: 'manual', workout_type: 'row',
      completed_at: '2026-09-17T12:30:00.000Z', distance_meters: 7321, duration_seconds: 1800,
      rest_distance_meters: 0, manual_rwn: '7321m', external_id: null, template_id: null,
      raw_data: { source: 'training_block_manual_entry', mode: 'row', publication_shape: 'interval_distance' },
    })).toThrow(/fixed-distance or fixed-time/);
  });
});
