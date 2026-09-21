import { describe, expect, it } from 'vitest';
import {
  ErgMachineType,
  IntervalType,
  RowingState,
  StrokeState,
  WorkoutState,
  WorkoutType,
  type NormalizedSplitV2,
  type NormalizedStrokeV2,
  type PM5CompletedCaptureV2,
} from '@readyall/erglink/pm5';
import { projectCaptureToConcept2 } from './concept2CaptureProjection';

type FixtureInterval = { distance: number; rest: number };

function captureFixture(id: string, workoutType: number, intervals: FixtureInterval[]): PM5CompletedCaptureV2 {
  const pace = 120;
  const strokeRate = 30;
  const watts = Math.round(2.8 / Math.pow(pace / 500, 3));
  const intervalType = IntervalType.DISTANCE;
  const splits: NormalizedSplitV2[] = [];
  const strokes: NormalizedStrokeV2[] = [];
  let elapsed = 0;
  let distance = 0;
  let strokeCount = 0;

  intervals.forEach((interval, index) => {
    const workTime = interval.distance / 500 * pace;
    const intervalStrokes = Math.round(workTime * strokeRate / 60);
    for (let strokeIndex = 1; strokeIndex <= intervalStrokes; strokeIndex += 1) {
      strokeCount += 1;
      const intervalElapsed = workTime * strokeIndex / intervalStrokes;
      const intervalDistance = interval.distance * strokeIndex / intervalStrokes;
      strokes.push({
        strokeCount,
        elapsedSeconds: elapsed + intervalElapsed,
        cumulativeDistanceMeters: distance + intervalDistance,
        driveLengthMeters: 1.25,
        driveTimeSeconds: 0.8,
        recoveryTimeSeconds: 1.2,
        strokeDistanceMeters: interval.distance / intervalStrokes,
        peakDriveForcePounds: 120,
        averageDriveForcePounds: 90,
        workPerStrokeJoules: 400,
        intervalNumber: index + 1,
        intervalElapsedSeconds: intervalElapsed,
        intervalDistanceMeters: intervalDistance,
        paceSecondsPer500m: pace,
        strokeRate,
        heartRate: 150,
        powerWatts: watts,
      });
    }
    elapsed += workTime;
    distance += interval.distance;
    splits.push({
      intervalNumber: index + 1,
      intervalType,
      elapsedSeconds: elapsed,
      cumulativeDistanceMeters: distance,
      workTimeSeconds: workTime,
      workDistanceMeters: interval.distance,
      restTimeSeconds: interval.rest,
      restDistanceMeters: 0,
      averageStrokeRate: strokeRate,
      workHeartRate: 150,
      restHeartRate: interval.rest ? 120 : undefined,
      averagePaceSecondsPer500m: pace,
      totalCalories: Math.round(workTime / 10),
      powerWatts: watts,
      averageDragFactor: 120,
      ergMachineType: ErgMachineType.STATIC_E,
    });
  });

  const dateValue = 0x9a95;
  const timeValue = 0x0a1e;
  const startEvidence = { characteristic: 'ce060031-43e5-11e4-916c-0800200c9a66', receivedAt: '2026-09-21T14:30:00.000Z', bytes: [1, 2, 3] };
  const verificationEvidence = { characteristic: 'ce06003c-43e5-11e4-916c-0800200c9a66', receivedAt: '2026-09-21T14:30:01.000Z', bytes: [4, 5, 6] };
  const intervalWorkout = new Set<number>([
    WorkoutType.FIXED_DISTANCE_INTERVAL,
    WorkoutType.VARIABLE_INTERVAL,
  ]).has(workoutType);

  return {
    _v: 2,
    captureVersion: 2,
    captureId: id,
    status: 'completed',
    startedAt: '2026-09-21T14:30:00.000Z',
    completedAt: new Date(Date.parse('2026-09-21T14:30:00.000Z') + elapsed * 1000).toISOString(),
    timezone: 'America/New_York',
    rawNotifications: [
      { ...startEvidence, sequence: 0 },
      { ...verificationEvidence, sequence: 1 },
    ],
    strokes,
    splits,
    summary: {
      workDistanceMeters: distance,
      workTimeSeconds: elapsed,
      averagePaceSecondsPer500m: pace,
      averageStrokeRate: strokeRate,
      averageWatts: watts,
      totalCalories: Math.round(elapsed / 10),
      restDistanceMeters: 0,
      restTimeSeconds: intervals.at(-1)?.rest ?? 0,
      strokeCount,
    },
    rawEndSummary: {
      logDate: dateValue,
      logTime: timeValue,
      elapsedTime: Math.round(elapsed * 100),
      distance: Math.round(distance * 10),
      averageStrokeRate: strokeRate,
      endingHeartRate: 150,
      averageHeartRate: 145,
      minHeartRate: 100,
      maxHeartRate: 160,
      averageDragFactor: 120,
      recoveryHeartRate: 90,
      workoutType,
      averagePace: pace * 10,
    },
    rawAdditionalEndSummary: {
      logDate: dateValue,
      logTime: timeValue,
      intervalType,
      intervalSize: intervals.at(-1)?.distance ?? 0,
      intervalCount: intervals.length,
      totalCalories: Math.round(elapsed / 10),
      watts,
      totalRestDistance: 0,
      restTime: intervals.at(-1)?.rest ?? 0,
      averageCalories: 700,
    },
    rawAdditionalEndSummary2: {
      logDate: dateValue,
      logTime: timeValue,
      averagePace: pace * 10,
      gameIdentifier: 0,
      workoutVerified: true,
      verificationValue: 0x10,
      gameScore: 0,
      ergMachineType: ErgMachineType.STATIC_E,
    },
    verification: {
      workoutVerified: true,
      verificationValue: 0x10,
      gameIdentifier: 0,
      evidence: verificationEvidence,
    },
    ergMachineType: ErgMachineType.STATIC_E,
    pmLogTimestamp: { dateValue, timeValue },
    startState: {
      status: {
        elapsedTime: 0,
        distance: 0,
        workoutType,
        intervalType,
        workoutState: WorkoutState.WORKOUT_ROW,
        rowingState: RowingState.INACTIVE,
        strokeState: StrokeState.WAITING_FOR_MINIMUM_SPEED,
        totalWorkDistance: intervalWorkout ? distance : 2000,
      },
      evidence: startEvidence,
    },
  };
}

const fixed = captureFixture('fixed-2000', WorkoutType.FIXED_DISTANCE_SPLITS, [
  { distance: 500, rest: 0 }, { distance: 500, rest: 0 },
  { distance: 500, rest: 0 }, { distance: 500, rest: 0 },
]);
const repeated = captureFixture('8x500', WorkoutType.FIXED_DISTANCE_INTERVAL,
  Array.from({ length: 8 }, () => ({ distance: 500, rest: 210 })));
const pyramid = captureFixture('speed-pyramid', WorkoutType.VARIABLE_INTERVAL,
  [250, 500, 750, 1000, 750, 500, 250].map((distance, index) => ({
    distance,
    rest: [90, 180, 270, 360, 270, 180, 90][index],
  })));

describe('Concept2 PM5 capture projection', () => {
  it('projects fixed-distance splits and exact stroke units', () => {
    const result = projectCaptureToConcept2(fixed);
    expect(result).toMatchObject({
      type: 'rower',
      date: '2026-09-21 10:30:00',
      timezone: 'America/New_York',
      distance: 2000,
      time: 4800,
      workout_type: 'FixedDistanceSplits',
      stroke_rate: 30,
      stroke_count: 240,
      calories_total: 48,
      wattminutes_total: 1624,
      drag_factor: 120,
      heart_rate: { average: 145, min: 100, max: 160, ending: 150, recovery: 90 },
    });
    expect(result.workout?.splits).toHaveLength(4);
    expect(result.workout?.splits?.[0]).toEqual({
      distance: 500,
      time: 1200,
      stroke_rate: 30,
      calories_total: 12,
      wattminutes_total: 406,
      heart_rate: { ending: 150 },
    });
    expect(result.stroke_data).toHaveLength(240);
    expect(result.stroke_data?.[0]).toEqual({ t: 20, d: 83, p: 1200, spm: 30, hr: 150 });
    expect(result.stroke_data?.[59]).toEqual({ t: 1200, d: 5000, p: 1200, spm: 30, hr: 150 });
    expect(result).not.toHaveProperty('verified');
  });

  it('projects fixed-distance intervals with per-interval stroke resets and final rest', () => {
    const result = projectCaptureToConcept2(repeated);
    expect(result).toMatchObject({
      distance: 4000,
      time: 9600,
      workout_type: 'FixedDistanceInterval',
      rest_distance: 0,
      rest_time: 16800,
    });
    expect(result.workout?.intervals).toHaveLength(8);
    expect(result.workout?.intervals?.[0]).toMatchObject({
      type: 'distance', distance: 500, time: 1200, rest_time: 2100,
    });
    expect(result.stroke_data?.[0]).toMatchObject({ t: 20, d: 83 });
    expect(result.stroke_data?.[60]).toMatchObject({ t: 20, d: 83 });
  });

  it('projects variable interval distances and exact rests', () => {
    const result = projectCaptureToConcept2(pyramid);
    expect(result).toMatchObject({
      distance: 4000,
      time: 9600,
      workout_type: 'VariableInterval',
      rest_time: 14400,
    });
    expect(result.workout?.intervals?.map((interval) => interval.distance))
      .toEqual([250, 500, 750, 1000, 750, 500, 250]);
    expect(result.workout?.intervals?.map((interval) => interval.rest_time))
      .toEqual([900, 1800, 2700, 3600, 2700, 1800, 900]);
  });

  it('refuses malformed captures', () => {
    const malformed = structuredClone(fixed);
    malformed.summary!.workDistanceMeters = 1999;
    expect(() => projectCaptureToConcept2(malformed)).toThrow(/work_distance_mismatch/);
  });

  it('maps undefined-rest time intervals as time', () => {
    const mixed = structuredClone(pyramid);
    mixed.rawEndSummary!.workoutType = WorkoutType.VARIABLE_INTERVAL_UNDEFINED_REST;
    mixed.startState!.status.workoutType = WorkoutType.VARIABLE_INTERVAL_UNDEFINED_REST;
    mixed.startState!.status.intervalType = IntervalType.TIME_UNDEFINED_REST;
    mixed.splits[0].intervalType = IntervalType.TIME_UNDEFINED_REST;
    const result = projectCaptureToConcept2(mixed);
    expect(result.workout?.intervals?.[0].type).toBe('time');
  });

  it('keeps fixed-interval rest distance only at workout level', () => {
    const recoveryDistance = structuredClone(repeated);
    recoveryDistance.splits[0].restDistanceMeters = 25;
    const result = projectCaptureToConcept2(recoveryDistance);
    expect(result.rest_distance).toBe(25);
    expect(result.workout?.intervals?.[0]).not.toHaveProperty('rest_distance');
  });

  it('omits an unavailable drag factor', () => {
    const noDrag = structuredClone(fixed);
    noDrag.rawEndSummary!.averageDragFactor = 0;
    expect(projectCaptureToConcept2(noDrag)).not.toHaveProperty('drag_factor');
  });
});
