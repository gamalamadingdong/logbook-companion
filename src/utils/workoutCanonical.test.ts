import { describe, expect, it } from 'vitest';
import { deriveCanonicalNameFromConcept2 } from './workoutCanonical';
import type { C2Interval } from '../api/concept2.types';

const intervals = (count: number, distance: number, rest = 0): C2Interval[] =>
  Array.from({ length: count }, () => ({ type: 'distance', distance, time: 1300, stroke_rate: 20, rest_time: rest }));

describe('Concept2 workout-mode naming', () => {
  it.each([
    [3000, 6, 500], [5000, 5, 1000], [4000, 5, 800],
    [11000, 5, 2200], [15000, 5, 3000], [12000, 4, 3000],
  ])('names a continuous %im row by total distance, not its %i splits', (distance, count, split) => {
    expect(deriveCanonicalNameFromConcept2({
      workout_type: 'FixedDistanceSplits', distance, time: 18000,
      workout: { splits: intervals(count, split) },
    })).toBe(`${distance}m`);
  });

  it('honors continuous mode even if a legacy adapter placed splits in intervals', () => {
    expect(deriveCanonicalNameFromConcept2({
      workout_type: 'FixedDistanceSplits', distance: 5000,
      workout: { intervals: intervals(5, 1000) },
    })).toBe('5000m');
  });

  it.each(['FixedTimeSplits', 'FixedTimeNoSplits'])('uses precise total time for %s', (workout_type) => {
    expect(deriveCanonicalNameFromConcept2({ workout_type, time: 18000, distance: 7100, workout: { intervals: intervals(6, 1000) } })).toBe('30:00');
    expect(deriveCanonicalNameFromConcept2({ workout_type, time: 12525, distance: 5000 })).toBe('20:52.5');
  });

  it('does not round a continuous distance into a nearby benchmark', () => {
    expect(deriveCanonicalNameFromConcept2({ workout_type: 'FixedDistanceNoSplits', distance: 1990 })).toBe('1990m');
  });

  it('preserves JustRow total distance even with recorded splits', () => {
    expect(deriveCanonicalNameFromConcept2({ workout_type: 'JustRow', distance: 6011, workout: { splits: intervals(6, 1000) } })).toBe('6011m JustRow');
  });

  it('preserves actual interval workouts with rests', () => {
    expect(deriveCanonicalNameFromConcept2({ workout_type: 'FixedDistanceInterval', distance: 7500, workout: { intervals: intervals(5, 1500, 3000) } })).toBe('5x1500m/5:00r');
  });

  it('preserves true intervals with zero rest rather than inferring continuity', () => {
    expect(deriveCanonicalNameFromConcept2({ workout_type: 'FixedDistanceInterval', distance: 5000, workout: { intervals: intervals(5, 1000) } })).toBe('5x1000m');
  });

  it('does not treat splits as intervals when the workout mode is unknown', () => {
    expect(deriveCanonicalNameFromConcept2({ workout: { splits: intervals(5, 1000) } })).toBeNull();
  });
});
