import { supabase } from './supabase';
import type { Database, Json } from '../types/database.types';
import type { CompletedActivity, CompletedWorkoutDraft, CompletedWorkoutEntryV1 } from '../types/completedWorkoutEntry';
import { normalizeCompletedWorkoutDraft } from '../utils/completedWorkoutEntry';

type WorkoutInsert = Database['public']['Tables']['workout_logs']['Insert'];
type WorkoutRow = Database['public']['Tables']['workout_logs']['Row'];

const activityNames: Record<CompletedActivity, string> = {
  indoor_row: 'Indoor row',
  ski_erg: 'Ski erg',
  bike_erg: 'Bike erg',
  run: 'Run',
  other: 'Workout',
};

const workoutTypes: Record<CompletedActivity, string> = {
  indoor_row: 'row',
  ski_erg: 'ski',
  bike_erg: 'bike',
  run: 'run',
  other: 'other',
};

export function completedActivityName(activity: CompletedActivity): string {
  return activityNames[activity];
}

export function buildCompletedWorkoutInsert(userId: string, result: CompletedWorkoutEntryV1): WorkoutInsert {
  const distance = result.summary.distanceMeters ?? null;
  const elapsed = result.summary.durationSeconds ?? null;
  const workTime = result.workTimeSeconds ?? elapsed;
  const isErg = result.activity === 'indoor_row' || result.activity === 'ski_erg';
  return {
    user_id: userId,
    source: 'manual',
    workout_type: workoutTypes[result.activity],
    workout_name: distance ? `${activityNames[result.activity]} · ${distance.toLocaleString()} m` : activityNames[result.activity],
    completed_at: result.completedAt,
    distance_meters: distance,
    duration_seconds: elapsed,
    duration_minutes: elapsed == null ? null : Math.round(elapsed / 60),
    avg_split_500m: isErg && workTime && distance ? (workTime / distance) * 500 : null,
    calories_burned: result.summary.calories ?? null,
    watts: result.summary.watts ?? null,
    average_heart_rate: result.summary.heartRate ?? null,
    average_stroke_rate: result.summary.strokeRate ?? null,
    perceived_exertion: result.summary.perceivedExertion ?? null,
    notes: result.notes || null,
    raw_data: {
      source: 'general_manual_entry',
      completed_result: result as unknown as Json,
    },
  };
}

export function readCompletedWorkoutFromRow(row: { source: WorkoutRow['source']; raw_data: unknown }): CompletedWorkoutEntryV1 | null {
  if (row.source !== 'manual' || !row.raw_data || typeof row.raw_data !== 'object' || Array.isArray(row.raw_data)) return null;
  const raw = row.raw_data as Record<string, Json | undefined>;
  if (raw.source !== 'general_manual_entry' || !raw.completed_result || typeof raw.completed_result !== 'object' || Array.isArray(raw.completed_result)) return null;
  const candidate = raw.completed_result as unknown as Record<string, unknown>;
  if (candidate._v !== 1) return null;
  const normalized = normalizeCompletedWorkoutDraft(candidate as unknown as CompletedWorkoutDraft);
  return normalized.ok ? normalized.value : null;
}

export async function createCompletedWorkout(userId: string, result: CompletedWorkoutEntryV1): Promise<string> {
  const { data, error } = await supabase
    .from('workout_logs')
    .insert(buildCompletedWorkoutInsert(userId, result))
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function getCompletedWorkout(id: string, userId: string): Promise<{ id: string; result: CompletedWorkoutEntryV1 } | null> {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('id, source, raw_data')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const result = readCompletedWorkoutFromRow(data);
  return result ? { id: data.id, result } : null;
}

export async function updateCompletedWorkout(id: string, userId: string, result: CompletedWorkoutEntryV1): Promise<void> {
  const { user_id: _userId, ...changes } = buildCompletedWorkoutInsert(userId, result);
  const { data, error } = await supabase
    .from('workout_logs')
    .update(changes)
    .eq('id', id)
    .eq('user_id', userId)
    .eq('source', 'manual')
    .contains('raw_data', { source: 'general_manual_entry' })
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This manual workout could not be updated. Reload it and try again.');
}
