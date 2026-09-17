import { supabase } from './supabase';
import { legacyConcept2Enabled } from './concept2Environment';
import { toast } from 'sonner';

export type DevelopmentConnection = { connected: boolean; busy?: boolean; can_publish?: boolean;
  environment: 'development'; provider_user_id?: string };
export type DevelopmentResult = { id: number; date: string; type: string; distance: number; time: number; lc_workout_id?: string };
export type DevelopmentPublication = { workout_id: string; status: 'published' | 'rejected' | 'outcome_unknown'; result_id?: number; created_at?: string };

type DevelopmentWorkoutDraft = { distance: string; duration: string; completedAt: string };
export type DevelopmentWorkoutDraftErrors = Partial<Record<keyof DevelopmentWorkoutDraft, string>>;
export function validateDevelopmentWorkoutDraft(draft: DevelopmentWorkoutDraft, now = new Date()): DevelopmentWorkoutDraftErrors {
  const errors: DevelopmentWorkoutDraftErrors = {};
  const distance = Number(draft.distance); const duration = Number(draft.duration);
  const completedAt = draft.completedAt ? new Date(draft.completedAt) : null;
  if (!Number.isSafeInteger(distance) || distance <= 0 || distance > 1_000_000) {
    errors.distance = 'Enter a whole number of meters greater than zero.';
  }
  if (!Number.isFinite(duration) || duration <= 0 || duration > 86_400) {
    errors.duration = 'Enter work time in seconds greater than zero.';
  }
  if (!completedAt || Number.isNaN(completedAt.getTime())) {
    errors.completedAt = 'Enter when the workout was completed.';
  } else if (completedAt > now) {
    errors.completedAt = 'Completion time cannot be in the future.';
  }
  return errors;
}

export function getDevelopmentPublishBlockers(input: {
  connection: DevelopmentConnection | null; selectedId: string; weightClass: '' | 'H' | 'L';
  timezone: string; confirmed: boolean; syntheticFixture?: boolean; existingStatus?: DevelopmentPublication['status'];
}) {
  const blockers: string[] = [];
  if (!input.connection?.connected) blockers.push('Connect your Concept2 development account.');
  else if (!input.connection.can_publish) blockers.push('Reconnect Concept2 to grant development write permission.');
  if (input.connection?.busy) blockers.push('Wait for the current Concept2 operation to finish.');
  if (!input.selectedId) blockers.push('Save or select a completed LC workout.');
  if (!input.timezone.trim()) blockers.push('Enter the workout timezone.');
  if (!input.weightClass) blockers.push('Select your Concept2 weight class.');
  if (!input.confirmed) blockers.push(input.syntheticFixture ? 'Confirm this is a synthetic development test result.' : 'Confirm that you completed the saved workout.');
  if (input.existingStatus === 'published') blockers.push('This workout is already published to Concept2 development.');
  if (input.existingStatus === 'outcome_unknown') blockers.push('This workout has an uncertain publication outcome. Do not retry it.');
  return blockers;
}

export async function developmentConcept2(action: 'begin' | 'exchange' | 'refresh' | 'status' | 'sync' | 'results' | 'publish' | 'publications' | 'create_workout' | 'create_fixture', fields: { code?: string; state?: string; page?: number; workout_id?: string; timezone?: string; weight_class?: 'H' | 'L'; privacy?: 'private' | 'partners' | 'logged_in' | 'everyone'; confirmed_completed?: boolean; confirmed_fixture?: boolean; fixture_name?: string; distance_meters?: number; duration_seconds?: number; completed_at?: string; publication_shape?: 'fixed_distance' | 'fixed_time' } = {}) {
  const { data, error } = await supabase.functions.invoke('concept2-development-auth', { body: { action, ...fields } });
  if (error) {
    const detail = error.context instanceof Response ? await error.context.json().catch(() => null) : null;
    throw new Error(typeof detail?.error === 'string' ? detail.error : 'Development Concept2 is unavailable. Sign in and check staging configuration.');
  }
  if (data?.error || !data) throw new Error(data?.error || 'Development Concept2 is unavailable.');
  return data as DevelopmentConnection & { authorization_url?: string; results?: DevelopmentResult[]; total?: number; imported?: number; next_page?: number | null; publications?: DevelopmentPublication[]; status?: DevelopmentPublication['status']; result_id?: number; workout_id?: string };
}
export async function connectConcept2() {
  try {
    if (legacyConcept2Enabled) {
      const query = new URLSearchParams({ client_id: import.meta.env.VITE_CONCEPT2_CLIENT_ID,
        redirect_uri: `${window.location.origin}/callback`, scope: 'user:read,results:write', response_type: 'code' });
      window.location.href = `https://log.concept2.com/oauth/authorize?${query}`;
      return;
    }
    const result = await developmentConcept2('begin');
    const url = new URL(result.authorization_url || '');
    if (url.origin !== 'https://log-dev.concept2.com' || url.pathname !== '/oauth/authorize') throw new Error('Unexpected provider.');
    window.location.assign(url.href);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Unable to connect Concept2.');
  }
}
