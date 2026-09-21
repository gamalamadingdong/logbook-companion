import {
  IntervalType,
  WorkoutType,
  validatePm5Capture,
  type NormalizedSplitV2,
  type PM5CompletedCapture,
  type PM5CompletedCaptureV2,
} from '@readyall/erglink/pm5';
import type {
  Concept2HeartRatePayload,
  Concept2ResultPayload,
  Concept2SplitPayload,
} from '../../supabase/functions/_shared/concept2/publication';

export type Concept2CaptureProjection = Omit<
  Concept2ResultPayload,
  'weight_class' | 'privacy' | 'comments'
>;

const INTERVAL_WORKOUT_TYPES = new Set<number>([
  WorkoutType.FIXED_TIME_INTERVAL,
  WorkoutType.FIXED_DISTANCE_INTERVAL,
  WorkoutType.VARIABLE_INTERVAL,
  WorkoutType.VARIABLE_INTERVAL_UNDEFINED_REST,
]);

const VARIABLE_INTERVAL_WORKOUT_TYPES = new Set<number>([
  WorkoutType.VARIABLE_INTERVAL,
  WorkoutType.VARIABLE_INTERVAL_UNDEFINED_REST,
]);

function decodePmLogTimestamp(dateValue: number, timeValue: number): string {
  const dateLow = dateValue & 0xff;
  const dateHigh = (dateValue >> 8) & 0xff;
  const year = 2000 + (dateHigh & 0x7f);
  const month = (dateLow >> 4) & 0x0f;
  const day = (dateLow & 0x0f) | ((dateHigh & 0x80) >> 3);
  const minute = timeValue & 0xff;
  const hour = (timeValue >> 8) & 0xff;
  const instant = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59
    || instant.getUTCFullYear() !== year || instant.getUTCMonth() !== month - 1
    || instant.getUTCDate() !== day || instant.getUTCHours() !== hour
    || instant.getUTCMinutes() !== minute) {
    throw new Error('PM5 log timestamp is invalid');
  }
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:00`;
}

function positive(value: number | undefined): number | undefined {
  return value !== undefined && value > 0 ? Math.round(value) : undefined;
}

function heartRate(values: Concept2HeartRatePayload): Concept2HeartRatePayload | undefined {
  const result = Object.fromEntries(
    Object.entries(values).filter(([, value]) => typeof value === 'number' && value > 0 && value < 255),
  ) as Concept2HeartRatePayload;
  return Object.keys(result).length ? result : undefined;
}

function workoutType(capture: PM5CompletedCaptureV2): Concept2ResultPayload['workout_type'] {
  switch (capture.rawEndSummary?.workoutType) {
    case WorkoutType.FIXED_DISTANCE_NO_SPLITS:
    case WorkoutType.FIXED_DISTANCE_SPLITS:
      return 'FixedDistanceSplits';
    case WorkoutType.FIXED_TIME_NO_SPLITS:
    case WorkoutType.FIXED_TIME_SPLITS:
      return 'FixedTimeSplits';
    case WorkoutType.FIXED_TIME_INTERVAL:
      return 'FixedTimeInterval';
    case WorkoutType.FIXED_DISTANCE_INTERVAL:
      return 'FixedDistanceInterval';
    case WorkoutType.VARIABLE_INTERVAL:
      return 'VariableInterval';
    case WorkoutType.VARIABLE_INTERVAL_UNDEFINED_REST:
      return 'VariableIntervalUndefinedRest';
    default:
      throw new Error('PM5 workout type cannot be projected to Concept2');
  }
}

function intervalType(intervalType: number): NonNullable<Concept2SplitPayload['type']> {
  switch (intervalType) {
    case IntervalType.TIME:
    case IntervalType.TIME_UNDEFINED_REST:
      return 'time';
    case IntervalType.CALORIE:
    case IntervalType.CALORIE_UNDEFINED_REST:
      return 'calorie';
    case IntervalType.WATT_MINUTE:
    case IntervalType.WATT_MINUTE_UNDEFINED_REST:
      return 'wattminute';
    default:
      return 'distance';
  }
}

function splitPayload(split: NormalizedSplitV2, interval: boolean, variable: boolean): Concept2SplitPayload {
  const payload: Concept2SplitPayload = {
    distance: Math.round(split.workDistanceMeters),
    time: Math.round(split.workTimeSeconds * 10),
    ...(split.averageStrokeRate !== undefined ? { stroke_rate: Math.round(split.averageStrokeRate) } : {}),
    ...(split.totalCalories !== undefined ? { calories_total: Math.round(split.totalCalories) } : {}),
    ...(split.powerWatts !== undefined
      ? { wattminutes_total: Math.round(split.powerWatts * split.workTimeSeconds / 60) }
      : {}),
    ...(heartRate({ ending: split.workHeartRate, rest: split.restHeartRate })
      ? { heart_rate: heartRate({ ending: split.workHeartRate, rest: split.restHeartRate }) }
      : {}),
  };
  if (interval) {
    payload.type = intervalType(split.intervalType);
    payload.rest_time = Math.round(split.restTimeSeconds * 10);
    if (variable && split.restDistanceMeters > 0) payload.rest_distance = Math.round(split.restDistanceMeters);
  }
  return payload;
}

export function projectCaptureToConcept2(capture: PM5CompletedCapture): Concept2CaptureProjection {
  const validation = validatePm5Capture(capture);
  if (!validation.valid || capture._v !== 2 || !capture.summary || !capture.pmLogTimestamp || !capture.rawEndSummary) {
    const codes = validation.violations.map((violation) => violation.code).join(', ');
    throw new Error(`Invalid PM5 capture${codes ? `: ${codes}` : ''}`);
  }

  const interval = INTERVAL_WORKOUT_TYPES.has(capture.rawEndSummary.workoutType);
  const variable = VARIABLE_INTERVAL_WORKOUT_TYPES.has(capture.rawEndSummary.workoutType);
  const totalRestDistance = capture.splits.reduce((total, split) => total + split.restDistanceMeters, 0);
  const totalRestTimeSeconds = capture.splits.reduce((total, split) => total + split.restTimeSeconds, 0);
  const summaryHeartRate = heartRate({
    average: capture.rawEndSummary.averageHeartRate,
    min: capture.rawEndSummary.minHeartRate,
    max: capture.rawEndSummary.maxHeartRate,
    ending: capture.rawEndSummary.endingHeartRate,
    recovery: capture.rawEndSummary.recoveryHeartRate,
  });
  const splitValues = capture.splits.map((split) => splitPayload(split, interval, variable));

  return {
    type: 'rower',
    date: decodePmLogTimestamp(capture.pmLogTimestamp.dateValue, capture.pmLogTimestamp.timeValue),
    timezone: capture.timezone,
    distance: Math.round(capture.summary.workDistanceMeters),
    time: Math.round(capture.summary.workTimeSeconds * 10),
    workout_type: workoutType(capture),
    stroke_rate: Math.round(capture.summary.averageStrokeRate),
    stroke_count: capture.summary.strokeCount,
    calories_total: Math.round(capture.summary.totalCalories),
    wattminutes_total: Math.round(capture.summary.averageWatts * capture.summary.workTimeSeconds / 60),
    ...(capture.rawEndSummary.averageDragFactor > 0
      ? { drag_factor: Math.round(capture.rawEndSummary.averageDragFactor) }
      : {}),
    ...(summaryHeartRate ? { heart_rate: summaryHeartRate } : {}),
    ...(interval ? {
      rest_distance: Math.round(totalRestDistance),
      rest_time: Math.round(totalRestTimeSeconds * 10),
      workout: { intervals: splitValues },
    } : {
      workout: { splits: splitValues },
    }),
    stroke_data: capture.strokes.map((stroke) => ({
      t: Math.round(stroke.intervalElapsedSeconds * 10),
      d: Math.round(stroke.intervalDistanceMeters * 10),
      ...(positive(stroke.paceSecondsPer500m) !== undefined
        ? { p: Math.round(stroke.paceSecondsPer500m! * 10) }
        : {}),
      ...(positive(stroke.strokeRate) !== undefined ? { spm: Math.round(stroke.strokeRate!) } : {}),
      ...(positive(stroke.heartRate) !== undefined ? { hr: Math.round(stroke.heartRate!) } : {}),
    })),
  };
}
