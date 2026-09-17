import { describe, expect, it } from 'vitest';
import { mapCompletedWorkoutToConcept2 } from '../../supabase/functions/_shared/concept2/publication';
import type { CompletedWorkoutV2 } from '../../supabase/functions/_shared/concept2/completedWorkout';
import { completedWorkoutFixtures } from '../../supabase/functions/_shared/concept2/fixtures';

const measuredIntervalResult = completedWorkoutFixtures.fixed_distance_intervals_2x500m;

const options = { timezone: 'America/New_York', weightClass: 'H', privacy: 'private' } as const;

describe('completed interval fixture mapping', () => {
  it.each([
    ['fixed_distance_intervals_2x500m', 'FixedDistanceInterval', 1000, 2400, 600],
    ['fixed_time_intervals_3x120s', 'FixedTimeInterval', 1500, 3600, 900],
    ['variable_intervals_mixed', 'VariableInterval', 1200, 3000, 450],
  ] as const)('maps named %s from completed evidence', (name, type, distance, time, restTime) => {
    const fixture = completedWorkoutFixtures[name];
    const payload = mapCompletedWorkoutToConcept2(fixture, options);
    expect(fixture.source).toBe('synthetic_fixture');
    expect(payload.workout_type).toBe(type);
    expect(payload.distance).toBe(distance);
    expect(payload.time).toBe(time);
    expect(payload.rest_time).toBe(restTime);
    expect(payload.workout?.intervals).toHaveLength(fixture.intervals.length);
  });

  it('rejects mismatched completion timezone', () => {
    expect(() => mapCompletedWorkoutToConcept2(measuredIntervalResult, {
      ...options, timezone: 'UTC',
    })).toThrow(/timezone/);
  });

  it('rejects a fixed interval with a different work length', () => {
    const invalid = { ...measuredIntervalResult, intervals: [
      measuredIntervalResult.intervals[0],
      { ...measuredIntervalResult.intervals[1], distanceMeters: 499 },
    ] } as CompletedWorkoutV2;
    expect(() => mapCompletedWorkoutToConcept2(invalid, options)).toThrow(/equal measured distances/);
  });

  it('projects measured work and rest without inventing interval data', () => {
    expect(mapCompletedWorkoutToConcept2(measuredIntervalResult, options)).toEqual({
      type: 'rower', date: '2026-09-17 12:00:00', timezone: 'America/New_York',
      distance: 1000, time: 2400, workout_type: 'FixedDistanceInterval',
      rest_distance: 0, rest_time: 600,
      workout: { intervals: [
        { type: 'distance', distance: 500, time: 1200, rest_time: 600 },
        { type: 'distance', distance: 500, time: 1200, rest_time: 0 },
      ] },
      weight_class: 'H', privacy: 'private',
      comments: 'Logbook Companion workout ID: 11111111-2222-4333-8444-555555555555',
    });
  });

  it('rejects interval totals that do not reconcile', () => {
    const invalid = { ...measuredIntervalResult, distanceMeters: 999 };
    expect(() => mapCompletedWorkoutToConcept2(invalid as CompletedWorkoutV2, options))
      .toThrow(/reconcile/);
  });

  it('rejects a variable interval with an unknown measured kind', () => {
    const fixture = completedWorkoutFixtures.variable_intervals_mixed;
    const invalid = { ...fixture, intervals: [
      { ...fixture.intervals[0], kind: 'calorie' }, fixture.intervals[1],
    ] } as unknown as CompletedWorkoutV2;
    expect(() => mapCompletedWorkoutToConcept2(invalid, options)).toThrow(/interval kind/);
  });

  it('requires capture evidence before accepting an ErgLink result', () => {
    const invalid = { ...measuredIntervalResult, source: 'erg_link_live',
      captureId: 'capture-1', captureVersion: 1 } as CompletedWorkoutV2;
    expect(() => mapCompletedWorkoutToConcept2(invalid, options)).toThrow(/source evidence/);
  });

  it('rejects a rest total that differs from measured intervals', () => {
    const invalid = { ...measuredIntervalResult, restTimeSeconds: 59 };
    expect(() => mapCompletedWorkoutToConcept2(invalid, options)).toThrow(/reconcile/);
  });

  it('rejects a result that has not completed', () => {
    const invalid = { ...measuredIntervalResult, completionStatus: 'incomplete_capture' };
    expect(() => mapCompletedWorkoutToConcept2(invalid as CompletedWorkoutV2, options))
      .toThrow(/completed/);
  });
});
