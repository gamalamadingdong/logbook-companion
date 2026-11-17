/** Portable, dependency-free view of a stored workout. Raw JSON never escapes this boundary. */
export interface WorkoutDetailRow {
  id: string;
  external_id?: string | null;
  source?: string | null;
  workout_type?: string | null;
  workout_name?: string | null;
  canonical_name?: string | null;
  completed_at?: string | null;
  distance_meters?: number | null;
  rest_distance_meters?: number | null;
  duration_seconds?: number | null;
  duration_minutes?: number | null;
  avg_split_500m?: number | null;
  watts?: number | null;
  average_heart_rate?: number | null;
  max_heart_rate?: number | null;
  average_stroke_rate?: number | null;
  calories_burned?: number | null;
  training_zone?: string | null;
  perceived_exertion?: number | null;
  rating?: number | null;
  notes?: string | null;
  is_benchmark?: boolean | null;
  manual_rwn?: string | null;
  template_id?: string | null;
  workout_structure?: unknown;
  raw_data?: unknown;
  updated_at?: string | null;
}

export interface WorkoutDetailSample {
  sequence_index: number;
  segment_index: number;
  time_seconds: number;
  distance_meters: number | null;
  pace_seconds_per_500m: number | null;
  watts: number | null;
  stroke_rate_spm: number | null;
  heart_rate_bpm: number | null;
}

export interface WorkoutDetailSplit {
  index: number;
  type: string | null;
  distance_meters: number | null;
  time_seconds: number | null;
  rest_seconds: number | null;
  stroke_rate_spm: number | null;
  watts: number | null;
  heart_rate_bpm: number | null;
}

type Summary = Omit<Required<WorkoutDetailRow>, 'raw_data' | 'duration_minutes' | 'manual_rwn' | 'template_id' | 'workout_structure' | 'updated_at'> & { time_formatted: string | null };
export interface WorkoutDetailDocument {
  schema_version: 1;
  summary: Summary;
  structure: { manual_rwn: string | null; template_id: string | null; workout_structure: unknown };
  splits: WorkoutDetailSplit[];
  intervals: WorkoutDetailSplit[];
  samples: WorkoutDetailSample[];
  sample_availability: {
    status: 'available' | 'missing' | 'unsupported' | 'invalid';
    reason: string | null;
    total_count: number;
    valid_count: number;
    rejected_count: number;
  };
  units: {
    time: 'seconds'; distance: 'meters'; pace: 'seconds_per_500m'; power: 'watts';
    heart_rate: 'beats_per_minute'; stroke_rate: 'strokes_per_minute';
  };
  provenance: {
    source: string | null;
    updated_at: string | null;
    time_basis: 'segment_elapsed';
    sample_encoding: 'concept2_t_d_p' | null;
    recorded_units: { t: 'deciseconds'; d: 'decimeters'; p: 'deciseconds_per_500m' } | null;
    normalization: string;
  };
}

const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown): string | null => typeof value === 'string' ? value : null;
const nonnegative = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const positive = (value: unknown): number | null => {
  const number = nonnegative(value);
  return number !== null && number > 0 ? number : null;
};
const scaled = (value: unknown, divisor: number): number | null => {
  const number = nonnegative(value);
  return number === null ? null : number / divisor;
};

function normalizeSplits(value: unknown): WorkoutDetailSplit[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    const split = object(entry);
    if (!split) return [];
    return [{
      index, type: text(split.type), distance_meters: nonnegative(split.distance),
      time_seconds: scaled(split.time, 10), rest_seconds: scaled(split.rest_time, 10),
      stroke_rate_spm: positive(split.stroke_rate), watts: positive(split.watts),
      heart_rate_bpm: positive(object(split.heart_rate)?.average),
    }];
  });
}

export function normalizeWorkoutDetail(row: WorkoutDetailRow): WorkoutDetailDocument {
  const raw = object(row.raw_data);
  const workout = object(raw?.workout);
  const supported = row.source === 'concept2';
  const stored = raw?.strokes;
  const samples: WorkoutDetailSample[] = [];
  let rejected = 0;
  let segment = 0;
  let previousTime: number | null = null;
  if (supported && Array.isArray(stored)) {
    stored.forEach((entry, sequence_index) => {
      const stroke = object(entry);
      const time = nonnegative(stroke?.t);
      if (!stroke || time === null) { rejected++; return; }
      const seconds = time / 10;
      if (previousTime !== null && seconds < previousTime) segment++;
      previousTime = seconds;
      const pace = scaled(positive(stroke.p), 10);
      const derivedWatts = pace === null ? null : positive(2.8 * Math.pow(500 / pace, 3));
      samples.push({
        sequence_index, segment_index: segment, time_seconds: seconds,
        distance_meters: scaled(stroke.d, 10), pace_seconds_per_500m: pace,
        watts: positive(stroke.watts) ?? derivedWatts, stroke_rate_spm: positive(stroke.spm),
        heart_rate_bpm: positive(stroke.hr),
      });
    });
  }
  let status: WorkoutDetailDocument['sample_availability']['status'];
  let reason: string | null = null;
  if (stored === undefined || stored === null || (Array.isArray(stored) && stored.length === 0)) {
    status = 'missing'; reason = 'No stored samples';
  } else if (!supported) {
    status = 'unsupported'; reason = 'Stored sample encoding is unsupported for this source';
  } else if (!Array.isArray(stored) || !samples.length) {
    status = 'invalid'; reason = 'No samples with valid nonnegative timestamps';
  } else { status = 'available'; }
  return {
    schema_version: 1,
    summary: {
      id: row.id, external_id: text(row.external_id), source: text(row.source),
      workout_type: text(row.workout_type), workout_name: text(row.workout_name),
      canonical_name: text(row.canonical_name), completed_at: text(row.completed_at),
      time_formatted: text(raw?.time_formatted),
      distance_meters: nonnegative(row.distance_meters),
      rest_distance_meters: nonnegative(row.rest_distance_meters),
      duration_seconds: nonnegative(row.duration_seconds) ?? (nonnegative(row.duration_minutes) === null ? null : nonnegative((row.duration_minutes as number) * 60)),
      avg_split_500m: positive(row.avg_split_500m), watts: positive(row.watts),
      average_heart_rate: positive(row.average_heart_rate), max_heart_rate: positive(row.max_heart_rate),
      average_stroke_rate: positive(row.average_stroke_rate), calories_burned: nonnegative(row.calories_burned),
      training_zone: text(row.training_zone), perceived_exertion: nonnegative(row.perceived_exertion),
      rating: nonnegative(row.rating), notes: text(row.notes),
      is_benchmark: typeof row.is_benchmark === 'boolean' ? row.is_benchmark : null,
    },
    structure: { manual_rwn: text(row.manual_rwn), template_id: text(row.template_id), workout_structure: row.workout_structure ?? raw?.workout_structure ?? null },
    splits: supported ? normalizeSplits(workout?.splits) : [],
    intervals: supported ? normalizeSplits(workout?.intervals) : [],
    samples,
    sample_availability: {
      status, reason, total_count: Array.isArray(stored) ? stored.length : 0,
      valid_count: samples.length, rejected_count: rejected,
    },
    units: { time: 'seconds', distance: 'meters', pace: 'seconds_per_500m', power: 'watts', heart_rate: 'beats_per_minute', stroke_rate: 'strokes_per_minute' },
    provenance: {
      source: text(row.source), updated_at: text(row.updated_at), time_basis: 'segment_elapsed', sample_encoding: supported ? 'concept2_t_d_p' : null,
      recorded_units: supported ? { t: 'deciseconds', d: 'decimeters', p: 'deciseconds_per_500m' } : null,
      normalization: 'Concept2 t/d/p scaled by 10. Watts = 2.8 / (pace_seconds_per_500m / 500)^3 unless explicit positive watts exists. Sequence retained; clock decreases start a new segment.',
    },
  };
}

export interface HeartRateAnalysis {
  status: 'available' | 'unavailable';
  reason: string | null;
  thresholdBpm: number;
  maxGapSeconds: number;
  method: 'linear_interpolation_strictly_above';
  secondsAboveThreshold: number | null;
  coveredSeconds: number;
  gapSeconds: number;
  missingHrSeconds: number;
  observedSpanSeconds: number;
  firstSampleTimeSeconds: number | null;
  lastSampleTimeSeconds: number | null;
}

/** Durations cover adjacent samples only. Gap and missing-HR exclusions are disjoint; gaps take priority. */
export function analyzeHeartRate(document: WorkoutDetailDocument, thresholdBpm: number, maxGapSeconds = 10): HeartRateAnalysis {
  if (positive(thresholdBpm) === null || positive(maxGapSeconds) === null) throw new RangeError('Threshold and maximum gap must be finite and positive');
  const samples = document.samples;
  let above = 0;
  let covered = 0;
  let gaps = 0;
  let missing = 0;
  let span = 0;
  for (let index = 1; index < samples.length; index++) {
    const previous = samples[index - 1];
    const current = samples[index];
    const duration = current.time_seconds - previous.time_seconds;
    if (previous.segment_index !== current.segment_index || duration <= 0) continue;
    span += duration;
    if (duration > maxGapSeconds) { gaps += duration; continue; }
    const a = previous.heart_rate_bpm;
    const b = current.heart_rate_bpm;
    // A rejected record between endpoints must never be silently bridged.
    if (a === null || b === null || current.sequence_index !== previous.sequence_index + 1) { missing += duration; continue; }
    covered += duration;
    if (a > thresholdBpm && b > thresholdBpm) above += duration;
    else if (a <= thresholdBpm && b <= thresholdBpm) continue;
    else above += duration * (Math.max(a, b) - thresholdBpm) / Math.abs(b - a);
  }
  return {
    status: covered > 0 ? 'available' : 'unavailable',
    reason: covered > 0 ? null : document.sample_availability.reason ?? 'No adjacent heart-rate samples with usable duration',
    thresholdBpm, maxGapSeconds, method: 'linear_interpolation_strictly_above',
    secondsAboveThreshold: covered > 0 ? above : null,
    coveredSeconds: covered, gapSeconds: gaps, missingHrSeconds: missing, observedSpanSeconds: span,
    firstSampleTimeSeconds: samples[0]?.time_seconds ?? null,
    lastSampleTimeSeconds: samples[samples.length - 1]?.time_seconds ?? null,
  };
}

const csvColumns: ReadonlyArray<keyof WorkoutDetailSample> = [
  'sequence_index', 'segment_index', 'time_seconds', 'distance_meters', 'pace_seconds_per_500m', 'watts', 'stroke_rate_spm', 'heart_rate_bpm',
];
/** Only finite numeric fields are serialized; text and personal notes cannot enter sample CSV. */
export function samplesToCsv(document: WorkoutDetailDocument): string {
  const lines = [csvColumns.join(',')];
  for (const sample of document.samples) {
    lines.push(csvColumns.map(key => typeof sample[key] === 'number' && Number.isFinite(sample[key]) ? String(sample[key]) : '').join(','));
  }
  return lines.join('\r\n') + '\r\n';
}
