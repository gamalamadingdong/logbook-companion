import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { configuration, createHandler } from './handler.ts';
import { completedWorkoutFromRow } from '../_shared/concept2/publication.ts';
import { bindDevelopmentFixture } from '../_shared/concept2/fixtures/index.ts';
import { bindPM5ProjectionFixture, pm5ProjectionFixtures } from '../_shared/concept2/fixtures/pm5ProjectionFixtures.ts';
import { validateCompletedWorkoutV2 } from '../_shared/concept2/completedWorkout.ts';

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
  createFixture: async (user, name) => {
    const workoutId = crypto.randomUUID();
    const completed = Object.prototype.hasOwnProperty.call(pm5ProjectionFixtures, name)
      ? bindPM5ProjectionFixture(name as keyof typeof pm5ProjectionFixtures, workoutId, user)
      : bindDevelopmentFixture(name, workoutId, user, new Date(Date.now() - 600_000).toISOString());
    validateCompletedWorkoutV2(completed);
    const { data, error } = await client!.rpc('c2_development_create_fixture_workout', {
      p_user_id: user, p_fixture_name: name, p_completed: completed,
    });
    if (error) throw new Error('Development fixture creation failed');
    return data;
  },
  loadWorkout: async (user, workoutId) => {
    const { data, error } = await client!.from('workout_logs')
      .select('id,user_id,source,workout_type,completed_at,distance_meters,duration_seconds,rest_distance_meters,manual_rwn,external_id,template_id,raw_data')
      .eq('id', workoutId).eq('user_id', user).single();
    if (error || !data) throw new Error('Owned completed workout required');
    if ((data.raw_data as { source?: string } | null)?.source === 'concept2_development_fixture') {
      const { data: fixture, error: fixtureError } = await client!.from('c2_development_fixture_workouts')
        .select('completed_result,fixture_name').eq('workout_id', workoutId).eq('user_id', user).single();
      const raw = data.raw_data as { fixture_name?: string; completed_workout?: unknown };
      if (fixtureError || !fixture || raw.fixture_name !== fixture.fixture_name ||
          JSON.stringify(raw.completed_workout) !== JSON.stringify(fixture.completed_result)) {
        throw new Error('Owned fixture snapshot required');
      }
    }
    return completedWorkoutFromRow(data);
  },
  loadProjection: async (user, workoutId) => {
    const { data, error } = await client!.from('c2_development_fixture_workouts')
      .select('completed_result').eq('workout_id', workoutId).eq('user_id', user).maybeSingle();
    if (error) throw new Error('Development fixture projection lookup failed');
    const projection = (data?.completed_result as { concept2Payload?: unknown } | undefined)?.concept2Payload;
    return projection && typeof projection === 'object' && !Array.isArray(projection)
      ? projection as Record<string, unknown>
      : null;
  },
  loadPublication: async (user, resultId) => {
    const { data, error } = await client!.from('c2_development_publications')
      .select('payload').eq('user_id', user).eq('result_id', resultId).eq('status', 'published').maybeSingle();
    if (error) throw new Error('Development publication lookup failed');
    return data?.payload && typeof data.payload === 'object' && !Array.isArray(data.payload)
      ? data.payload as Record<string, unknown>
      : null;
  },
  fetch,
}));
