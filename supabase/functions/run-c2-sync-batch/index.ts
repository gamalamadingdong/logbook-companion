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

const CONCEPT2_API_BASE_URL = 'https://log.concept2.com/api';
const CONCEPT2_TOKEN_URL = 'https://log.concept2.com/oauth/access_token';
const DEFAULT_PAGE_LIMIT = 3;
const DEFAULT_TIME_BUDGET_MS = 20_000;
const MAX_PAGE_LIMIT = 10;
const MAX_TIME_BUDGET_MS = 45_000;

type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';

interface RunBatchPayload {
  job_id?: unknown;
  page_limit?: unknown;
  time_budget_ms?: unknown;
}

interface C2SyncJob {
  id: string;
  user_id: string;
  status: JobStatus;
  requested_from: string | null;
  requested_to: string | null;
  attempt_count: number;
  metadata: Record<string, unknown> | null;
}

interface UserIntegration {
  concept2_token: string | null;
  concept2_refresh_token: string | null;
  concept2_expires_at: string | null;
}

interface Concept2ResultsPage {
  data?: unknown[];
  meta?: {
    pagination?: {
      current_page?: number;
      total_pages?: number;
      next_page?: number | null;
    };
  };
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

function normalizePositiveInteger(value: unknown, fallback: number, max: number, fieldName: string) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > max) {
    throw new Error(`${fieldName} must be an integer between 1 and ${max}.`);
  }

  return value;
}

function normalizePayload(value: unknown): RunBatchPayload {
  if (value === undefined || value === null || value === '') {
    return {};
  }

  if (!isObject(value)) {
    throw new Error('Request body must be a JSON object.');
  }

  if (value.job_id !== undefined && typeof value.job_id !== 'string') {
    throw new Error('job_id must be a string when provided.');
  }

  return value;
}

function getMetadata(job: C2SyncJob) {
  return isObject(job.metadata) ? job.metadata : {};
}

function getNextPage(metadata: Record<string, unknown>) {
  const value = metadata.next_page;
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 1;
}

function getCounter(metadata: Record<string, unknown>, key: string) {
  const counters = isObject(metadata.counters) ? metadata.counters : {};
  const value = counters[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function mergeCounters(metadata: Record<string, unknown>, updates: Record<string, number>) {
  const currentCounters = isObject(metadata.counters) ? metadata.counters : {};
  return {
    ...currentCounters,
    ...updates,
  };
}

function buildResultsUrl(job: C2SyncJob, page: number) {
  const url = new URL('/users/me/results', CONCEPT2_API_BASE_URL);
  url.searchParams.set('page', String(page));

  if (job.requested_from) {
    url.searchParams.set('from', job.requested_from);
  }

  if (job.requested_to) {
    url.searchParams.set('to', job.requested_to);
  }

  return url.toString();
}

function authHeader(req: Request) {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return null;
  }

  return auth.replace('Bearer ', '').trim();
}

async function refreshConcept2Token(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  integration: UserIntegration,
) {
  if (!integration.concept2_refresh_token) {
    throw new Error('Concept2 refresh token is missing.');
  }

  const clientId = Deno.env.get('CONCEPT2_CLIENT_ID');
  const clientSecret = Deno.env.get('CONCEPT2_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new Error('Missing Concept2 OAuth server configuration.');
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: integration.concept2_refresh_token,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(CONCEPT2_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  if (!response.ok) {
    throw new Error(`Concept2 token refresh failed with HTTP ${response.status}.`);
  }

  const data = await response.json();
  if (!data.access_token || typeof data.access_token !== 'string') {
    throw new Error('Concept2 token refresh response did not include an access token.');
  }

  const expiresAt = typeof data.expires_in === 'number'
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : integration.concept2_expires_at;
  const nextRefreshToken = typeof data.refresh_token === 'string'
    ? data.refresh_token
    : integration.concept2_refresh_token;

  const { error } = await supabase
    .from('user_integrations')
    .update({
      concept2_token: data.access_token,
      concept2_refresh_token: nextRefreshToken,
      concept2_expires_at: expiresAt,
    })
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to persist refreshed Concept2 token: ${error.message}`);
  }

  return data.access_token as string;
}

async function getConcept2AccessToken(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await supabase
    .from('user_integrations')
    .select('concept2_token, concept2_refresh_token, concept2_expires_at')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw new Error('Concept2 integration is not connected.');
  }

  const integration = data as UserIntegration;
  if (!integration.concept2_token) {
    throw new Error('Concept2 access token is missing.');
  }

  const expiresAt = integration.concept2_expires_at ? Date.parse(integration.concept2_expires_at) : 0;
  const expiresSoon = !expiresAt || expiresAt <= Date.now() + 60_000;

  if (expiresSoon) {
    return refreshConcept2Token(supabase, userId, integration);
  }

  return integration.concept2_token;
}

async function selectQueuedJob(supabase: ReturnType<typeof createClient>, jobId: string | null) {
  let query = supabase
    .from('c2_sync_jobs')
    .select('id, user_id, status, requested_from, requested_to, attempt_count, metadata')
    .eq('source', 'concept2')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1);

  if (jobId) {
    query = query.eq('id', jobId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`Failed to load queued sync job: ${error.message}`);
  }

  return data as C2SyncJob | null;
}

async function claimJob(supabase: ReturnType<typeof createClient>, job: C2SyncJob) {
  const metadata = getMetadata(job);
  const { data, error } = await supabase
    .from('c2_sync_jobs')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
      finished_at: null,
      attempt_count: job.attempt_count + 1,
      error_code: null,
      error_message: null,
      metadata: {
        ...metadata,
        worker: 'run-c2-sync-batch',
        last_error: null,
        counters: mergeCounters(metadata, {
          pages_processed: getCounter(metadata, 'pages_processed'),
          summaries_seen: getCounter(metadata, 'summaries_seen'),
        }),
      },
    })
    .eq('id', job.id)
    .eq('status', 'queued')
    .select('id, user_id, status, requested_from, requested_to, attempt_count, metadata')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to claim sync job: ${error.message}`);
  }

  return data as C2SyncJob | null;
}

async function updateJobFailure(
  supabase: ReturnType<typeof createClient>,
  job: C2SyncJob,
  code: string,
  error: unknown,
) {
  const message = error instanceof Error ? error.message : 'Unexpected sync worker error.';
  const metadata = getMetadata(job);

  await supabase
    .from('c2_sync_jobs')
    .update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      error_code: code,
      error_message: message,
      metadata: {
        ...metadata,
        last_error: { code, message, at: new Date().toISOString() },
      },
    })
    .eq('id', job.id);
}

async function triggerNextBatch(supabaseUrl: string, serviceRoleKey: string, jobId: string) {
  const response = await fetch(`${supabaseUrl}/functions/v1/run-c2-sync-batch`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ job_id: jobId }),
  });

  return response.ok;
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

    if (authHeader(req) !== supabaseServiceRoleKey) {
      return jsonResponse(401, { error: 'Service role authorization is required.' });
    }

    let payload: RunBatchPayload = {};
    if (req.headers.get('Content-Length') !== '0') {
      try {
        payload = normalizePayload(await req.json());
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Request body must be valid JSON.';
        return jsonResponse(400, { error: message });
      }
    }

    const pageLimit = normalizePositiveInteger(payload.page_limit, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT, 'page_limit');
    const timeBudgetMs = normalizePositiveInteger(
      payload.time_budget_ms,
      DEFAULT_TIME_BUDGET_MS,
      MAX_TIME_BUDGET_MS,
      'time_budget_ms',
    );
    const requestedJobId = typeof payload.job_id === 'string' && payload.job_id.trim()
      ? payload.job_id.trim()
      : null;

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const queuedJob = await selectQueuedJob(supabase, requestedJobId);
    if (!queuedJob) {
      return jsonResponse(202, {
        status: 'idle',
        job_id: requestedJobId,
      });
    }

    const job = await claimJob(supabase, queuedJob);
    if (!job) {
      return jsonResponse(202, {
        status: 'locked',
        job_id: queuedJob.id,
      });
    }

    const startedAt = Date.now();
    const metadata = getMetadata(job);
    let nextPage = getNextPage(metadata);
    let pagesProcessed = getCounter(metadata, 'pages_processed');
    let summariesSeen = getCounter(metadata, 'summaries_seen');
    let hasMore = false;

    try {
      const token = await getConcept2AccessToken(supabase, job.user_id);

      for (let i = 0; i < pageLimit; i += 1) {
        if (Date.now() - startedAt >= timeBudgetMs) {
          hasMore = true;
          break;
        }

        const response = await fetch(buildResultsUrl(job, nextPage), {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Concept2 summary page ${nextPage} failed with HTTP ${response.status}.`);
        }

        const page = await response.json() as Concept2ResultsPage;
        const summaries = Array.isArray(page.data) ? page.data : [];
        const totalPages = page.meta?.pagination?.total_pages;
        const currentPage = page.meta?.pagination?.current_page ?? nextPage;
        const explicitNextPage = page.meta?.pagination?.next_page;

        pagesProcessed += 1;
        summariesSeen += summaries.length;
        nextPage = typeof explicitNextPage === 'number' && explicitNextPage > currentPage
          ? explicitNextPage
          : currentPage + 1;
        hasMore = typeof totalPages === 'number' ? currentPage < totalPages : summaries.length > 0;

        if (!hasMore) {
          break;
        }
      }

      const finished = !hasMore;
      const nextMetadata = {
        ...metadata,
        next_page: finished ? null : nextPage,
        last_error: null,
        counters: mergeCounters(metadata, {
          pages_processed: pagesProcessed,
          summaries_seen: summariesSeen,
        }),
      };

      const { error } = await supabase
        .from('c2_sync_jobs')
        .update({
          status: finished ? 'succeeded' : 'queued',
          finished_at: finished ? new Date().toISOString() : null,
          last_processed_at: new Date().toISOString(),
          metadata: nextMetadata,
        })
        .eq('id', job.id)
        .eq('status', 'running');

      if (error) {
        throw new Error(`Failed to persist sync progress: ${error.message}`);
      }

      let triggered_next_batch = false;
      if (!finished) {
        const nextBatch = triggerNextBatch(supabaseUrl, supabaseServiceRoleKey, job.id);
        if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
          EdgeRuntime.waitUntil(nextBatch);
          triggered_next_batch = true;
        } else {
          triggered_next_batch = await nextBatch;
        }
      }

      return jsonResponse(202, {
        job_id: job.id,
        status: finished ? 'succeeded' : 'queued',
        pages_processed: pagesProcessed,
        summaries_seen: summariesSeen,
        next_page: finished ? null : nextPage,
        triggered_next_batch,
      });
    } catch (error) {
      console.error('[run-c2-sync-batch] Worker error:', error);
      await updateJobFailure(supabase, job, 'worker_error', error);

      const message = error instanceof Error ? error.message : 'Unexpected sync worker error.';
      return jsonResponse(500, {
        job_id: job.id,
        status: 'failed',
        error: message,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    const status = message.includes('must') ? 400 : 500;
    return jsonResponse(status, { error: message });
  }
});
