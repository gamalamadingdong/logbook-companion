import { describe, expect, it } from 'vitest';
import type { PM5Data } from '@readyall/erglink/pm5';
import {
  ROWING_IDLE_TIMEOUT_MS,
  applyRowingSample,
  expireRowingActivity,
  initialRowingActivityState,
  resetRowingActivity,
} from './pm5ActivityDetection';

const sample = (overrides: Partial<PM5Data> = {}): PM5Data => ({
  timestamp: 0,
  distance: 0,
  pace: 0,
  strokeRate: 0,
  watts: 0,
  elapsedTime: 0,
  ...overrides,
});

describe('pm5 rowing activity detection', () => {
  it('does not report rowing from a single sample', () => {
    const state = applyRowingSample(initialRowingActivityState, sample({ distance: 10, strokeRate: 24 }), 1000);
    expect(state.rowing).toBe(false);
  });

  it('reports rowing once distance advances with a stroke rate', () => {
    let state = applyRowingSample(initialRowingActivityState, sample({ distance: 10, strokeRate: 24 }), 1000);
    state = applyRowingSample(state, sample({ distance: 14, strokeRate: 24 }), 2000);
    expect(state.rowing).toBe(true);
    expect(state.lastAdvanceAt).toBe(2000);
  });

  it('reports rowing when only elapsed time advances', () => {
    let state = applyRowingSample(initialRowingActivityState, sample({ elapsedTime: 5, strokeRate: 20 }), 1000);
    state = applyRowingSample(state, sample({ elapsedTime: 6, strokeRate: 20 }), 2000);
    expect(state.rowing).toBe(true);
  });

  it('ignores advancing telemetry with no stroke rate', () => {
    // Guards against treating a monitor that is merely powered on as rowing.
    let state = applyRowingSample(initialRowingActivityState, sample({ distance: 10 }), 1000);
    state = applyRowingSample(state, sample({ distance: 20 }), 2000);
    expect(state.rowing).toBe(false);
  });

  it('keeps rowing while telemetry stalls briefly', () => {
    let state = applyRowingSample(initialRowingActivityState, sample({ distance: 10, strokeRate: 24 }), 1000);
    state = applyRowingSample(state, sample({ distance: 14, strokeRate: 24 }), 2000);
    state = expireRowingActivity(state, 2000 + ROWING_IDLE_TIMEOUT_MS - 1);
    expect(state.rowing).toBe(true);
  });

  it('stops rowing once telemetry stalls past the idle timeout', () => {
    let state = applyRowingSample(initialRowingActivityState, sample({ distance: 10, strokeRate: 24 }), 1000);
    state = applyRowingSample(state, sample({ distance: 14, strokeRate: 24 }), 2000);
    state = expireRowingActivity(state, 2000 + ROWING_IDLE_TIMEOUT_MS);
    expect(state.rowing).toBe(false);
  });

  it('does not resurrect rowing from a repeated identical sample', () => {
    let state = applyRowingSample(initialRowingActivityState, sample({ distance: 14, strokeRate: 24 }), 1000);
    state = applyRowingSample(state, sample({ distance: 14, strokeRate: 24 }), 2000);
    expect(state.rowing).toBe(false);
  });

  it('resets to the initial state on disconnect', () => {
    expect(resetRowingActivity()).toEqual(initialRowingActivityState);
  });
});
