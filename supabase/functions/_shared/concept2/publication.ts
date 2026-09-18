import { toDeciseconds, validateCompletedWorkoutV2, type CompletedWorkoutV2 } from './completedWorkout.ts';
export type WorkoutSource = 'manual' | 'erg_link_live';
export type CompletedWorkoutShape = { kind: 'fixed_distance' } | { kind: 'fixed_time' };

export type CompletedWorkoutV1 = {
  _v: 1;
  workoutId: string;
  source: WorkoutSource;
  machine: 'rower';
  shape: CompletedWorkoutShape;
  completedAt: string;
  timezone?: string;
  distanceMeters: number;
  workTimeSeconds: number;
  restDistanceMeters: number;
  restTimeSeconds: number;
  detail?: {
    sourceEvidence?: unknown;
    normalizedSamples?: readonly unknown[];
  };
};

export type PublicationWorkoutRow = {
  id: string;
  user_id?: string;
  source: string | null;
  workout_type: string;
  completed_at: string;
  distance_meters: number | null;
  duration_seconds: number | null;
  rest_distance_meters: number | null;
  manual_rwn: string | null;
  external_id: string | null;
  template_id: string | null;
  raw_data: unknown;
};

export type Concept2PublicationOptions = {
  timezone: string;
  weightClass: 'H' | 'L';
  privacy: 'private' | 'partners' | 'logged_in' | 'everyone';
};

export type Concept2ResultPayload = {
  type: 'rower';
  date: string;
  timezone: string;
  distance: number;
  time: number;
  workout_type: 'unknown' | 'FixedTimeSplits' | 'FixedDistanceInterval' | 'FixedTimeInterval' | 'VariableInterval';
  rest_distance?: number;
  rest_time?: number;
  workout?: { intervals: Array<{ type: 'distance' | 'time'; distance: number; time: number; rest_time: number; rest_distance?: number }> };
  weight_class: 'H' | 'L';
  privacy: Concept2PublicationOptions['privacy'];
  comments: string;
};

function formatProviderDate(completedAt: string, timezone: string) {
  const date = new Date(completedAt);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid completion time');
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
}

export function completedWorkoutFromRow(row: PublicationWorkoutRow): CompletedWorkoutV1 | CompletedWorkoutV2 {
  const raw = row.raw_data as Record<string, unknown> | null;
  if (raw?.source === 'general_manual_entry') {
    const completed = raw.completed_result as Record<string, unknown> | null;
    const equipment = completed?.equipment as Record<string, unknown> | null;
    const summary = completed?.summary as Record<string, unknown> | null;
    const seconds = summary?.durationSeconds;
    const distance = summary?.distanceMeters;
    const finishedAt = typeof completed?.completedAt === 'string'
      ? new Date(completed.completedAt).getTime() : NaN;
    if (row.source !== 'manual' || row.workout_type !== 'row' ||
        !row.user_id || row.external_id !== null ||
        row.template_id !== ((completed?.plannedTemplate as Record<string, unknown> | undefined)?.id ?? null) ||
        row.manual_rwn !== null || !completed || completed._v !== 1 ||
        completed.activity !== 'indoor_row' || completed.status !== 'completed' ||
        equipment?.brand !== 'concept2' || equipment.name !== 'RowErg' ||
        typeof completed.timezone !== 'string' ||
        !Number.isFinite(finishedAt) || finishedAt > Date.now() ||
        finishedAt !== new Date(row.completed_at).getTime() ||
        !Number.isSafeInteger(distance) || Number(distance) <= 0 ||
        typeof seconds !== 'number' || !Number.isFinite(seconds) ||
        seconds <= 0 || seconds > 86_400 || seconds !== row.duration_seconds ||
        !Array.isArray(completed.segments)) {
      throw new Error('Only an intact completed Concept2 RowErg result is eligible');
    }
    try {
      new Intl.DateTimeFormat('en', { timeZone: completed.timezone }).format();
      toDeciseconds(seconds, true);
    } catch {
      throw new Error('Saved manual result timezone or elapsed time is invalid');
    }
    if (completed.detailCoverage === 'none') {
      if (distance !== row.distance_meters || (row.rest_distance_meters ?? 0) !== 0 ||
          completed.segments.length !== 0 || completed.workTimeSeconds !== undefined) {
        throw new Error('Only an intact completed single-piece Concept2 RowErg result is eligible');
      }
      return {
        _v: 1, workoutId: row.id, source: 'manual', machine: 'rower',
        shape: { kind: 'fixed_distance' }, completedAt: completed.completedAt as string,
        timezone: completed.timezone, distanceMeters: distance as number,
        workTimeSeconds: seconds, restDistanceMeters: 0, restTimeSeconds: 0,
      };
    }
    if (completed.detailCoverage !== 'full' || completed.segments.length < 2 ||
        typeof completed.workTimeSeconds !== 'number') {
      throw new Error('Full measured interval detail is required');
    }
    const intervals: Array<{ kind: 'distance' | 'time'; distanceMeters: number; workTimeSeconds: number;
      restDistanceMeters: number; restTimeSeconds: number }> = [];
    let workDistance = 0, workTime = 0, restDistance = 0, restTime = 0;
    let previousRole: string | undefined;
    for (const segment of completed.segments) {
      if (!segment || typeof segment !== 'object' || Array.isArray(segment)) {
        throw new Error('Invalid measured interval segment');
      }
      const measured = segment as Record<string, unknown>;
      if (measured.role === 'work') {
        if ((measured.intervalKind !== 'distance' && measured.intervalKind !== 'time') ||
            !Number.isSafeInteger(measured.distanceMeters) || Number(measured.distanceMeters) <= 0 ||
            typeof measured.durationSeconds !== 'number' || measured.durationSeconds <= 0) {
          throw new Error('Each work interval needs a type, distance and time');
        }
        toDeciseconds(measured.durationSeconds, true);
        intervals.push({ kind: measured.intervalKind as 'distance' | 'time',
          distanceMeters: measured.distanceMeters as number, workTimeSeconds: measured.durationSeconds,
          restDistanceMeters: 0, restTimeSeconds: 0 });
        workDistance += measured.distanceMeters as number;
        workTime += measured.durationSeconds;
      } else if (measured.role === 'rest') {
        if (!intervals.length || previousRole === 'rest' || measured.intervalKind !== undefined ||
            (measured.distanceMeters !== undefined &&
              (!Number.isSafeInteger(measured.distanceMeters) || Number(measured.distanceMeters) < 0)) ||
            (measured.durationSeconds !== undefined &&
              (typeof measured.durationSeconds !== 'number' || measured.durationSeconds < 0))) {
          throw new Error('Rest must follow a measured work interval');
        }
        const last = intervals[intervals.length - 1];
        last.restDistanceMeters = (measured.distanceMeters as number | undefined) ?? 0;
        last.restTimeSeconds = (measured.durationSeconds as number | undefined) ?? 0;
        toDeciseconds(last.restTimeSeconds, false);
        restDistance += last.restDistanceMeters;
        restTime += last.restTimeSeconds;
      } else {
        throw new Error('Unsupported measured segment role');
      }
      previousRole = measured.role as string;
    }
    if (intervals.length < 2 || !Number.isSafeInteger(workDistance) ||
        !Number.isSafeInteger(restDistance) || workDistance + restDistance !== distance ||
        workDistance !== row.distance_meters || restDistance !== (row.rest_distance_meters ?? 0) ||
        Math.abs(workTime + restTime - seconds) > 1e-7 ||
        Math.abs(workTime - completed.workTimeSeconds) > 1e-7) {
      throw new Error('Measured interval totals do not match the saved LC result');
    }
    const allDistance = intervals.every(item => item.kind === 'distance' &&
      item.distanceMeters === intervals[0].distanceMeters);
    const allTime = intervals.every(item => item.kind === 'time' &&
      item.workTimeSeconds === intervals[0].workTimeSeconds);
    const shape = restDistance === 0 && allDistance ? 'fixed_distance_interval'
      : restDistance === 0 && allTime ? 'fixed_time_interval' : 'variable_interval';
    const result: CompletedWorkoutV2 = {
      _v: 2, workoutId: row.id, ownerId: row.user_id, source: 'manual',
      completionStatus: 'completed', machine: 'rower', shape: { kind: shape },
      completedAt: completed.completedAt as string, timezone: completed.timezone,
      distanceMeters: workDistance, workTimeSeconds: workTime,
      restDistanceMeters: restDistance, restTimeSeconds: restTime, intervals,
      ...(row.template_id ? { provenance: { templateId: row.template_id } } : {}),
    };
    validateCompletedWorkoutV2(result);
    return result;
  }
  if (raw?.source === 'concept2_development_fixture') {
    const completed = raw.completed_workout as CompletedWorkoutV2 | undefined;
    if (row.source !== 'manual' || row.workout_type !== 'row' ||
        row.external_id !== null || row.template_id !== null || row.manual_rwn !== null ||
        typeof raw.fixture_name !== 'string' || !completed || completed.source !== 'synthetic_fixture' ||
        completed.workoutId !== row.id || completed.ownerId !== row.user_id ||
        new Date(completed.completedAt).getTime() !== new Date(row.completed_at).getTime() ||
        completed.distanceMeters !== row.distance_meters ||
        completed.workTimeSeconds !== row.duration_seconds ||
        completed.restDistanceMeters !== (row.rest_distance_meters ?? 0)) {
      throw new Error('Development fixture row does not match its completed result');
    }
    validateCompletedWorkoutV2(completed);
    return completed;
  }
  const rawShape = raw?.publication_shape;
  if (rawShape !== undefined && rawShape !== 'fixed_distance' && rawShape !== 'fixed_time') {
    throw new Error('Only a completed manual fixed-distance or fixed-time row is eligible');
  }
  const shape = rawShape === 'fixed_time' ? 'fixed_time' : 'fixed_distance';
  if (row.source !== 'manual' || row.workout_type !== 'row' ||
      raw?.source !== 'training_block_manual_entry' || raw.mode !== 'row' ||
      row.external_id !== null || row.template_id !== null ||
      !Number.isSafeInteger(row.distance_meters) || Number(row.distance_meters) <= 0 ||
      typeof row.duration_seconds !== 'number' || !Number.isFinite(row.duration_seconds) ||
      row.duration_seconds <= 0 || row.duration_seconds > 86_400 ||
      (row.rest_distance_meters ?? 0) !== 0 || Number.isNaN(new Date(row.completed_at).getTime())) {
    throw new Error('Only a completed manual fixed-distance or fixed-time row is eligible');
  }
  if (shape === 'fixed_distance' && row.manual_rwn !== `${row.distance_meters}m`) {
    throw new Error('Fixed-distance RWN must match measured distance');
  }
  if (shape === 'fixed_time' && (raw?.entry_surface !== 'concept2_development_test' ||
      row.manual_rwn !== `${row.duration_seconds}s`)) {
    throw new Error('Fixed-time publication evidence is incomplete');
  }
  return {
    _v: 1,
    workoutId: row.id,
    source: 'manual',
    machine: 'rower',
    shape: { kind: shape },
    completedAt: row.completed_at,
    distanceMeters: Number(row.distance_meters),
    workTimeSeconds: row.duration_seconds,
    restDistanceMeters: 0,
    restTimeSeconds: 0,
  };
}

export function mapCompletedWorkoutToConcept2(
  workout: CompletedWorkoutV1 | CompletedWorkoutV2,
  options: Concept2PublicationOptions,
): Concept2ResultPayload {
  if (workout._v === 2) {
    validateCompletedWorkoutV2(workout);
    if (options.timezone !== workout.timezone) throw new Error('Completed workout timezone differs from publication timezone');
    const typeByShape = {
      fixed_distance_interval: 'FixedDistanceInterval',
      fixed_time_interval: 'FixedTimeInterval',
      variable_interval: 'VariableInterval',
    } as const;
    return {
      type: 'rower',
      date: formatProviderDate(workout.completedAt, workout.timezone),
      timezone: workout.timezone,
      distance: workout.distanceMeters,
      time: toDeciseconds(workout.workTimeSeconds, true),
      workout_type: typeByShape[workout.shape.kind],
      rest_distance: workout.restDistanceMeters,
      rest_time: toDeciseconds(workout.restTimeSeconds, false),
      workout: { intervals: workout.intervals.map(interval => ({
        type: interval.kind,
        distance: interval.distanceMeters,
        time: toDeciseconds(interval.workTimeSeconds, true),
        rest_time: toDeciseconds(interval.restTimeSeconds, false),
        ...(workout.shape.kind === 'variable_interval'
          ? { rest_distance: interval.restDistanceMeters } : {}),
      })) },
      weight_class: options.weightClass,
      privacy: options.privacy,
      comments: `Logbook Companion workout ID: ${workout.workoutId}`,
    };
  }
  if (workout._v !== 1 || workout.machine !== 'rower' ||
      !['fixed_distance', 'fixed_time'].includes(workout.shape.kind)) {
    throw new Error('Unsupported completed workout');
  }
  if (workout.timezone && workout.timezone !== options.timezone) {
    throw new Error('Completed workout timezone differs from publication timezone');
  }
  if (!Number.isSafeInteger(workout.distanceMeters) || workout.distanceMeters <= 0 ||
      !Number.isFinite(workout.workTimeSeconds) || workout.workTimeSeconds <= 0 ||
      workout.restDistanceMeters !== 0 || workout.restTimeSeconds !== 0) {
    throw new Error('Invalid completed workout');
  }
  return {
    type: 'rower',
    date: formatProviderDate(workout.completedAt, options.timezone),
    timezone: options.timezone,
    distance: workout.distanceMeters,
    time: Math.round(workout.workTimeSeconds * 10),
    workout_type: workout.shape.kind === 'fixed_time' ? 'FixedTimeSplits' : 'unknown',
    weight_class: options.weightClass,
    privacy: options.privacy,
    comments: `Logbook Companion workout ID: ${workout.workoutId}`,
  };
}
