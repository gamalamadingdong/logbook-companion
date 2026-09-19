import { describe, expect, it } from 'vitest';
import { measuredManualWork, measuredManualWorkSeconds } from './completedWorkoutMetrics';

describe('measured manual work', () => {
  it('uses only measured work pieces when a complete result includes rest', () => {
    expect(measuredManualWork({ source: 'general_manual_entry', completed_result: {
      detailCoverage: 'full', workTimeSeconds: 240, segments: [
        { role: 'work', distanceMeters: 500, durationSeconds: 120 },
        { role: 'rest', distanceMeters: 25, durationSeconds: 60 },
        { role: 'work', distanceMeters: 500, durationSeconds: 120 },
      ],
    } })).toEqual({ distanceMeters: 1000, durationSeconds: 240 });
  });

  it('counts known work time even when work distance is incomplete', () => {
    const raw = { source: 'general_manual_entry', completed_result: {
      detailCoverage: 'full', workTimeSeconds: 120, segments: [
        { role: 'work', durationSeconds: 120 },
        { role: 'rest', durationSeconds: 60 },
      ],
    } };
    expect(measuredManualWorkSeconds(raw)).toBe(120);
    expect(measuredManualWork(raw)).toBeNull();
  });

  it('does not turn partial or missing measurements into complete work totals', () => {
    expect(measuredManualWork({ source: 'general_manual_entry', completed_result: {
      detailCoverage: 'partial', segments: [{ role: 'work', distanceMeters: 500, durationSeconds: 120 }],
    } })).toBeNull();
    expect(measuredManualWork({ source: 'general_manual_entry', completed_result: {
      detailCoverage: 'full', segments: [{ role: 'work', distanceMeters: 500 }],
    } })).toBeNull();
  });
});
