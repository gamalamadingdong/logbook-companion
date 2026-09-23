import { parseRWN } from '@readyall/rwn';

/**
 * Guided workout builder.
 *
 * RWN stays the single representation a workout is expressed in. Athletes who
 * do not write RWN describe the workout with plain fields here, and those
 * fields are turned into RWN rather than into a parallel format. Everything
 * downstream — validation, PM5 lowering, programming, naming — therefore takes
 * the same path whichever way the workout was entered.
 *
 * Generated notation is parsed before being offered, so the builder can never
 * hand the PM5 path notation it would reject.
 */

export type WorkoutBuilderMode = 'steady' | 'intervals';
export type WorkoutBuilderMeasure = 'distance' | 'time';

export interface WorkoutBuilderSpec {
  mode: WorkoutBuilderMode;
  measure: WorkoutBuilderMeasure;
  /** Number of work intervals. Ignored for steady state. */
  repeats: number;
  /** Work distance in metres, when measuring by distance. */
  distanceMeters: number;
  /** Work duration in seconds, when measuring by time. */
  durationSeconds: number;
  /** Rest between intervals in seconds. Ignored for steady state. */
  restSeconds: number;
}

export interface WorkoutBuilderResult {
  rwn: string | null;
  errors: string[];
}

export const defaultWorkoutBuilderSpec: WorkoutBuilderSpec = {
  mode: 'steady',
  measure: 'distance',
  repeats: 4,
  distanceMeters: 2000,
  durationSeconds: 1200,
  restSeconds: 60,
};

/** Format seconds as the `M:SS` duration RWN uses. */
export function formatRwnDuration(totalSeconds: number): string {
  const whole = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(whole / 60);
  const seconds = whole % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function validate(spec: WorkoutBuilderSpec): string[] {
  const errors: string[] = [];

  if (spec.measure === 'distance') {
    if (!Number.isFinite(spec.distanceMeters) || spec.distanceMeters <= 0) {
      errors.push('Enter a distance greater than zero.');
    } else if (!Number.isInteger(spec.distanceMeters)) {
      errors.push('Distance must be a whole number of metres.');
    }
  } else if (!Number.isFinite(spec.durationSeconds) || spec.durationSeconds <= 0) {
    errors.push('Enter a duration greater than zero.');
  }

  if (spec.mode === 'intervals') {
    if (!Number.isInteger(spec.repeats) || spec.repeats < 1) {
      errors.push('Enter at least one interval.');
    }
    if (!Number.isFinite(spec.restSeconds) || spec.restSeconds <= 0) {
      errors.push('Enter a rest greater than zero.');
    }
  }

  return errors;
}

function composeRwn(spec: WorkoutBuilderSpec): string {
  const work = spec.measure === 'distance'
    ? `${Math.round(spec.distanceMeters)}m`
    : formatRwnDuration(spec.durationSeconds);

  if (spec.mode === 'steady') return work;

  return `${spec.repeats}x${work}/${formatRwnDuration(spec.restSeconds)}r`;
}

/**
 * Build RWN from builder fields.
 *
 * The composed notation is parsed before it is returned. A parse failure is
 * reported as an error rather than passed on, so the builder cannot produce
 * something the rest of the workout path cannot read.
 */
export function buildRwnFromSpec(spec: WorkoutBuilderSpec): WorkoutBuilderResult {
  const errors = validate(spec);
  if (errors.length > 0) return { rwn: null, errors };

  const rwn = composeRwn(spec);

  if (!parseRWN(rwn)) {
    return {
      rwn: null,
      errors: [`Could not build a valid workout from these values (${rwn}).`],
    };
  }

  return { rwn, errors: [] };
}
