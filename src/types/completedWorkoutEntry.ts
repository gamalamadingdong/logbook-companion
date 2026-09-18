export type CompletedActivity = 'indoor_row' | 'ski_erg' | 'bike_erg' | 'run' | 'other';
export type CompletedEquipment = { brand: 'concept2' | 'other'; name: string } | null;
export type CompletionStatus = 'completed' | 'stopped_early';
export type SegmentTarget = { kind: 'distance' | 'time' | 'calories'; value: number } | null;

export interface CompletedSegment {
  role: 'work' | 'rest';
  label?: string;
  target: SegmentTarget;
  distanceMeters?: number;
  durationSeconds?: number;
  calories?: number;
  watts?: number;
}

export interface CompletedSummary {
  distanceMeters?: number;
  durationSeconds?: number;
  calories?: number;
  watts?: number;
  heartRate?: number;
  strokeRate?: number;
  perceivedExertion?: number;
}

export interface CompletedWorkoutDraft {
  activity: CompletedActivity;
  activityName?: string;
  equipment: CompletedEquipment;
  status: CompletionStatus;
  completedAt: string;
  timezone: string;
  summary: CompletedSummary;
  detailCoverage: 'none' | 'partial' | 'full';
  segments: CompletedSegment[];
  notes: string;
  plannedRwn: string | null;
}

export interface CompletedWorkoutEntryV1 extends CompletedWorkoutDraft {
  _v: 1;
  workTimeSeconds?: number;
}
