export type ManualWorkTotals = { distanceMeters: number; durationSeconds: number };

type ManualWork = { segments: Record<string, unknown>[]; workTimeSeconds: unknown };

function manualWork(raw: unknown): ManualWork | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const wrapper = raw as Record<string, unknown>;
  if (wrapper.source !== 'general_manual_entry') return null;
  const result = wrapper.completed_result;
  if (!result || typeof result !== 'object' || Array.isArray(result)) return null;
  const completed = result as Record<string, unknown>;
  if (completed.detailCoverage !== 'full' || !Array.isArray(completed.segments)) return null;
  const segments = completed.segments.filter((segment): segment is Record<string, unknown> =>
    !!segment && typeof segment === 'object' && !Array.isArray(segment) && segment.role === 'work');
  return segments.length ? { segments, workTimeSeconds: completed.workTimeSeconds } : null;
}

/** Rest duration does not count as work, even if total distance is not known. */
export function measuredManualWorkSeconds(raw: unknown): number | null {
  const work = manualWork(raw);
  if (!work || !work.segments.every((segment) => typeof segment.durationSeconds === 'number'
    && Number.isFinite(segment.durationSeconds) && segment.durationSeconds >= 0)) return null;
  const seconds = work.segments.reduce((sum, segment) => sum + (segment.durationSeconds as number), 0);
  if (seconds <= 0 || (typeof work.workTimeSeconds === 'number'
    && Math.abs(work.workTimeSeconds - seconds) > 0.001)) return null;
  return seconds;
}

/** Pace requires both measured work distance and measured work time. */
export function measuredManualWork(raw: unknown): ManualWorkTotals | null {
  const work = manualWork(raw);
  const durationSeconds = measuredManualWorkSeconds(raw);
  if (!work || durationSeconds === null || !work.segments.every((segment) =>
    typeof segment.distanceMeters === 'number' && Number.isFinite(segment.distanceMeters) && segment.distanceMeters >= 0)) return null;
  const distanceMeters = work.segments.reduce((sum, segment) => sum + (segment.distanceMeters as number), 0);
  return distanceMeters > 0 ? { distanceMeters, durationSeconds } : null;
}
