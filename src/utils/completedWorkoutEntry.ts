import { parseRWN } from './rwnParser';
import type { CompletedSegment, CompletedSummary, CompletedWorkoutDraft, CompletedWorkoutEntryV1 } from '../types/completedWorkoutEntry';

export function formatCompletedDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '–';
  const micros = Math.round(seconds * 1_000_000);
  const wholeSeconds = Math.floor(micros / 1_000_000);
  const fractional = micros % 1_000_000;
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainingSeconds = wholeSeconds % 60;
  const fraction = fractional ? '.' + String(fractional).padStart(6, '0').replace(/0+$/, '') : '';
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}${fraction}`
    : `${minutes}:${String(remainingSeconds).padStart(2, '0')}${fraction}`;
}

export function parseDurationInput(input: string): number | null {
  const parts = input.trim().split(':');
  if (parts.length < 1 || parts.length > 3 || parts.some((part) => !/^\d+(?:\.\d+)?$/.test(part))) return null;
  if (parts.length > 1 && (Number(parts.at(-1)) >= 60 || (parts.length === 3 && Number(parts[1]) >= 60))) return null;
  const seconds = parts.reduce((total, part) => total * 60 + Number(part), 0);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function validPositive(value: number | undefined, integer = false): boolean {
  return value === undefined || (Number.isFinite(value) && value > 0 && (!integer || Number.isSafeInteger(value)));
}

function validNonnegative(value: number | undefined, integer = false): boolean {
  return value === undefined || (Number.isFinite(value) && value >= 0 && (!integer || Number.isSafeInteger(value)));
}

function hasMeasurement(summary: CompletedSummary): boolean {
  return summary.distanceMeters !== undefined || summary.durationSeconds !== undefined || summary.calories !== undefined;
}

export function normalizeCompletedWorkoutDraft(draft: CompletedWorkoutDraft):
  | { ok: true; value: CompletedWorkoutEntryV1 }
  | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!['indoor_row', 'ski_erg', 'bike_erg', 'run', 'other'].includes(draft.activity)) errors.activity = 'Choose an activity.';
  if (!['completed', 'stopped_early'].includes(draft.status)) errors.status = 'Choose what happened.';
  if (draft.activity === 'other' && !draft.activityName?.trim()) errors.activityName = 'Name this activity.';
  if (!draft.completedAt || Number.isNaN(Date.parse(draft.completedAt))) errors.completedAt = 'Enter a valid finish time.';
  if (!draft.timezone) errors.timezone = 'Choose a valid timezone.';
  else {
    try {
      new Intl.DateTimeFormat('en', { timeZone: draft.timezone }).format();
    } catch {
      errors.timezone = 'Choose a valid timezone.';
    }
  }
  if (draft.equipment && (!['concept2', 'other'].includes(draft.equipment.brand) || !draft.equipment.name.trim())) {
    errors.equipment = 'Choose equipment or leave it unspecified.';
  }
  if (!validPositive(draft.summary.distanceMeters, true)) errors['summary.distanceMeters'] = 'Enter whole meters greater than zero.';
  if (!validPositive(draft.summary.durationSeconds)) errors['summary.durationSeconds'] = 'Enter a time greater than zero.';
  if (!validPositive(draft.summary.calories, true)) errors['summary.calories'] = 'Enter whole calories greater than zero.';
  if (!validPositive(draft.summary.watts, true)) errors['summary.watts'] = 'Enter whole average watts greater than zero.';
  if (!validPositive(draft.summary.heartRate, true)) errors['summary.heartRate'] = 'Enter a valid heart rate.';
  if (!validPositive(draft.summary.strokeRate, true)) errors['summary.strokeRate'] = 'Enter a valid stroke rate.';
  if (draft.summary.perceivedExertion !== undefined && (!Number.isInteger(draft.summary.perceivedExertion) || draft.summary.perceivedExertion < 1 || draft.summary.perceivedExertion > 10)) {
    errors['summary.perceivedExertion'] = 'Effort must be from 1 to 10.';
  }
  if (!['none', 'partial', 'full'].includes(draft.detailCoverage)) errors.detailCoverage = 'Choose how much of the session these segments cover.';
  if (draft.detailCoverage === 'none' && draft.segments.length) errors.detailCoverage = 'Choose full or partial detail for these segments.';
  if (draft.detailCoverage !== 'none' && !draft.segments.length) errors.segments = 'Add a segment or close interval detail.';

  let distance = 0;
  let elapsed = 0;
  let workTime = 0;
  let calories = 0;
  draft.segments.forEach((segment, index) => {
    const prefix = 'segments.' + index;
    if (!['work', 'rest'].includes(segment.role)) errors[prefix + '.role'] = 'Choose work or rest.';
    if (!validNonnegative(segment.distanceMeters, true) || !validNonnegative(segment.durationSeconds) ||
        !validNonnegative(segment.calories, true) || !validPositive(segment.watts, true)) {
      errors[prefix] = 'Check this segment’s measured values.';
    }
    if (segment.role === 'work' && segment.distanceMeters === undefined && segment.durationSeconds === undefined && segment.calories === undefined) {
      errors[prefix] = 'Enter at least one measured work value.';
    }
    if (segment.role === 'rest' && segment.distanceMeters === undefined && segment.durationSeconds === undefined) {
      errors[prefix] = 'Enter rest time or distance.';
    }
    if (segment.target && (!['distance', 'time', 'calories'].includes(segment.target.kind) || !validPositive(segment.target.value))) {
      errors[prefix + '.target'] = 'Check the planned target.';
    }
    distance += segment.distanceMeters ?? 0;
    elapsed += segment.durationSeconds ?? 0;
    calories += segment.calories ?? 0;
    if (segment.role === 'work') workTime += segment.durationSeconds ?? 0;
  });

  const summary = { ...draft.summary };
  if (draft.detailCoverage === 'full' && draft.segments.length) {
    if (summary.distanceMeters !== undefined && summary.distanceMeters !== distance) {
      errors['summary.distanceMeters'] = 'Segments add up to ' + distance + ' m; update the total or mark detail as partial.';
    }
    if (summary.durationSeconds !== undefined && Math.abs(summary.durationSeconds - elapsed) > 0.001) {
      errors['summary.durationSeconds'] = 'Segments add up to ' + elapsed + ' seconds; update the total or mark detail as partial.';
    }
    if (summary.calories !== undefined && calories > 0 && summary.calories !== calories) {
      errors['summary.calories'] = 'Segments add up to ' + calories + ' calories; update the total or mark detail as partial.';
    }
    if (distance > 0) summary.distanceMeters = distance;
    if (elapsed > 0) summary.durationSeconds = elapsed;
    if (calories > 0) summary.calories = calories;
  }
  if (!hasMeasurement(summary)) errors.summary = 'Enter distance, time, calories, or measured segments.';
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      ...draft,
      _v: 1,
      activityName: draft.activity === 'other' ? draft.activityName?.trim() : undefined,
      equipment: draft.equipment ? { ...draft.equipment, name: draft.equipment.name.trim() } : null,
      summary,
      notes: draft.notes.trim(),
      plannedRwn: draft.plannedRwn?.trim() || null,
      segments: draft.segments.map((segment) => ({ ...segment, label: segment.label?.trim() || undefined })),
      ...(draft.segments.length ? { workTimeSeconds: workTime } : {}),
    },
  };
}


export function scaffoldSegmentsFromRwn(rwn: string): CompletedSegment[] | null {
  const structure = parseRWN(rwn.trim());
  if (!structure) return null;
  if (structure.type === 'steady_state') return [];
  if (structure.type === 'interval') {
    const segments: CompletedSegment[] = [];
    for (let index = 0; index < structure.repeats; index += 1) {
      segments.push({
        role: 'work',
        target: {
          kind: structure.work.type === 'distance' ? 'distance' : structure.work.type === 'time' ? 'time' : 'calories',
          value: structure.work.value,
        },
      });
      if (index < structure.repeats - 1 && structure.rest.value > 0) {
        segments.push({ role: 'rest', target: { kind: 'time', value: structure.rest.value } });
      }
    }
    return segments;
  }
  return structure.steps.map((step) => ({
    role: step.type,
    target: {
      kind: step.duration_type === 'distance' ? 'distance' : step.duration_type === 'time' ? 'time' : 'calories',
      value: step.value,
    },
    ...(step.blockType ? { label: step.blockType } : {}),
  }));
}
