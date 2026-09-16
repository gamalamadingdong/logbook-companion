import { supabase } from './supabase';
import { legacyConcept2Enabled } from './concept2Environment';
import { toast } from 'sonner';

export type DevelopmentConnection = { connected: boolean; busy?: boolean; environment: 'development'; provider_user_id?: string };
export async function developmentConcept2(action: 'begin' | 'exchange' | 'refresh' | 'status', fields: { code?: string; state?: string } = {}) {
  const { data, error } = await supabase.functions.invoke('concept2-development-auth', { body: { action, ...fields } });
  if (error) {
    const detail = error.context instanceof Response ? await error.context.json().catch(() => null) : null;
    throw new Error(typeof detail?.error === 'string' ? detail.error : 'Development Concept2 is unavailable. Sign in and check staging configuration.');
  }
  if (data?.error || !data) throw new Error(data?.error || 'Development Concept2 is unavailable.');
  return data as DevelopmentConnection & { authorization_url?: string };
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
