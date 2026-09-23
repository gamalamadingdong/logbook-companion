import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PM5ConnectState, PM5WorkoutState, derivePM5FlowState } from './PM5Flow';
import { defaultWorkoutBuilderSpec } from '../../utils/workoutBuilder';

const request = {
  mode: 'exact' as const,
  request: { _v: 1 as const, type: 'fixed_distance' as const, value: 2000, programming_request_id: 'request-1' },
  notes: [],
};

const unsupported = { mode: 'unsupported' as const, request: null, notes: ['Not supported by PM5.'] };

const captureState = {
  phase: 'ingested' as const,
  capture: {
    _v: 2 as const,
    captureVersion: 2 as const,
    captureId: 'capture-1',
    status: 'completed' as const,
    startedAt: '2026-09-21T14:00:00.000Z',
    completedAt: '2026-09-21T14:01:00.000Z',
    timezone: 'America/New_York',
    rawNotifications: [],
    strokes: [],
    splits: [],
  },
  workoutId: 'workout-1',
};

const workoutProps = {
  translation: null,
  reviewing: false,
  builderSpec: defaultWorkoutBuilderSpec,
  onRwnChange: vi.fn(),
  onReview: vi.fn(),
  onBuilderChange: vi.fn(),
};

describe('PM5 five-state flow', () => {
  it('starts at Connect before a monitor is connected, whatever the workout', () => {
    // Connecting comes first: the monitor is what the athlete walks up to.
    expect(derivePM5FlowState({ translation: null, connected: false, receipt: null, captureState: null })).toBe('connect');
    expect(derivePM5FlowState({ translation: request, connected: false, receipt: null, captureState: null })).toBe('connect');
  });

  it('asks for the workout once a monitor is connected', () => {
    expect(derivePM5FlowState({ translation: null, connected: true, receipt: null, captureState: null })).toBe('workout');
  });

  it('is ready to row with a connected monitor and a valid workout', () => {
    expect(derivePM5FlowState({ translation: request, connected: true, receipt: null, captureState: null })).toBe('ready');
  });

  it('goes live once the workout is programmed, and ends at summary', () => {
    expect(derivePM5FlowState({ translation: request, connected: true, receipt: { _v: 1, request_id: 'request-1', status: 'programmed', received_at: 'now' }, captureState: null })).toBe('live');
    expect(derivePM5FlowState({ translation: null, connected: false, receipt: null, captureState })).toBe('summary');
  });

  it('keeps an unsupported workout out of Ready even with a monitor connected', () => {
    expect(derivePM5FlowState({ translation: unsupported, connected: true, receipt: null, captureState: null })).toBe('workout');
    const html = renderToStaticMarkup(
      <PM5WorkoutState {...workoutProps} rwn="30:00@20 + mobility" translation={unsupported} />,
    );
    expect(html).toContain('Unsupported on PM5');
    expect(html).not.toContain('>Row<');
  });

  it('offers both RWN and the guided builder', () => {
    const html = renderToStaticMarkup(<PM5WorkoutState {...workoutProps} rwn="2000m" />);
    expect(html).toContain('RWN');
    expect(html).toContain('Build it');
    expect(html).toContain('Check workout');
  });

  it('renders the connection action only in Connect', () => {
    const html = renderToStaticMarkup(
      <PM5ConnectState devices={[]} scanning={false} connecting={false} onScan={vi.fn()} onConnect={vi.fn()} />,
    );
    expect(html).toContain('Find PM5');
  });
});
