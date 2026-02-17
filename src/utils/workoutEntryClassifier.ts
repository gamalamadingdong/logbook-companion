/**
 * Workout Entry Classifier
 *
 * Parses a canonical name (RWN) and determines:
 *  - what type of result entry the coach needs
 *  - which fields are fixed (prescribed) and which are measured
 *  - how many reps/intervals to scaffold
 *
 * Used by the Results Entry modal to show only the relevant input fields.
 */

import { parseRWN } from './rwnParser';

// ─── Types ──────────────────────────────────────────────────────────────────

export type EntryType =
  | 'fixed_distance'      // e.g. 10000m — enter time + spm
  | 'fixed_time'          // e.g. 30:00  — enter distance + spm
  | 'distance_interval'   // e.g. 4x500m/1:00r — enter time per rep + spm
  | 'time_interval'       // e.g. 3x10:00/2:00r — enter distance per rep + spm
  | 'variable_interval'   // e.g. v500m/1000m/1500m — mixed rep values
  | 'freeform';           // unknown — enter time + distance + spm

export interface VariableRep {
  /** 'distance' or 'time' — what's fixed for this rep */
  fixedType: 'distance' | 'time';
  /** The prescribed value (meters or seconds) */
  fixedValue: number;
  /** Display label, e.g. "500m" or "10:00" */
  label: string;
}

export interface EntryShape {
  type: EntryType;

  /** For fixed_distance: total meters. For distance_interval: meters per rep */
  fixedDistance?: number;
  /** For fixed_time: total seconds. For time_interval: seconds per rep */
  fixedTime?: number;

  /** Number of reps (1 for steady state, N for intervals) */
  reps: number;

  /** For variable_interval: per-rep details */
  variableReps?: VariableRep[];

  /** Human-readable description of the workout shape */
  label: string;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Parse a canonical name and return the entry shape for results capture.
 *
 * @param canonical - RWN canonical name (e.g. "10000m", "4x500m/1:00r")
 * @returns EntryShape describing what fields the coach needs to enter
 */
export function parseCanonicalForEntry(canonical: string | null | undefined): EntryShape {
  if (!canonical) {
    return { type: 'freeform', reps: 1, label: 'Workout' };
  }

  const normalized = normalizeNotation(canonical);

  const structure = parseRWN(normalized);
  if (!structure) {
    const ladder = parseSimpleVariableLadder(normalized);
    if (ladder) {
      return ladder;
    }
    return { type: 'freeform', reps: 1, label: canonical };
  }

  switch (structure.type) {
    case 'steady_state': {
      if (structure.unit === 'meters') {
        return {
          type: 'fixed_distance',
          fixedDistance: structure.value,
          reps: 1,
          label: `${structure.value}m`,
        };
      }
      if (structure.unit === 'seconds') {
        return {
          type: 'fixed_time',
          fixedTime: structure.value,
          reps: 1,
          label: formatTimeLabel(structure.value),
        };
      }
      // calories — treat as freeform
      return { type: 'freeform', reps: 1, label: canonical };
    }

    case 'interval': {
      if (structure.work.type === 'distance') {
        return {
          type: 'distance_interval',
          fixedDistance: structure.work.value,
          reps: structure.repeats,
          label: `${structure.repeats}×${structure.work.value}m`,
        };
      }
      if (structure.work.type === 'time') {
        return {
          type: 'time_interval',
          fixedTime: structure.work.value,
          reps: structure.repeats,
          label: `${structure.repeats}×${formatTimeLabel(structure.work.value)}`,
        };
      }
      // calories interval — freeform
      return { type: 'freeform', reps: structure.repeats, label: canonical };
    }

    case 'variable': {
      // Extract work steps only (skip rest steps)
      const workSteps = structure.steps.filter((s) => s.type === 'work');
      if (workSteps.length === 0) {
        const ladder = parseSimpleVariableLadder(normalized);
        if (ladder) {
          return ladder;
        }
        return { type: 'freeform', reps: 1, label: canonical };
      }

      const variableReps: VariableRep[] = workSteps.map((step) => {
        if (step.duration_type === 'distance') {
          return {
            fixedType: 'distance' as const,
            fixedValue: step.value,
            label: `${step.value}m`,
          };
        }
        return {
          fixedType: 'time' as const,
          fixedValue: step.value,
          label: formatTimeLabel(step.value),
        };
      });

      return {
        type: 'variable_interval',
        reps: variableReps.length,
        variableReps,
        label: normalized,
      };
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTimeLabel(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (secs === 0) return `${mins}:00`;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function normalizeNotation(input: string): string {
  return input
    .replace(/[＋]/g, '+')
    .replace(/[−–—]/g, '-')
    .replace(/\s*\+\s*/g, ' + ')
    .replace(/\s*\/\s*/g, '/');
}

function parseSimpleVariableLadder(canonical: string): EntryShape | null {
  const parts = canonical
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return null;
  }

  const variableReps: VariableRep[] = [];

  for (const part of parts) {
    const slashIndex = part.indexOf('/');
    if (slashIndex === -1) {
      return null;
    }

    const workRaw = part.slice(0, slashIndex).trim();
    if (!workRaw) {
      return null;
    }

    if (/^\d+m$/i.test(workRaw)) {
      const meters = parseInt(workRaw.replace(/m/i, ''), 10);
      if (!Number.isFinite(meters) || meters <= 0) {
        return null;
      }
      variableReps.push({
        fixedType: 'distance',
        fixedValue: meters,
        label: `${meters}m`,
      });
      continue;
    }

    const timeSeconds = parseTimeInput(workRaw);
    if (timeSeconds == null || timeSeconds <= 0) {
      return null;
    }

    variableReps.push({
      fixedType: 'time',
      fixedValue: timeSeconds,
      label: formatTimeLabel(Math.round(timeSeconds)),
    });
  }

  if (variableReps.length === 0) {
    return null;
  }

  return {
    type: 'variable_interval',
    reps: variableReps.length,
    variableReps,
    label: canonical,
  };
}

/**
 * Compute split (seconds per 500m) from time and distance.
 */
export function computeSplit(timeSeconds: number, distanceMeters: number): number | null {
  if (distanceMeters <= 0 || timeSeconds <= 0) return null;
  return (timeSeconds / distanceMeters) * 500;
}

/**
 * Compute distance from time and split.
 */
export function computeDistance(timeSeconds: number, splitSeconds: number): number | null {
  if (splitSeconds <= 0 || timeSeconds <= 0) return null;
  return (timeSeconds / splitSeconds) * 500;
}

/**
 * Format seconds → m:ss.s display string
 */
export function fmtTime(s: number | null | undefined): string {
  if (s == null || s <= 0) return '';
  const mins = Math.floor(s / 60);
  const secs = (s % 60).toFixed(1).padStart(4, '0');
  return `${mins}:${secs}`;
}

/**
 * Parse m:ss.s or raw seconds → number | null
 */
export function parseTimeInput(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  if (t.includes(':')) {
    const [m, s] = t.split(':');
    const mins = parseInt(m, 10);
    const secs = parseFloat(s);
    if (isNaN(mins) || isNaN(secs)) return null;
    return mins * 60 + secs;
  }
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}
