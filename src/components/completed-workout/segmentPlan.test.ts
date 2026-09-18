import { describe, expect, it } from 'vitest';
import { scaffoldSegmentsFromRwn } from '../../utils/completedWorkoutEntry';
import { mergePlannedSegments } from './segmentPlan';

describe('mergePlannedSegments', () => {
  it('builds eight work and seven rest rows from 8x500m/3:00r without inventing results', () => {
    const plan = scaffoldSegmentsFromRwn('8x500m/3:00r');
    expect(plan).not.toBeNull();
    const { segments, discardedActualRows } = mergePlannedSegments([], plan!);
    expect(segments).toHaveLength(15);
    expect(segments.filter((segment) => segment.role === 'work')).toHaveLength(8);
    expect(segments.filter((segment) => segment.role === 'rest')).toHaveLength(7);
    expect(segments[0]).toMatchObject({ role: 'work', intervalKind: 'distance', targetKind: 'distance', targetValue: '500', distance: '', duration: '' });
    expect(segments[1]).toMatchObject({ role: 'rest', targetKind: 'time', targetValue: '3:00', distance: '', duration: '' });
    expect(discardedActualRows).toBe(0);
  });

  it('retains actual values and actual basis when the same plan is applied again', () => {
    const plan = scaffoldSegmentsFromRwn('2x500m/1:00r')!;
    const first = mergePlannedSegments([], plan).segments;
    first[0] = { ...first[0], intervalKind: 'time', distance: '510', duration: '1:58', watts: '220' };
    const result = mergePlannedSegments(first, plan);
    expect(result.discardedActualRows).toBe(0);
    expect(result.segments[0]).toMatchObject({ id: first[0].id, intervalKind: 'time', distance: '510', duration: '1:58', watts: '220' });
  });

  it('reports measured rows that would be replaced by a different plan', () => {
    const previous = mergePlannedSegments([], scaffoldSegmentsFromRwn('2x500m/1:00r')!).segments;
    previous[0] = { ...previous[0], distance: '500', duration: '2:00' };
    const result = mergePlannedSegments(previous, scaffoldSegmentsFromRwn('2x750m/1:00r')!);
    expect(result.discardedActualRows).toBe(1);
    expect(result.segments[0].distance).toBe('');
  });
});
