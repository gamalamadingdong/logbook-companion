import type { PM5CompletedCapture, PM5CompletedCaptureV2 } from '@readyall/erglink/pm5';
import { validatePm5Capture } from '@readyall/erglink/pm5';
import type { Json } from '../types/database.types';
import type { ActiveWorkoutSpec } from '../types/ergSession.types';
import { projectCaptureToConcept2 } from './concept2CaptureProjection';
import { supabase } from './supabase';
import { normalizeCanonicalName } from '../utils/workoutCanonical';

export interface PM5CaptureIngestionResult {
  workoutId: string;
  replayed: boolean;
}

export interface PM5WorkoutInsert {
  user_id: string;
  external_id: string;
  source: 'erg_link_live';
  workout_name: string;
  workout_type: 'rower';
  completed_at: string;
  distance_meters: number;
  rest_distance_meters: number;
  duration_seconds: number;
  duration_minutes: number;
  avg_split_500m: number;
  calories_burned: number;
  watts: number;
  average_heart_rate: number | null;
  max_heart_rate: number | null;
  average_stroke_rate: number;
  canonical_name: string | null;
  canonical_signature: string | null;
  template_id: string | null;
  raw_data: Json;
}

export interface PM5CaptureIngestionClient {
  getCurrentUserId(): Promise<string>;
  insertWorkout(payload: PM5WorkoutInsert): Promise<{ id: string } | null>;
  findWorkout(externalId: string, userId: string): Promise<{ id: string } | null>;
  updateWorkout(workoutId: string, payload: PM5WorkoutInsert, userId: string): Promise<void>;
}

function asJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function positiveHeartRate(value: number | undefined): number | null {
  return value !== undefined && value > 0 && value < 255 ? Math.round(value) : null;
}

function canonicalName(capture: PM5CompletedCaptureV2, context?: ActiveWorkoutSpec): string | null {
  const explicit = context?.canonical_name?.trim() || context?.source_rwn?.trim();
  if (explicit) return explicit;
  const summary = capture.summary;
  const workoutType = capture.rawEndSummary?.workoutType;
  if (!summary || workoutType === undefined) return null;
  if (workoutType === 2 || workoutType === 3) return `${Math.round(summary.workDistanceMeters)}m`;
  if (workoutType === 4 || workoutType === 5) return `${Math.round(summary.workTimeSeconds / 60)} min`;
  if (workoutType === 7 && capture.splits.length > 0) {
    const first = capture.splits[0];
    if (capture.splits.every((split) => split.workDistanceMeters === first.workDistanceMeters)) {
      return `${capture.splits.length}x${Math.round(first.workDistanceMeters)}m`;
    }
  }
  return null;
}

export function pm5CaptureExternalId(userId: string, capture: PM5CompletedCapture): string {
  return `pm5:${userId}:v${capture.captureVersion}:${capture.captureId}`;
}

export function buildPM5WorkoutInsert(
  capture: PM5CompletedCapture,
  userId: string,
  context?: ActiveWorkoutSpec,
): PM5WorkoutInsert {
  const validation = validatePm5Capture(capture);
  if (!validation.valid || capture._v !== 2 || !capture.summary || !capture.completedAt || !capture.rawEndSummary) {
    throw new Error(`Invalid PM5 capture: ${validation.violations.map((item) => item.code).join(', ')}`);
  }
  const projection = projectCaptureToConcept2(capture);
  const name = canonicalName(capture, context);
  const restDistance = capture.splits.reduce((total, split) => total + split.restDistanceMeters, 0);

  return {
    user_id: userId,
    external_id: pm5CaptureExternalId(userId, capture),
    source: 'erg_link_live',
    workout_name: projection.workout_type,
    workout_type: 'rower',
    completed_at: capture.completedAt,
    distance_meters: projection.distance,
    rest_distance_meters: Math.round(restDistance),
    duration_seconds: capture.summary.workTimeSeconds,
    duration_minutes: Math.round(capture.summary.workTimeSeconds / 60),
    avg_split_500m: capture.summary.averagePaceSecondsPer500m,
    calories_burned: Math.round(capture.summary.totalCalories),
    watts: Math.round(capture.summary.averageWatts),
    average_heart_rate: positiveHeartRate(capture.rawEndSummary.averageHeartRate),
    max_heart_rate: positiveHeartRate(capture.rawEndSummary.maxHeartRate),
    average_stroke_rate: Math.round(capture.summary.averageStrokeRate),
    canonical_name: name,
    canonical_signature: normalizeCanonicalName(name),
    template_id: context?.template_id ?? null,
    raw_data: asJson({
      ...projection,
      stroke_data: true,
      strokes: projection.stroke_data,
      pm5_capture: {
        source: 'pm5_capture_v2',
        capture_id: capture.captureId,
        capture_version: capture.captureVersion,
        capture,
        concept2_projection: projection,
        programming_context: context ?? null,
        group_assignment_id: context?.group_assignment_id ?? null,
        evidence_validation: validation,
      },
    }),
  };
}

export async function ingestPM5Capture(
  capture: PM5CompletedCapture,
  context?: ActiveWorkoutSpec,
  ownerId?: string,
  client: PM5CaptureIngestionClient = supabasePM5CaptureIngestionClient,
): Promise<PM5CaptureIngestionResult> {
  const userId = await client.getCurrentUserId();
  if (ownerId && userId !== ownerId) throw new Error('PM5 capture belongs to a different signed-in athlete');
  const payload = buildPM5WorkoutInsert(capture, userId, context);
  const inserted = await client.insertWorkout(payload);
  if (inserted) return { workoutId: inserted.id, replayed: false };

  const existing = await client.findWorkout(payload.external_id, userId);
  if (!existing) throw new Error('PM5 capture replay could not resolve the owned workout');
  await client.updateWorkout(existing.id, payload, userId);
  return { workoutId: existing.id, replayed: true };
}

export const supabasePM5CaptureIngestionClient: PM5CaptureIngestionClient = {
  async getCurrentUserId() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error('Sign in before saving a PM5 workout');
    return data.user.id;
  },

  async insertWorkout(payload) {
    const { data, error } = await supabase
      .from('workout_logs')
      .insert(payload)
      .select('id')
      .maybeSingle();
    if (error?.code === '23505') return null;
    if (error) throw error;
    return data;
  },

  async findWorkout(externalId, userId) {
    const { data, error } = await supabase
      .from('workout_logs')
      .select('id')
      .eq('external_id', externalId)
      .eq('user_id', userId)
      .eq('source', 'erg_link_live')
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async updateWorkout(workoutId, payload, userId) {
    const { error } = await supabase
      .from('workout_logs')
      .update(payload)
      .eq('id', workoutId)
      .eq('user_id', userId)
      .eq('source', 'erg_link_live');
    if (error) throw error;
  },
};
