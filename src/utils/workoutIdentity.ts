import { parseRWN } from './rwnParser';
import type { WorkoutStructure } from '../types/workoutStructure.types';

export interface IdentityWorkout {
  workout_type: string;
  manual_rwn: string | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  raw_workout_type: string | null;
  raw_workout: unknown;
}
type Step = { mode: string; unit: string; value: number; rest: number; guidance: unknown[] };
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const nonnegative = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
function modality(value: string): string | null {
  return ({ row: 'row', rower: 'row', rowerg: 'row', ski: 'ski', skierg: 'ski', bike: 'bike', bikeerg: 'bike', run: 'run' } as Record<string, string>)[value.toLowerCase()] ?? null;
}
const guidance = (s: { target_rate?: number; target_rate_max?: number; target_pace?: string; target_pace_max?: string; blockType?: string; tags?: string[] }) =>
  [s.target_rate ?? null, s.target_rate_max ?? null, s.target_pace ?? null, s.target_pace_max ?? null, s.blockType && s.blockType !== 'main' ? s.blockType : null, [...(s.tags ?? [])].sort()];
const emptyGuidance = [null, null, null, null, null, []];
function manualSteps(s: WorkoutStructure, machine: string): Step[] | null {
  if (s.sessionExtension || (s.modality && s.modality !== machine)) return null;
  const mode = s.modality ?? machine;
  if (s.type === 'steady_state') {
    if (s.subSegments?.length) return null;
    return [{ mode, unit: s.unit === 'meters' ? 'distance' : s.unit === 'seconds' ? 'time' : 'calories', value: s.value, rest: 0, guidance: guidance(s) }];
  }
  if (s.type === 'interval') {
    if (!Number.isInteger(s.repeats) || s.repeats < 1 || s.repeats > 1000 || s.tags?.length) return null;
    return Array.from({ length: s.repeats }, () => ({ mode, unit: s.work.type, value: s.work.value, rest: s.rest.value, guidance: guidance(s.work) }));
  }
  if (s.steps.length > 2000 || s.tags?.length) return null;
  const steps: Step[] = [];
  for (const step of s.steps) {
    if (step.modality && step.modality !== mode) return null;
    if (step.type === 'rest') {
      if (!steps.length || step.duration_type !== 'time' || !nonnegative(step.value)) return null;
      steps[steps.length - 1].rest += step.value;
    } else steps.push({ mode: step.modality ?? mode, unit: step.duration_type, value: step.value, rest: 0, guidance: guidance(step) });
  }
  return steps;
}
/** Conservative identity: no names, recording splits, or measured intensity. Unknown data cannot bulk-match. */
export function workoutIdentity(row: IdentityWorkout): string | null {
  const mode = modality(row.workout_type);
  if (!mode) return null;
  let steps: Step[] | null = null;
  if (row.manual_rwn?.trim()) {
    try {
      const structure = parseRWN(row.manual_rwn);
      if (!structure) return null;
      steps = manualSteps(structure, mode);
    } catch { return null; }
  } else {
    const type = row.raw_workout_type;
    if (['FixedDistance', 'FixedDistanceSplits', 'FixedDistanceNoSplits'].includes(type ?? '')) {
      steps = [{ mode, unit: 'distance', value: row.distance_meters!, rest: 0, guidance: emptyGuidance }];
    } else if (['FixedTime', 'FixedTimeSplits', 'FixedTimeNoSplits'].includes(type ?? '')) {
      steps = [{ mode, unit: 'time', value: row.duration_seconds!, rest: 0, guidance: emptyGuidance }];
    } else if (type?.endsWith('Interval') && record(row.raw_workout) && Array.isArray(row.raw_workout.intervals)) {
      steps = [];
      for (const interval of row.raw_workout.intervals) {
        if (!record(interval) || !['distance', 'time', 'calories'].includes(String(interval.type)) || !nonnegative(interval.rest_time)) return null;
        const unit = String(interval.type);
        const value = unit === 'time' && positive(interval.time) ? interval.time / 10 : unit === 'distance' ? interval.distance : interval.calories_total;
        if (!positive(value)) return null;
        steps.push({ mode, unit, value, rest: interval.rest_time / 10, guidance: emptyGuidance });
      }
    }
  }
  if (!steps?.length || steps.length > 1000 || steps.some(s => !positive(s.value) || !nonnegative(s.rest))) return null;
  return JSON.stringify(steps);
}
