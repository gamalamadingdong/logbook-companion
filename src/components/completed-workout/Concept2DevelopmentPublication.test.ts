import { describe, expect, it } from 'vitest';
import { manualConcept2Preview, manualConcept2PublishBlocker } from './Concept2DevelopmentPublication';
import type { CompletedWorkoutEntryV1 } from '../../types/completedWorkoutEntry';

const result: CompletedWorkoutEntryV1 = {
  _v: 1, activity: 'indoor_row', equipment: { brand: 'concept2', name: 'RowErg' },
  status: 'completed', completedAt: '2026-09-18T12:30:00.000Z', timezone: 'America/New_York',
  summary: { distanceMeters: 1240, durationSeconds: 345 }, detailCoverage: 'full',
  segments: [
    { role: 'work', intervalKind: 'distance', target: null, distanceMeters: 500, durationSeconds: 120 },
    { role: 'rest', target: null, distanceMeters: 25, durationSeconds: 30 },
    { role: 'work', intervalKind: 'time', target: null, distanceMeters: 700, durationSeconds: 180 },
    { role: 'rest', target: null, distanceMeters: 15, durationSeconds: 15 },
  ],
  workTimeSeconds: 300, notes: '', plannedRwn: '500m/0:30r+3:00/0:15r',
};

describe('manual Concept2 publication preview', () => {
  it('explains why a saved indoor row with unspecified equipment cannot publish', () => {
    const withoutEquipment = { ...result, equipment: null };
    expect(manualConcept2Preview(withoutEquipment)).toBeNull();
    expect(manualConcept2PublishBlocker(withoutEquipment)).toBe('Choose Concept2 RowErg as the equipment to publish this workout.');
    expect(manualConcept2PublishBlocker(result)).toBeNull();
  });
  it('shows the measured work and rest for variable intervals', () => {
    expect(manualConcept2Preview(result)).toEqual({ label: '2 variable intervals',
      distance: 1200, seconds: 300, restSeconds: 45, restDistance: 40 });
  });
  it('supports two adjacent measured work intervals without rest', () => {
    const adjacent = { ...result, summary: { distanceMeters: 1200, durationSeconds: 300 },
      segments: result.segments.filter(segment => segment.role === 'work') };
    expect(manualConcept2Preview(adjacent)).toMatchObject({ label: '2 variable intervals',
      distance: 1200, seconds: 300, restSeconds: 0, restDistance: 0 });
  });
  it('hides publication when interval detail or totals are incomplete', () => {
    expect(manualConcept2Preview({ ...result, detailCoverage: 'partial' })).toBeNull();
    expect(manualConcept2Preview({ ...result, summary: { distanceMeters: 1200, durationSeconds: 345 } })).toBeNull();
    expect(manualConcept2Preview({ ...result, segments: result.segments.map((segment, index) => index === 0 ? { ...segment, intervalKind: undefined } : segment) })).toBeNull();
  });
});
