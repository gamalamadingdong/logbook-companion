import type { PM5Data } from '@readyall/erglink/pm5';

/**
 * Rowing-activity detection from PM5 telemetry.
 *
 * The published driver narrows the aggregated monitor payload to `PM5Data`
 * before it reaches the UI, so `workoutState` and `rowingState` are not
 * available to the application. Activity is therefore inferred from telemetry
 * that advances, which is sufficient to notice that an athlete has started
 * rowing without the application having programmed the piece.
 *
 * Reading the monitor's own workout state would be more direct and should
 * replace this once the driver surfaces it.
 */

/** How long telemetry may stall before rowing is considered to have stopped. */
export const ROWING_IDLE_TIMEOUT_MS = 5000;

export interface RowingActivityState {
  /** Whether the athlete appears to be rowing now. */
  rowing: boolean;
  /** When telemetry last advanced, in epoch milliseconds. */
  lastAdvanceAt: number | null;
  /** Telemetry from the previous sample, used to detect advancement. */
  lastSample: PM5Data | null;
}

export const initialRowingActivityState: RowingActivityState = {
  rowing: false,
  lastAdvanceAt: null,
  lastSample: null,
};

function advanced(previous: PM5Data | null, next: PM5Data): boolean {
  if (!previous) return false;
  return next.distance > previous.distance || next.elapsedTime > previous.elapsedTime;
}

/**
 * Fold a telemetry sample into the activity state.
 *
 * A sample counts as rowing when the monitor reports a stroke rate and either
 * distance or elapsed time has advanced since the previous sample. A single
 * advancing sample is not enough to end rowing, so stalls are handled by
 * {@link expireRowingActivity} rather than by an absent update.
 */
export function applyRowingSample(
  state: RowingActivityState,
  sample: PM5Data,
  now: number,
): RowingActivityState {
  const isAdvancing = advanced(state.lastSample, sample) && sample.strokeRate > 0;

  if (isAdvancing) {
    return { rowing: true, lastAdvanceAt: now, lastSample: sample };
  }

  return { ...state, lastSample: sample };
}

/**
 * Clear rowing once telemetry has stalled for longer than the idle timeout.
 * A paused or finished piece stops advancing rather than reporting an end.
 */
export function expireRowingActivity(
  state: RowingActivityState,
  now: number,
  idleTimeoutMs: number = ROWING_IDLE_TIMEOUT_MS,
): RowingActivityState {
  if (!state.rowing || state.lastAdvanceAt === null) return state;
  if (now - state.lastAdvanceAt < idleTimeoutMs) return state;
  return { ...state, rowing: false };
}

/** Reset activity when a monitor disconnects or a new session begins. */
export function resetRowingActivity(): RowingActivityState {
  return initialRowingActivityState;
}
