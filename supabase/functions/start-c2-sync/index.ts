// @ts-expect-error -- Deno resolves remote URL imports at runtime.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};
declare const EdgeRuntime: { waitUntil?: (promise: Promise<unknown>) => void } | undefined;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type SyncMode = 'workout_processing';

interface StartC2SyncPayload {
  requested_from?: unknown;
  requested_to?: unknown;
  mode?: unknown;
  metadata?: unknown;
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeOptionalDate(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be an ISO date string.`);
  }

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`${fieldName} must use YYYY-MM-DD format.`);
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
    throw new Error(`${fieldName} must be a valid calendar date.`);
  }

  return trimmed;
}

function normalizeMode(value: unknown): SyncMode {
  if (value === undefined || value === null || value === '') {
    return 'workout_processing';
  }

  if (value !== 'workout_processing') {
    throw new Error('mode must be workout_processing for this phase.');
  }

  return value;
}

async function triggerBatchWorker(supabaseUrl: string, serviceRoleKey: string, jobId: string) {
  const response = await fetch(`${supabaseUrl}/functions/v1/run-c2-sync-batch`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ job_id: jobId }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`Failed to trigger Concept2 sync worker: HTTP ${response.status}${message ? ` ${message}` : ''}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
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
    if (!jwt) {
      return jsonResponse(401, { error: 'Missing authorization token.' });
    }

    let payload: StartC2SyncPayload;
    try {
      payload = await req.json() as StartC2SyncPayload;
    } catch {
      return jsonResponse(400, { error: 'Request body must be valid JSON.' });
    }

    if (!isObject(payload)) {
      return jsonResponse(400, { error: 'Request body must be a JSON object.' });
    }

    const requestedFrom = normalizeOptionalDate(payload.requested_from, 'requested_from');
    const requestedTo = normalizeOptionalDate(payload.requested_to, 'requested_to');

    if (requestedFrom && requestedTo && requestedFrom > requestedTo) {
      return jsonResponse(400, { error: 'requested_from cannot be after requested_to.' });
    }

    const mode = normalizeMode(payload.mode);
    if (payload.metadata !== undefined && !isObject(payload.metadata)) {
      return jsonResponse(400, { error: 'metadata must be a JSON object when provided.' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return jsonResponse(401, { error: 'Invalid auth token.' });
    }

    const { data, error } = await supabase
      .from('c2_sync_jobs')
      .insert({
        user_id: user.id,
        status: 'queued',
        source: 'concept2',
        requested_from: requestedFrom,
        requested_to: requestedTo,
        metadata: {
          ...(isObject(payload.metadata) ? payload.metadata : {}),
          mode,
          trigger: 'start-c2-sync',
        },
      })
      .select('id, status, created_at')
      .single();

    if (error) {
      console.error('[start-c2-sync] Insert error:', error);
      return jsonResponse(500, { error: 'Failed to start Concept2 sync job.' });
    }

    let triggeredWorker = false;
    const workerTrigger = triggerBatchWorker(supabaseUrl, supabaseServiceRoleKey, data.id);
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(workerTrigger);
      triggeredWorker = true;
    } else {
      try {
        await workerTrigger;
        triggeredWorker = true;
      } catch (error) {
        console.error('[start-c2-sync] Worker trigger error:', error);
      }
    }

    return jsonResponse(202, {
      job_id: data.id,
      status: data.status,
      created_at: data.created_at,
      triggered_worker: triggeredWorker,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    const status = message.includes('must') || message.includes('cannot') ? 400 : 500;
    return jsonResponse(status, { error: message });
  }
});
