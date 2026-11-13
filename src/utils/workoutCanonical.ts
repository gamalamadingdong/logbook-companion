import type { C2Interval, C2ResultDetail } from '../api/concept2.types';
import { getContinuousConcept2Name, isContinuousConcept2Workout } from '../../supabase/functions/_shared/concept2-workout-naming';
export { getContinuousConcept2Name } from '../../supabase/functions/_shared/concept2-workout-naming';
import type { WorkoutStructure } from '../types/workoutStructure.types';
import { parseRWN } from './rwnParser';
import { calculateCanonicalName } from './workoutNaming';
import { computeCanonicalName } from './structureAdapter';
import { normalizeForMatching } from './workoutNormalization';

const INVALID_CANONICAL = new Set(['', 'Unknown', 'Unstructured', 'Workout']);

export function normalizeCanonicalName(canonicalName: string | null | undefined): string | null {
  if (!canonicalName) return null;
  const normalized = normalizeForMatching(canonicalName.trim());
  if (!normalized || INVALID_CANONICAL.has(normalized)) return null;
  return normalized;
}

export function deriveCanonicalNameFromIntervals(intervals: C2Interval[] | null | undefined): string | null {
  if (!intervals || intervals.length === 0) return null;
  return normalizeCanonicalName(calculateCanonicalName(intervals));
}

/** Use the programmed workout mode before interpreting detailed rows as intervals. */
export function deriveCanonicalNameFromConcept2(result: Partial<C2ResultDetail>): string | null {
  if (isContinuousConcept2Workout(result.workout_type)) return getContinuousConcept2Name(result);
  return deriveCanonicalNameFromIntervals(result.workout?.intervals);
}

export function deriveCanonicalNameFromStructure(structure: WorkoutStructure | null | undefined): string | null {
  if (!structure) return null;
  return normalizeCanonicalName(computeCanonicalName(structure));
}

export function deriveCanonicalNameFromRWN(rwn: string | null | undefined): string | null {
  if (!rwn?.trim()) return null;
  const structure = parseRWN(rwn);
  if (!structure) return null;
  return deriveCanonicalNameFromStructure(structure);
}

export function canonicalSignatureFromCanonicalName(canonicalName: string | null | undefined): string | null {
  return normalizeCanonicalName(canonicalName);
}
