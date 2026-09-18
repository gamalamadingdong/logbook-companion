import type { CompletedSegment } from '../../types/completedWorkoutEntry';
import { formatCompletedDuration } from '../../utils/completedWorkoutEntry';
import { newSegmentForm, type SegmentForm } from './segmentForm';

function hasActual(segment: SegmentForm): boolean {
  return Boolean(segment.distance || segment.duration || segment.calories || segment.watts);
}

/** Reapply a plan without assigning measured values to a different target. */
export function mergePlannedSegments(existing: SegmentForm[], plan: CompletedSegment[]): {
  segments: SegmentForm[];
  discardedActualRows: number;
} {
  const matched = new Set<number>();
  const segments = plan.map((item, index) => {
    const previous = existing[index];
    const targetKind = item.target?.kind ?? 'none';
    const targetValue = item.target
      ? item.target.kind === 'time' ? formatCompletedDuration(item.target.value) : String(item.target.value)
      : '';
    const samePlan = previous?.role === item.role && previous.targetKind === targetKind && previous.targetValue === targetValue;
    if (samePlan) matched.add(index);
    return {
      ...(samePlan ? previous : newSegmentForm(item.role)),
      role: item.role,
      intervalKind: samePlan ? previous.intervalKind : item.intervalKind ?? 'none',
      label: samePlan ? previous.label : item.label ?? '',
      targetKind,
      targetValue,
    } satisfies SegmentForm;
  });
  return {
    segments,
    discardedActualRows: existing.filter((segment, index) => !matched.has(index) && hasActual(segment)).length,
  };
}
