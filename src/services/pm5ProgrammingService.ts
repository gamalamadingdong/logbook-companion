import type { Json } from '../types/database.types';
import type { ActiveWorkoutSpec } from '../types/ergSession.types';
import { parseRWN } from '../utils/rwnParser';
import { lowerWorkoutStructureToPm5, type Pm5LoweringMode } from '../utils/rwnPm5Lowering';
import { supabase } from './supabase';

export interface PM5ProgrammingMetadata {
  title?: string | null;
  templateId?: string | null;
  groupAssignmentId?: string | null;
  startType?: 'immediate' | 'synchronized';
}

export interface PM5ProgrammingDependencies {
  requestId: () => string;
  now: () => string;
}

export interface PM5ProgrammingRequestResult {
  mode: Pm5LoweringMode;
  request: ActiveWorkoutSpec | null;
  notes: string[];
}

const defaultDependencies: PM5ProgrammingDependencies = {
  requestId: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
};

export function stampPM5ProgrammingRequest(
  spec: ActiveWorkoutSpec,
  sourceRwn: string | null,
  mode: Exclude<Pm5LoweringMode, 'unsupported'>,
  notes: string[],
  metadata: PM5ProgrammingMetadata = {},
  dependencies: PM5ProgrammingDependencies = defaultDependencies,
): ActiveWorkoutSpec {
  return {
    ...spec,
    programming_request_id: dependencies.requestId(),
    programming_requested_at: dependencies.now(),
    source_rwn: sourceRwn ?? undefined,
    lowering_mode: mode,
    lowering_notes: notes,
    title: metadata.title ?? spec.title,
    template_id: metadata.templateId ?? spec.template_id,
    group_assignment_id: metadata.groupAssignmentId ?? spec.group_assignment_id,
    start_type: metadata.startType ?? spec.start_type,
  };
}

export function createPM5ProgrammingRequest(
  rwn: string,
  metadata: PM5ProgrammingMetadata = {},
  dependencies: PM5ProgrammingDependencies = defaultDependencies,
): PM5ProgrammingRequestResult {
  const structure = parseRWN(rwn);
  if (!structure) {
    return { mode: 'unsupported', request: null, notes: ['RWN could not be parsed.'] };
  }

  const lowered = lowerWorkoutStructureToPm5(structure);
  if (lowered.mode === 'unsupported' || !lowered.activeWorkoutSpec) {
    return { mode: 'unsupported', request: null, notes: lowered.notes };
  }

  return {
    mode: lowered.mode,
    notes: lowered.notes,
    request: stampPM5ProgrammingRequest(
      lowered.activeWorkoutSpec,
      rwn,
      lowered.mode,
      lowered.notes,
      metadata,
      dependencies,
    ),
  };
}

export async function publishPM5ProgrammingRequest(
  sessionId: string,
  request: ActiveWorkoutSpec,
): Promise<void> {
  const { error } = await supabase
    .from('erg_sessions')
    .update({ active_workout: request as unknown as Json, race_state: 0 })
    .eq('id', sessionId);
  if (error) throw error;
}
