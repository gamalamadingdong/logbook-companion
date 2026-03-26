// @ts-expect-error -- Deno resolves remote URL imports at runtime.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildPublicWorkoutTemplateDetail, type LibraryTemplateSourceRecord } from '../../../src/lib/libraryTemplateDto.ts';

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const PUBLIC_TEMPLATE_DETAIL_COLUMNS = 'id, name, description, workout_type, training_zone, workout_category, workout_structure, technique_focus, coaching_points, pacing_guidance, estimated_duration, difficulty_level, usage_count, completion_rate, average_rating, rating_count, last_used_at, status, validated, rwn, canonical_name, tags, created_at, updated_at';

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getTemplateReferenceStats(supabase: ReturnType<typeof createClient>, templateId: string) {
  const [groupAssignmentsResult, planWorkoutsResult, originalAssignmentsResult, substitutedAssignmentsResult] = await Promise.all([
    supabase.from('group_assignments').select('id', { count: 'exact', head: true }).eq('template_id', templateId),
    supabase.from('plan_workouts').select('id', { count: 'exact', head: true }).eq('workout_template_id', templateId),
    supabase.from('daily_workout_assignments').select('id', { count: 'exact', head: true }).eq('original_template_id', templateId),
    supabase.from('daily_workout_assignments').select('id', { count: 'exact', head: true }).eq('substituted_template_id', templateId),
  ]);

  return {
    groupAssignmentCount: groupAssignmentsResult.count ?? 0,
    planWorkoutCount: planWorkoutsResult.count ?? 0,
    dailyAssignmentCount: (originalAssignmentsResult.count ?? 0) + (substitutedAssignmentsResult.count ?? 0),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse(500, { error: 'Missing required server configuration.' });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse(401, { error: 'Missing authorization token.' });
    }

    const jwt = authHeader.replace('Bearer ', '').trim();
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return jsonResponse(401, { error: 'Invalid auth token.' });
    }

    const url = new URL(req.url);
    const templateId = url.searchParams.get('templateId')?.trim() ?? '';

    if (!templateId) {
      return jsonResponse(400, { error: 'templateId is required.' });
    }

    const { data, error } = await supabase
      .from('workout_templates')
      .select(PUBLIC_TEMPLATE_DETAIL_COLUMNS)
      .eq('id', templateId)
      .eq('status', 'published')
      .maybeSingle();

    if (error) {
      console.error('[library-template-detail] Query error:', error);
      return jsonResponse(500, { error: 'Failed to load library template.' });
    }

    if (!data) {
      return jsonResponse(404, { error: 'Template not found.' });
    }

    const referenceStats = await getTemplateReferenceStats(supabase, templateId);
    const detail = buildPublicWorkoutTemplateDetail(data as LibraryTemplateSourceRecord, referenceStats);

    if (detail.tier === 'draft') {
      return jsonResponse(404, { error: 'Template not found.' });
    }

    return jsonResponse(200, {
      template: detail,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return jsonResponse(500, { error: message });
  }
});
