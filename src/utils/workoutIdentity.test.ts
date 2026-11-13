import { describe, expect, it } from 'vitest';
import { workoutIdentity, type IdentityWorkout } from './workoutIdentity';
const row: IdentityWorkout = { workout_type: 'rower', manual_rwn: null, raw_workout_type: 'FixedDistanceSplits', distance_meters: 3000, duration_seconds: 800, raw_workout: {} };
const key = (changes: Partial<IdentityWorkout> = {}) => workoutIdentity({ ...row, ...changes });
describe('full workout identity', () => {
  it('ignores recording splits and measured pace for continuous rows', () => {
    expect(key()).toBe(key({ duration_seconds: 700, raw_workout: { splits: [{ distance: 500 }] } }));
    expect(key()).toBe(key({ manual_rwn: '3000m' }));
    expect(key()).not.toBe(key({ distance_meters: 5000 }));
  });
  it('separates machine types, time workouts, JustRow and unknown modes', () => {
    expect(key()).not.toBe(key({ workout_type: 'skierg' }));
    expect(key({ workout_type: 'skierg', manual_rwn: 'row:3000m' })).toBeNull();
    expect(key()).not.toBe(key({ raw_workout_type: 'FixedTimeSplits' }));
    expect(key({ raw_workout_type: 'JustRow' })).toBeNull();
    expect(key({ raw_workout_type: 'unknown' })).toBeNull();
  });
  it('compares every pyramid work and rest rather than the abbreviated name', () => {
    const intervals = [250, 500, 750, 1000, 750, 500, 250].map(distance => ({ type: 'distance', distance, time: 1000, rest_time: 900 }));
    const base = { raw_workout_type: 'VariableInterval', raw_workout: { intervals } };
    expect(key(base)).toBe(key({ ...base, manual_rwn: '250m/1:30r + 500m/1:30r + 750m/1:30r + 1000m/1:30r + 750m/1:30r + 500m/1:30r + 250m/1:30r' }));
    expect(key(base)).not.toBe(key({ ...base, raw_workout: { intervals: intervals.map((v, i) => i === 3 ? { ...v, distance: 1500 } : v) } }));
    expect(key(base)).not.toBe(key({ ...base, raw_workout: { intervals: intervals.map(v => ({ ...v, rest_time: 600 })) } }));
    expect(key({ ...base, raw_workout: { intervals: intervals.map(v => ({ ...v, rest_time: undefined })) } })).toBeNull();
  });
  it('normalizes repeated notation but preserves explicit targets and invalid overrides', () => {
    expect(key({ manual_rwn: '2x500m/1:00r' })).toBe(key({ manual_rwn: '500m/1:00r + 500m/1:00r' }));
    expect(key({ manual_rwn: '3000m@r20' })).not.toBe(key());
    expect(key({ manual_rwn: 'not valid RWN' })).toBeNull();
    expect(key({ manual_rwn: '6x500m/0:00r' })).not.toBe(key());
  });
});
