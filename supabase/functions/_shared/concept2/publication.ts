export type WorkoutSource = 'manual' | 'erg_link_live';
export type CompletedWorkoutShape = { kind: 'fixed_distance' } | { kind: 'fixed_time' };

export type CompletedWorkoutV1 = {
  _v: 1;
  workoutId: string;
  source: WorkoutSource;
  machine: 'rower';
  shape: CompletedWorkoutShape;
  completedAt: string;
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
  workout_type: 'unknown' | 'FixedTimeSplits';
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

export function completedWorkoutFromRow(row: PublicationWorkoutRow): CompletedWorkoutV1 {
  const raw = row.raw_data as Record<string, unknown> | null;
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
  workout: CompletedWorkoutV1,
  options: Concept2PublicationOptions,
): Concept2ResultPayload {
  if (workout._v !== 1 || workout.machine !== 'rower' ||
      !['fixed_distance', 'fixed_time'].includes(workout.shape.kind)) {
    throw new Error('Unsupported completed workout');
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
