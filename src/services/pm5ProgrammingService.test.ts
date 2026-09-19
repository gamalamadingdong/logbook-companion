import { describe, expect, it } from 'vitest';
import { createPM5ProgrammingRequest } from './pm5ProgrammingService';

describe('PM5 programming request service', () => {
  it('creates an idempotent request from existing RWN lowering', () => {
    const result = createPM5ProgrammingRequest(
      '4x500m/1:00r',
      { title: 'Intervals', templateId: 'template-1' },
      {
        requestId: () => 'request-1',
        now: () => '2026-09-19T18:00:00.000Z',
      },
    );

    expect(result.mode).toBe('exact');
    expect(result.request).toMatchObject({
      _v: 1,
      programming_request_id: 'request-1',
      programming_requested_at: '2026-09-19T18:00:00.000Z',
      source_rwn: '4x500m/1:00r',
      lowering_mode: 'exact',
      type: 'interval_distance',
      split_value: 500,
      rest: 60,
      repeats: 4,
      title: 'Intervals',
      template_id: 'template-1',
    });
  });

  it('retains prompt-only guidance without changing the PM5-native core', () => {
    const result = createPM5ProgrammingRequest(
      'partner(on=4x500m/1:00r,off=wait,switch=every_rep)',
      {},
      { requestId: () => 'request-2', now: () => '2026-09-19T18:01:00.000Z' },
    );

    expect(result.mode).toBe('prompt_only');
    expect(result.request?.lowering_notes?.[0]).toContain("Session extension 'partner'");
    expect(result.request?.type).toBe('interval_distance');
  });

  it('does not create a delivery request for unsupported RWN', () => {
    const result = createPM5ProgrammingRequest(
      'v500m/40cal/500m',
      {},
      { requestId: () => 'request-3', now: () => '2026-09-19T18:02:00.000Z' },
    );

    expect(result.mode).toBe('unsupported');
    expect(result.request).toBeNull();
    expect(result.notes[0]).toContain('calorie');
  });
});
