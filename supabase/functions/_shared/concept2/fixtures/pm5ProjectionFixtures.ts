import type { CompletedWorkoutV2 } from '../completedWorkout.ts';

export type PM5ProjectionFixture = CompletedWorkoutV2 & {
  concept2Payload: Record<string, unknown>;
};

const ownerId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const paceDeciseconds = 1200;
const strokeRate = 30;
const watts = Math.round(2.8 / Math.pow(120 / 500, 3));

function strokes(intervalCount: number, distancePerInterval: number, timePerIntervalDeciseconds: number) {
  const countPerInterval = Math.round((timePerIntervalDeciseconds / 10) * strokeRate / 60);
  return Array.from({ length: intervalCount * countPerInterval }, (_, index) => {
    const inInterval = index % countPerInterval;
    return {
      t: Math.round((inInterval + 1) * timePerIntervalDeciseconds / countPerInterval),
      d: Math.round((inInterval + 1) * distancePerInterval * 10 / countPerInterval),
      p: paceDeciseconds,
      spm: strokeRate,
      hr: 150,
    };
  });
}

function split(distance: number, time: number, restTime?: number) {
  return {
    distance,
    time,
    stroke_rate: strokeRate,
    calories_total: 12,
    wattminutes_total: Math.round(watts * time / 600),
    heart_rate: { ending: 150 },
    ...(restTime === undefined ? {} : { type: 'distance', rest_time: restTime }),
  };
}

const fixedCompleted: CompletedWorkoutV2 = {
  _v: 2,
  workoutId: '44444444-5555-4666-8777-888888888888',
  ownerId,
  source: 'synthetic_fixture',
  completionStatus: 'completed',
  machine: 'rower',
  shape: { kind: 'variable_interval' },
  completedAt: '2026-09-21T18:30:00.000Z',
  timezone: 'America/New_York',
  distanceMeters: 2000,
  workTimeSeconds: 480,
  restDistanceMeters: 0,
  restTimeSeconds: 0,
  intervals: [
    { kind: 'distance', distanceMeters: 500, workTimeSeconds: 120, restDistanceMeters: 0, restTimeSeconds: 0 },
    { kind: 'distance', distanceMeters: 500, workTimeSeconds: 120, restDistanceMeters: 0, restTimeSeconds: 0 },
    { kind: 'distance', distanceMeters: 500, workTimeSeconds: 120, restDistanceMeters: 0, restTimeSeconds: 0 },
    { kind: 'distance', distanceMeters: 500, workTimeSeconds: 120, restDistanceMeters: 0, restTimeSeconds: 0 },
  ],
};

const intervalCompleted: CompletedWorkoutV2 = {
  _v: 2,
  workoutId: '55555555-6666-4777-8888-999999999999',
  ownerId,
  source: 'synthetic_fixture',
  completionStatus: 'completed',
  machine: 'rower',
  shape: { kind: 'fixed_distance_interval' },
  completedAt: '2026-09-21T19:00:00.000Z',
  timezone: 'America/New_York',
  distanceMeters: 4000,
  workTimeSeconds: 960,
  restDistanceMeters: 0,
  restTimeSeconds: 1470,
  intervals: Array.from({ length: 8 }, (_, index) => ({
    kind: 'distance' as const,
    distanceMeters: 500,
    workTimeSeconds: 120,
    restDistanceMeters: 0,
    restTimeSeconds: index < 7 ? 210 : 0,
  })),
};

export const pm5ProjectionFixtures = {
  pm5_fixed_2000m: {
    ...fixedCompleted,
    concept2Payload: {
      type: 'rower',
      date: '2026-09-21 14:30:00',
      timezone: 'America/New_York',
      distance: 2000,
      time: 4800,
      workout_type: 'FixedDistanceSplits',
      stroke_rate: strokeRate,
      stroke_count: 240,
      calories_total: 48,
      wattminutes_total: Math.round(watts * 8),
      drag_factor: 120,
      heart_rate: { average: 145, min: 100, max: 160, ending: 150, recovery: 90 },
      workout: { splits: Array.from({ length: 4 }, () => split(500, 1200)) },
      stroke_data: strokes(1, 2000, 4800),
    },
  },
  pm5_8x500m: {
    ...intervalCompleted,
    concept2Payload: {
      type: 'rower',
      date: '2026-09-21 15:00:00',
      timezone: 'America/New_York',
      distance: 4000,
      time: 9600,
      workout_type: 'FixedDistanceInterval',
      rest_distance: 0,
      rest_time: 14700,
      stroke_rate: strokeRate,
      stroke_count: 480,
      calories_total: 96,
      wattminutes_total: Math.round(watts * 16),
      drag_factor: 120,
      heart_rate: { average: 145, min: 100, max: 165, ending: 155, recovery: 90 },
      workout: {
        intervals: Array.from({ length: 8 }, (_, index) => split(500, 1200, index < 7 ? 2100 : 0)),
      },
      stroke_data: strokes(8, 500, 1200),
    },
  },
  pm5_invalid_stroke_data: {
    ...fixedCompleted,
    concept2Payload: {
      type: 'rower',
      date: '2026-09-21 14:30:00',
      timezone: 'America/New_York',
      distance: 2000,
      time: 4800,
      workout_type: 'FixedDistanceSplits',
      workout: { splits: Array.from({ length: 4 }, () => split(500, 1200)) },
      stroke_data: [{ t: -1, d: 100, p: paceDeciseconds, spm: strokeRate, hr: 150 }],
    },
  },
} as const satisfies Record<string, PM5ProjectionFixture>;

export function bindPM5ProjectionFixture(
  name: keyof typeof pm5ProjectionFixtures,
  workoutId: string,
  fixtureOwnerId: string,
): PM5ProjectionFixture {
  const fixture = pm5ProjectionFixtures[name];
  return {
    ...fixture,
    workoutId,
    ownerId: fixtureOwnerId,
    intervals: fixture.intervals.map(interval => ({ ...interval })),
    concept2Payload: structuredClone(fixture.concept2Payload),
  } as PM5ProjectionFixture;
}
