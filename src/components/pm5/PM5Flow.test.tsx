import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PM5ConnectState, PM5PreflightState, derivePM5FlowState } from './PM5Flow';

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

describe('PM5 five-state flow', () => {
  it('derives every explicit state', () => {
    expect(derivePM5FlowState({ translation: null, connected: false, receipt: null, captureState: null })).toBe('preflight');
    expect(derivePM5FlowState({ translation: request, connected: false, receipt: null, captureState: null })).toBe('connect');
    expect(derivePM5FlowState({ translation: request, connected: true, receipt: null, captureState: null })).toBe('ready');
    expect(derivePM5FlowState({ translation: request, connected: true, receipt: { _v: 1, request_id: 'request-1', status: 'programmed', received_at: 'now' }, captureState: null })).toBe('live');
    expect(derivePM5FlowState({ translation: null, connected: false, receipt: null, captureState })).toBe('summary');
  });

  it('keeps unsupported RWN in preflight even if a monitor is connected', () => {
    expect(derivePM5FlowState({ translation: unsupported, connected: true, receipt: null, captureState: null })).toBe('preflight');
    const html = renderToStaticMarkup(
      <PM5PreflightState rwn="30:00@20 + mobility" translation={unsupported} reviewing={false} onRwnChange={vi.fn()} onReview={vi.fn()} />,
    );
    expect(html).toContain('Unsupported on PM5');
    expect(html).not.toContain('Find PM5');
    expect(html).not.toContain('Program PM5');
  });

  it('renders the connection action only in Connect', () => {
    const html = renderToStaticMarkup(
      <PM5ConnectState devices={[]} scanning={false} connecting={false} onScan={vi.fn()} onConnect={vi.fn()} />,
    );
    expect(html).toContain('Find PM5');
  });
});
