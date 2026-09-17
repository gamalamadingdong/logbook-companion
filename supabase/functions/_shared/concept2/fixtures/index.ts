import type { CompletedWorkoutV2 } from '../completedWorkout.ts';

// Synthetic, local conformance inputs. These UUIDs are not durable LC workouts.
// A future development fixture publisher must bind a fixture to a new owned LC row
// before using the publication state machine; never POST these identities directly.
const ownerId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const base = {
  _v: 2,
  ownerId,
  source: 'synthetic_fixture',
  completionStatus: 'completed',
  machine: 'rower',
  timezone: 'America/New_York',
} as const;

export const completedWorkoutFixtures = {
  fixed_distance_intervals_2x500m: {
    ...base,
    workoutId: '11111111-2222-4333-8444-555555555555',
    shape: { kind: 'fixed_distance_interval' },
    completedAt: '2026-09-17T16:00:00.000Z',
    distanceMeters: 1000, workTimeSeconds: 240,
    restDistanceMeters: 0, restTimeSeconds: 60,
    intervals: [
      { kind: 'distance', distanceMeters: 500, workTimeSeconds: 120,
        restDistanceMeters: 0, restTimeSeconds: 60 },
      { kind: 'distance', distanceMeters: 500, workTimeSeconds: 120,
        restDistanceMeters: 0, restTimeSeconds: 0 },
    ],
  },
  fixed_time_intervals_3x120s: {
    ...base,
    workoutId: '22222222-3333-4444-8555-666666666666',
    shape: { kind: 'fixed_time_interval' },
    completedAt: '2026-09-17T17:00:00.000Z',
    distanceMeters: 1500, workTimeSeconds: 360,
    restDistanceMeters: 0, restTimeSeconds: 90,
    intervals: [
      { kind: 'time', distanceMeters: 480, workTimeSeconds: 120,
        restDistanceMeters: 0, restTimeSeconds: 45 },
      { kind: 'time', distanceMeters: 500, workTimeSeconds: 120,
        restDistanceMeters: 0, restTimeSeconds: 45 },
      { kind: 'time', distanceMeters: 520, workTimeSeconds: 120,
        restDistanceMeters: 0, restTimeSeconds: 0 },
    ],
  },
  variable_intervals_mixed: {
    ...base,
    workoutId: '33333333-4444-4555-8666-777777777777',
    shape: { kind: 'variable_interval' },
    completedAt: '2026-09-17T18:00:00.000Z',
    distanceMeters: 1200, workTimeSeconds: 300,
    restDistanceMeters: 40, restTimeSeconds: 45,
    intervals: [
      { kind: 'distance', distanceMeters: 500, workTimeSeconds: 120,
        restDistanceMeters: 25, restTimeSeconds: 30 },
      { kind: 'time', distanceMeters: 700, workTimeSeconds: 180,
        restDistanceMeters: 15, restTimeSeconds: 15 },
    ],
  },
} as const satisfies Record<string, CompletedWorkoutV2>;
