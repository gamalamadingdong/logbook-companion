// Provider-independent completed result. V1 manual summaries remain supported during migration.
export type IntervalShape = 'fixed_distance_interval' | 'fixed_time_interval' | 'variable_interval';
export type MeasuredInterval = {
  kind: 'distance' | 'time';
  distanceMeters: number;
  workTimeSeconds: number;
  restDistanceMeters: number;
  restTimeSeconds: number;
};

export type SourceEvidenceReference = {
  captureId: string;
  schemaVersion: number;
  sampleCount: number;
  sha256: string;
  storageRef: string;
};

export type NormalizedSample = {
  sequence: number;
  elapsedSeconds: number;
  cumulativeDistanceMeters: number;
  intervalIndex?: number;
  heartRate?: number;
  strokeRate?: number;
  watts?: number;
};

export type CompletedWorkoutV2 = {
  _v: 2;
  workoutId: string;
  ownerId: string;
  source: 'manual' | 'erg_link_live' | 'synthetic_fixture';
  captureId?: string;
  captureVersion?: number;
  completionStatus: 'completed' | 'aborted' | 'incomplete_capture';
  machine: 'rower';
  shape: { kind: IntervalShape };
  completedAt: string;
  timezone: string;
  distanceMeters: number;
  workTimeSeconds: number;
  restDistanceMeters: number;
  restTimeSeconds: number;
  intervals: readonly MeasuredInterval[];
  sourceEvidence?: SourceEvidenceReference;
  normalizedSamples?: readonly NormalizedSample[];
  provenance?: {
    assignmentId?: string;
    templateId?: string;
    sessionId?: string;
  };
};

function validMeters(value: number, positive: boolean): boolean {
  return Number.isSafeInteger(value) && (positive ? value > 0 : value >= 0);
}

export function toDeciseconds(seconds: number, positive: boolean): number {
  const result = Math.round(seconds * 10);
  if (!Number.isSafeInteger(result) || (positive ? result <= 0 : result < 0) ||
      Math.abs(seconds * 10 - result) > 1e-7) {
    throw new Error('Measured time must use finite deciseconds');
  }
  return result;
}

export function validateCompletedWorkoutV2(workout: CompletedWorkoutV2): void {
  if (workout._v !== 2 || workout.machine !== 'rower' || !workout.shape ||
      !['fixed_distance_interval', 'fixed_time_interval', 'variable_interval'].includes(workout.shape.kind)) {
    throw new Error('Unsupported completed workout');
  }
  if (workout.completionStatus !== 'completed') throw new Error('Workout is not completed');
  if (!workout.workoutId || !workout.ownerId ||
      !['manual', 'erg_link_live', 'synthetic_fixture'].includes(workout.source) ||
      (workout.source === 'erg_link_live' && (!workout.captureId || !Number.isSafeInteger(workout.captureVersion) || Number(workout.captureVersion) < 1))) {
    throw new Error('Completed workout identity is incomplete');
  }
  if (workout.source === 'erg_link_live' && (!workout.sourceEvidence ||
      workout.sourceEvidence.captureId !== workout.captureId ||
      !Number.isSafeInteger(workout.sourceEvidence.sampleCount) || workout.sourceEvidence.sampleCount < 1 ||
      !/^[a-f0-9]{64}$/i.test(workout.sourceEvidence.sha256) ||
      !workout.sourceEvidence.storageRef || !Number.isSafeInteger(workout.sourceEvidence.schemaVersion) ||
      workout.sourceEvidence.schemaVersion < 1)) {
    throw new Error('ErgLink source evidence is incomplete');
  }
  if (!workout.completedAt || Number.isNaN(new Date(workout.completedAt).getTime()) ||
      !workout.timezone || !Array.isArray(workout.intervals) || workout.intervals.length < 2) {
    throw new Error('Completed interval evidence is incomplete');
  }
  if (!validMeters(workout.distanceMeters, true) || !validMeters(workout.restDistanceMeters, false)) {
    throw new Error('Invalid measured distance');
  }
  const workTime = toDeciseconds(workout.workTimeSeconds, true);
  const restTime = toDeciseconds(workout.restTimeSeconds, false);
  let totalDistance = 0, totalWorkTime = 0, totalRestDistance = 0, totalRestTime = 0;
  const first = workout.intervals[0];
  for (const interval of workout.intervals) {
    if (interval.kind !== 'distance' && interval.kind !== 'time') {
      throw new Error('Unsupported measured interval kind');
    }
    if (!validMeters(interval.distanceMeters, true) || !validMeters(interval.restDistanceMeters, false)) {
      throw new Error('Invalid measured interval distance');
    }
    const intervalWorkTime = toDeciseconds(interval.workTimeSeconds, true);
    const intervalRestTime = toDeciseconds(interval.restTimeSeconds, false);
    if (workout.shape.kind === 'fixed_distance_interval' &&
        (interval.kind !== 'distance' || interval.distanceMeters !== first.distanceMeters)) {
      throw new Error('Fixed-distance intervals require equal measured distances');
    }
    if (workout.shape.kind === 'fixed_time_interval' &&
        (interval.kind !== 'time' || intervalWorkTime !== toDeciseconds(first.workTimeSeconds, true))) {
      throw new Error('Fixed-time intervals require equal measured work times');
    }
    if (workout.shape.kind !== 'variable_interval' && interval.restDistanceMeters !== 0) {
      throw new Error('Fixed interval rest distance is unsupported');
    }
    totalDistance += interval.distanceMeters;
    totalWorkTime += intervalWorkTime;
    totalRestDistance += interval.restDistanceMeters;
    totalRestTime += intervalRestTime;
  }
  if (totalDistance !== workout.distanceMeters || totalWorkTime !== workTime ||
      totalRestDistance !== workout.restDistanceMeters || totalRestTime !== restTime) {
    throw new Error('Measured interval totals do not reconcile');
  }
}
