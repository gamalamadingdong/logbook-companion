// @ts-expect-error -- Deno resolves remote URL imports at runtime.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildLibraryAiTemplateSummary, type LibraryTemplateSourceRecord } from '../../../src/lib/libraryTemplateDto.ts';

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const AI_TEMPLATE_SEARCH_COLUMNS = 'id, name, description, workout_type, training_zone, workout_category, workout_structure, technique_focus, coaching_points, pacing_guidance, estimated_duration, difficulty_level, usage_count, completion_rate, average_rating, rating_count, last_used_at, status, validated, rwn, canonical_name, tags, created_at, updated_at';

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function clampLimit(rawValue: string | null): number {
  const parsed = Number(rawValue ?? '25');
  if (!Number.isFinite(parsed)) return 25;
  return Math.min(Math.max(Math.trunc(parsed), 1), 50);
}

function normalizeOffset(rawValue: string | null): number {
  const parsed = Number(rawValue ?? '0');
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(Math.trunc(parsed), 0);
}

function parseDurationParam(rawValue: string | null, fieldName: string): number | null {
  if (!rawValue?.trim()) return null;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative number.`);
  }
  return parsed;
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
    const search = url.searchParams.get('search')?.trim() ?? '';
    const workoutType = url.searchParams.get('workout_type')?.trim() ?? null;
    const trainingZone = url.searchParams.get('training_zone')?.trim() ?? null;
    const difficultyLevel = url.searchParams.get('difficulty_level')?.trim() ?? null;
    const tier = url.searchParams.get('tier')?.trim() ?? null;
    const durationMin = url.searchParams.get('duration_min');
    const durationMax = url.searchParams.get('duration_max');
    const sort = url.searchParams.get('sort') === 'recent' ? 'recent' : 'popular';
    const limit = clampLimit(url.searchParams.get('limit'));
    const offset = normalizeOffset(url.searchParams.get('offset'));
    const parsedDurationMin = parseDurationParam(durationMin, 'duration_min');
    const parsedDurationMax = parseDurationParam(durationMax, 'duration_max');

    if (trainingZone && !['UT2', 'UT1', 'AT', 'TR', 'AN'].includes(trainingZone)) {
      return jsonResponse(400, { error: 'training_zone must be one of UT2, UT1, AT, TR, or AN.' });
    }

    if (tier && !['community', 'standard'].includes(tier)) {
      return jsonResponse(400, { error: 'tier must be either community or standard.' });
    }

    if (parsedDurationMin !== null && parsedDurationMax !== null && parsedDurationMin > parsedDurationMax) {
      return jsonResponse(400, { error: 'duration_min cannot be greater than duration_max.' });
    }

    let query = supabase
      .from('workout_templates')
      .select(AI_TEMPLATE_SEARCH_COLUMNS, { count: 'exact' })
      .eq('status', 'published');

    if (workoutType) {
      query = query.eq('workout_type', workoutType);
    }

    if (trainingZone) {
      query = query.eq('training_zone', trainingZone);
    }

    if (difficultyLevel) {
      query = query.eq('difficulty_level', difficultyLevel);
    }

    if (tier === 'standard') {
      query = query.eq('validated', true);
    } else if (tier === 'community') {
      query = query.eq('validated', false);
    }

    if (parsedDurationMin !== null) {
      query = query.gte('estimated_duration', parsedDurationMin);
    }

    if (parsedDurationMax !== null) {
      query = query.lte('estimated_duration', parsedDurationMax);
    }

    if (search) {
      const escaped = search.replaceAll(',', '\\,');
      query = query.or(`name.ilike.%${escaped}%,description.ilike.%${escaped}%,canonical_name.ilike.%${escaped}%`);
    }

    query = sort === 'recent'
      ? query.order('last_used_at', { ascending: false, nullsFirst: false }).order('name', { ascending: true })
      : query.order('usage_count', { ascending: false }).order('name', { ascending: true });

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error('[library-search] Query error:', error);
      return jsonResponse(500, { error: 'Failed to load library templates.' });
    }

    const templates = (data ?? []) as LibraryTemplateSourceRecord[];
    const items = await Promise.all(
      templates.map(async (template) => buildLibraryAiTemplateSummary(template, await getTemplateReferenceStats(supabase, template.id))),
    );

    return jsonResponse(200, {
      items,
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return jsonResponse(message.includes('must be') || message.includes('cannot be') ? 400 : 500, { error: message });
  }
});
