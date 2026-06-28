import { supabase } from './supabase';
import type { Database } from '../types/database.types';

type C2SyncJob = Database['public']['Tables']['c2_sync_jobs']['Row'];
type C2SyncJobItem = Database['public']['Tables']['c2_sync_job_items']['Row'];

function clampLimit(limit?: number): number {
  const normalized = typeof limit === 'number' ? Math.trunc(limit) : 20;

  if (!Number.isFinite(normalized)) return 20;

  return Math.max(1, Math.min(normalized, 100));
}

export const c2SyncJobsService = {
  getJob: async (jobId: string): Promise<C2SyncJob | null> => {
    const { data, error } = await supabase
      .from('c2_sync_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }

      throw error;
    }

    return data as C2SyncJob;
  },

  listJobs: async (limit = 20): Promise<C2SyncJob[]> => {
    const normalizedLimit = clampLimit(limit);

    const { data, error } = await supabase
      .from('c2_sync_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(normalizedLimit);

    if (error) {
      throw error;
    }

    return (data ?? []) as C2SyncJob[];
  },

  listItems: async (jobId: string, limit = 100): Promise<C2SyncJobItem[]> => {
    const normalizedLimit = clampLimit(limit);

    const { data, error } = await supabase
      .from('c2_sync_job_items')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(normalizedLimit);

    if (error) {
      throw error;
    }

    return (data ?? []) as C2SyncJobItem[];
  },
};
