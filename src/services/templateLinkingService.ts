import { supabase } from './supabase';
import { workoutIdentity, type IdentityWorkout } from '../utils/workoutIdentity';

export interface LinkSnapshot extends IdentityWorkout {
  id: string;
  user_id: string;
  template_id: string | null;
  updated_at: string | null;
}
export interface LinkPreview { current: LinkSnapshot; matches: LinkSnapshot[]; comparable: boolean }
export interface LinkResult { linked: string[]; skipped: string[]; failed: LinkSnapshot[] }
// Fetch structure only; raw stroke streams never cross the wire for a history scan.
const projection = 'id,user_id,template_id,updated_at,workout_type,manual_rwn,distance_meters,duration_seconds,raw_workout_type:raw_data->>workout_type,raw_workout:raw_data->workout';
export async function loadLinkSnapshot(userId: string, workoutId: string): Promise<LinkSnapshot> {
  const { data, error } = await supabase.from('workout_logs').select(projection).eq('user_id', userId).eq('id', workoutId).single();
  if (error || !data) throw new Error('Could not load this workout. Reload and try again.');
  return data as unknown as LinkSnapshot;
}
export async function previewTemplateLinks(userId: string, workoutId: string, signal?: AbortSignal): Promise<LinkPreview> {
  const current = await loadLinkSnapshot(userId, workoutId);
  const identity = workoutIdentity(current);
  const matches: LinkSnapshot[] = [];
  if (!identity) return { current, matches, comparable: false };
  let cursor: string | undefined;
  while (!signal?.aborted) {
    let query = supabase.from('workout_logs').select(projection).eq('user_id', userId).is('template_id', null).neq('id', workoutId).order('id').limit(250);
    if (cursor) query = query.gt('id', cursor);
    const { data, error } = await query.abortSignal(signal ?? new AbortController().signal);
    if (error) throw new Error('Could not check your workout history. Retry the scan or link only this workout.');
    const rows = (data ?? []) as unknown as LinkSnapshot[];
    matches.push(...rows.filter(row => workoutIdentity(row) === identity));
    if (rows.length < 250) return { current, matches, comparable: true };
    cursor = rows[rows.length - 1].id;
  }
  throw new Error('History scan cancelled.');
}
/** Compare-and-set each confirmed snapshot. Existing history links are never replaced. */
export async function saveTemplateLinks(userId: string, templateId: string, snapshots: LinkSnapshot[]): Promise<LinkResult> {
  const result: LinkResult = { linked: [], skipped: [], failed: [] };
  // Current workout is first: do not change history if its confirmed link cannot be saved.
  for (let offset = 0; offset < snapshots.length;) {
    const batch = snapshots.slice(offset, offset === 0 ? 1 : offset + 5);
    await Promise.all(batch.map(async row => {
      if (row.user_id !== userId || (offset > 0 && row.template_id !== null)) { result.skipped.push(row.id); return; }
      try {
        let query = supabase.from('workout_logs').update({ template_id: templateId }).eq('id', row.id).eq('user_id', userId);
        query = row.template_id === null ? query.is('template_id', null) : query.eq('template_id', row.template_id);
        query = row.updated_at === null ? query.is('updated_at', null) : query.eq('updated_at', row.updated_at);
        const { data, error } = await query.select('id');
        if (error) result.failed.push(row);
        else if (data?.length) result.linked.push(row.id);
        else result.skipped.push(row.id);
      } catch { result.failed.push(row); }
    }));
    if (offset === 0 && !result.linked.includes(snapshots[0].id)) {
      if (result.failed.length) result.failed.push(...snapshots.slice(1));
      else result.skipped.push(...snapshots.slice(1).map(row => row.id));
      return result;
    }
    offset += batch.length;
  }
  return result;
}
