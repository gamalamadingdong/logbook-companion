/** Concept2 recording splits describe a continuous piece, not repeated efforts. */
export interface Concept2NamingSummary {
  workout_type?: string | null;
  distance?: number | null;
  time?: number | null; // Concept2 deciseconds, not seconds.
}

const distanceModes = new Set(['FixedDistance', 'FixedDistanceSplits', 'FixedDistanceNoSplits']);
const timeModes = new Set(['FixedTime', 'FixedTimeSplits', 'FixedTimeNoSplits']);

export function isContinuousConcept2Workout(type: string | null | undefined): boolean {
  return distanceModes.has(type ?? '') || timeModes.has(type ?? '') || type === 'JustRow';
}

export function getContinuousConcept2Name(summary: Concept2NamingSummary): string | null {
  const type = summary.workout_type ?? '';
  if (distanceModes.has(type) || type === 'JustRow') {
    if (!Number.isFinite(summary.distance) || (summary.distance ?? 0) <= 0) return null;
    const distance = Math.round(summary.distance!);
    return type === 'JustRow' ? `${distance}m JustRow` : `${distance}m`;
  }
  if (timeModes.has(type)) {
    if (!Number.isFinite(summary.time) || (summary.time ?? 0) <= 0) return null;
    const deciseconds = Math.round(summary.time!);
    const minutes = Math.floor(deciseconds / 600);
    const seconds = Math.floor((deciseconds % 600) / 10).toString().padStart(2, '0');
    const fraction = deciseconds % 10;
    return `${minutes}:${seconds}${fraction ? `.${fraction}` : ''}`;
  }
  return null;
}
