import { describe, expect, it } from 'vitest';
import { completedWorkoutFromRow, mapCompletedWorkoutToConcept2, type CompletedWorkoutV1 } from '../../supabase/functions/_shared/concept2/publication';
import { bindDevelopmentFixture, completedWorkoutFixtures } from '../../supabase/functions/_shared/concept2/fixtures/index';

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
  it('binds a named interval fixture to a durable owned LC identity', () => {
    const bound = bindDevelopmentFixture('fixed_distance_intervals_2x500m',
      '44444444-5555-4666-8777-888888888888', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '2026-09-17T19:00:00.000Z');
    expect(bound.workoutId).toBe('44444444-5555-4666-8777-888888888888');
    expect(bound.ownerId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(bound.completedAt).toBe('2026-09-17T19:00:00.000Z');
    expect(completedWorkoutFixtures.fixed_distance_intervals_2x500m.workoutId).not.toBe(bound.workoutId);
    expect(() => bindDevelopmentFixture('not_a_fixture', bound.workoutId, bound.ownerId, bound.completedAt)).toThrow();
  });

  it('loads only an intact owned synthetic fixture result from its LC row', () => {
    const id = '44444444-5555-4666-8777-888888888888';
    const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const completed = bindDevelopmentFixture('fixed_time_intervals_3x120s', id, owner, '2026-09-17T19:00:00.000Z');
    const row = { id, user_id: owner, source: 'manual', workout_type: 'row', completed_at: completed.completedAt,
      distance_meters: completed.distanceMeters, duration_seconds: completed.workTimeSeconds,
      rest_distance_meters: completed.restDistanceMeters, manual_rwn: null, external_id: null, template_id: null,
      raw_data: { source: 'concept2_development_fixture', fixture_name: 'fixed_time_intervals_3x120s', completed_workout: completed } };
    expect(completedWorkoutFromRow(row)).toEqual(completed);
    expect(() => completedWorkoutFromRow({ ...row, distance_meters: 999 })).toThrow();
    expect(() => completedWorkoutFromRow({ ...row, user_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' })).toThrow();
  });
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
