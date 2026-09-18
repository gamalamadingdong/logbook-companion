export interface SegmentForm {
  id: string;
  role: 'work' | 'rest';
  intervalKind: 'none' | 'distance' | 'time';
  label: string;
  targetKind: 'none' | 'distance' | 'time' | 'calories';
  targetValue: string;
  distance: string;
  duration: string;
  calories: string;
  watts: string;
}

export function newSegmentForm(role: 'work' | 'rest' = 'work'): SegmentForm {
  return {
    id: crypto.randomUUID(), role, intervalKind: 'none', label: '', targetKind: 'none', targetValue: '',
    distance: '', duration: '', calories: '', watts: '',
  };
}
