import { supabase } from './supabase';
import { normalizeWorkoutDetail, samplesToCsv, type WorkoutDetailDocument, type WorkoutDetailRow } from '../../shared/workoutDetail';

export type WorkoutExportFormat = 'json' | 'csv';

const EXPORT_COLUMNS = 'id,external_id,source,workout_name,canonical_name,workout_type,completed_at,distance_meters,duration_seconds,duration_minutes,avg_split_500m,average_heart_rate,max_heart_rate,average_stroke_rate,watts,calories_burned,rest_distance_meters,notes,training_zone,perceived_exertion,rating,manual_rwn,template_id,is_benchmark,updated_at,raw_data';

/** Read the persisted workout on demand; never reuse the page's derived chart data. */
export async function loadWorkoutForExport(workoutId: string, userId: string): Promise<WorkoutDetailDocument> {
  if (!userId) throw new Error('Sign in to export your workout.');
  if (!workoutId) throw new Error('Open a saved workout to export it.');
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workoutId);
  const { data, error } = await supabase.from('workout_logs').select(EXPORT_COLUMNS)
    .eq('user_id', userId).eq(isUuid ? 'id' : 'external_id', workoutId).single();
  if (error) throw new Error('Unable to load this workout for export. Retry export.');
  if (!data) throw new Error('This saved workout is not available for your account.');
  return normalizeWorkoutDetail(data as WorkoutDetailRow);
}

export function serializeWorkoutExport(document: WorkoutDetailDocument, format: WorkoutExportFormat) {
  if (format === 'csv' && (document.sample_availability.status !== 'available' || !document.samples.length)) {
    throw new Error('No numeric samples are available for CSV. Choose JSON to export the saved workout summary and structure.');
  }
  return {
    content: format === 'json' ? JSON.stringify(document, null, 2) : samplesToCsv(document),
    mimeType: format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8',
    filename: `workout-${document.summary.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.${format}`,
  };
}

/** Synchronous file creation lets the caller check account/workout scope immediately before download. */
export function downloadWorkoutExport(document: WorkoutDetailDocument, format: WorkoutExportFormat): void {
  const file = serializeWorkoutExport(document, format);
  const url = URL.createObjectURL(new Blob([file.content], { type: file.mimeType }));
  const anchor = window.document.createElement('a');
  try {
    anchor.href = url;
    anchor.download = file.filename;
    window.document.body.append(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    // Defer revocation until the browser has consumed the download navigation.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
