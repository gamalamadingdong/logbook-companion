import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { configuration, createHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL');
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const client = url && key ? createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
}) : null;
Deno.serve(createHandler({
  config: client ? configuration(name => Deno.env.get(name)) : null,
  authenticate: async jwt => {
    const result = await client!.auth.getUser(jwt);
    return result.error ? null : result.data.user?.id ?? null;
  },
  operation: async (user, action, values = {}) => {
    const { data, error } = await client!.rpc('c2_development_auth_operation', {
      p_user_id: user, p_action: action, p_values: values,
    });
    if (error) throw new Error('Development credential operation failed');
    return data;
  },
  syncOperation: async (user, action, values = {}) => {
    const { data, error } = await client!.rpc('c2_development_sync_operation', {
      p_user_id: user, p_action: action, p_values: values,
    });
    if (error) throw new Error('Development import operation failed');
    return data;
  },
  publishOperation: async (user, action, values = {}) => {
    const { data, error } = await client!.rpc('c2_development_publish_operation', {
      p_user_id: user, p_action: action, p_values: values,
    });
    if (error) throw new Error('Development publication operation failed');
    return data;
  },
  createWorkout: async (user, values) => {
    const { data, error } = await client!.rpc('c2_development_create_manual_workout', {
      p_user_id: user, p_values: values,
    });
    if (error) throw new Error('Development manual workout creation failed');
    return data;
  },
  fetch,
}));
