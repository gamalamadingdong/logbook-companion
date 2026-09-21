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

export function createValidPM5Capture(captureId = 'capture-500m'): PM5CompletedCaptureV2 {
  const distance = 500;
  const workTime = 120;
  const strokeRate = 30;
  const strokeCount = 60;
  const pace = 120;
  const watts = Math.round(2.8 / Math.pow(pace / 500, 3));
  const startEvidence = {
    characteristic: 'ce060031-43e5-11e4-916c-0800200c9a66',
    receivedAt: '2026-09-21T14:30:00.000Z',
    bytes: [1, 2, 3],
  };
  const verificationEvidence = {
    characteristic: 'ce06003c-43e5-11e4-916c-0800200c9a66',
    receivedAt: '2026-09-21T14:32:00.000Z',
    bytes: [4, 5, 6],
  };
  const strokes: NormalizedStrokeV2[] = Array.from({ length: strokeCount }, (_, index) => ({
    strokeCount: index + 1,
    elapsedSeconds: (index + 1) * workTime / strokeCount,
    cumulativeDistanceMeters: (index + 1) * distance / strokeCount,
    driveLengthMeters: 1.2,
    driveTimeSeconds: 0.8,
    recoveryTimeSeconds: 1.2,
    strokeDistanceMeters: distance / strokeCount,
    peakDriveForcePounds: 100,
    averageDriveForcePounds: 80,
    workPerStrokeJoules: 400,
    intervalNumber: 1,
    intervalElapsedSeconds: (index + 1) * workTime / strokeCount,
    intervalDistanceMeters: (index + 1) * distance / strokeCount,
    paceSecondsPer500m: pace,
    strokeRate,
    heartRate: 150,
    powerWatts: watts,
  }));
  const splits: NormalizedSplitV2[] = [{
    intervalNumber: 1,
    intervalType: IntervalType.DISTANCE,
    elapsedSeconds: workTime,
    cumulativeDistanceMeters: distance,
    workTimeSeconds: workTime,
    workDistanceMeters: distance,
    restTimeSeconds: 0,
    restDistanceMeters: 0,
    averageStrokeRate: strokeRate,
    workHeartRate: 150,
    averagePaceSecondsPer500m: pace,
    totalCalories: 12,
    powerWatts: watts,
    averageDragFactor: 120,
    ergMachineType: ErgMachineType.STATIC_D,
  }];
  const dateValue = 0x9a95;
  const timeValue = 0x0a1e;

  return {
    _v: 2,
    captureVersion: 2,
    captureId,
    status: 'completed',
    startedAt: '2026-09-21T14:30:00.000Z',
    completedAt: '2026-09-21T14:32:00.000Z',
    timezone: 'America/New_York',
    rawNotifications: [
      { ...startEvidence, sequence: 0 },
      { ...verificationEvidence, sequence: 1 },
    ],
    strokes,
    splits,
    summary: {
      workDistanceMeters: distance,
      workTimeSeconds: workTime,
      averagePaceSecondsPer500m: pace,
      averageStrokeRate: strokeRate,
      averageWatts: watts,
      totalCalories: 12,
      restDistanceMeters: 0,
      restTimeSeconds: 0,
      strokeCount,
    },
    rawEndSummary: {
      logDate: dateValue,
      logTime: timeValue,
      elapsedTime: workTime * 100,
      distance: distance * 10,
      averageStrokeRate: strokeRate,
      endingHeartRate: 150,
      averageHeartRate: 145,
      minHeartRate: 100,
      maxHeartRate: 160,
      averageDragFactor: 120,
      recoveryHeartRate: 90,
      workoutType: WorkoutType.FIXED_DISTANCE_SPLITS,
      averagePace: pace * 10,
    },
    rawAdditionalEndSummary: {
      logDate: dateValue,
      logTime: timeValue,
      intervalType: IntervalType.DISTANCE,
      intervalSize: distance,
      intervalCount: 1,
      totalCalories: 12,
      watts,
      totalRestDistance: 0,
      restTime: 0,
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
      ergMachineType: ErgMachineType.STATIC_D,
    },
    verification: {
      workoutVerified: true,
      verificationValue: 0x10,
      gameIdentifier: 0,
      evidence: verificationEvidence,
    },
    ergMachineType: ErgMachineType.STATIC_D,
    pmLogTimestamp: { dateValue, timeValue },
    startState: {
      status: {
        elapsedTime: 0,
        distance: 0,
        workoutType: WorkoutType.FIXED_DISTANCE_SPLITS,
        intervalType: IntervalType.DISTANCE,
        workoutState: WorkoutState.WORKOUT_ROW,
        rowingState: RowingState.INACTIVE,
        strokeState: StrokeState.WAITING_FOR_MINIMUM_SPEED,
        totalWorkDistance: distance,
      },
      evidence: startEvidence,
    },
  };
}
