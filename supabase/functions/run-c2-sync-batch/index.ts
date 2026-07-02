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

interface Concept2Summary {
  id: number;
  date: string;
  distance: number;
  type?: string;
  time: number;
  stroke_rate?: number;
  watts?: number;
  calories_total?: number;
  workout_type?: string;
  rest_distance?: number;
}

interface Concept2Interval {
  type?: string;
  distance?: number;
  time?: number;
  rest_time?: number;
  watts?: number;
  calories_total?: number;
}

interface Concept2Stroke {
  t?: number;
  d?: number;
  p?: number;
  spm?: number;
  watts?: number;
}

interface Concept2Detail extends Record<string, unknown> {
  rest_distance?: number;
  calories_total?: number;
  stroke_rate?: number;
  heart_rate?: {
    average?: number;
    max?: number;
  };
  workout?: {
    intervals?: Concept2Interval[];
    splits?: Concept2Interval[];
  };
  strokes?: Concept2Stroke[];
}

interface ProcessCounters {
  processed: number;
  skipped_existing: number;
  skipped_filtered: number;
  failed: number;
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

function getBooleanMetadata(metadata: Record<string, unknown>, key: string, fallback: boolean) {
  const value = metadata[key];
  return typeof value === 'boolean' ? value : fallback;
}

function getMachineTypes(metadata: Record<string, unknown>) {
  const value = metadata.machine_types;
  if (!isObject(value)) {
    return { rower: true, bike: true, skierg: true } as Record<string, boolean>;
  }

  return {
    rower: value.rower !== false,
    bike: value.bike !== false,
    skierg: value.skierg !== false,
  } as Record<string, boolean>;
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

function buildResultDetailUrl(resultId: number) {
  return new URL(`/users/me/results/${resultId}`, CONCEPT2_API_BASE_URL).toString();
}

function buildStrokesUrl(resultId: number) {
  return new URL(`/users/me/results/${resultId}/strokes`, CONCEPT2_API_BASE_URL).toString();
}

async function fetchConcept2Json(token: string, url: string, allowNotFound = false) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.c2logbook.v1+json',
    },
  });

  if (allowNotFound && response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Concept2 request failed with HTTP ${response.status}.`);
  }

  const body = await response.json();
  return isObject(body) && body.data !== undefined ? body.data : body;
}

function asSummary(value: unknown): Concept2Summary | null {
  if (!isObject(value) || typeof value.id !== 'number' || typeof value.date !== 'string') {
    return null;
  }

  return {
    id: value.id,
    date: value.date,
    distance: typeof value.distance === 'number' ? value.distance : 0,
    type: typeof value.type === 'string' ? value.type : undefined,
    time: typeof value.time === 'number' ? value.time : 0,
    stroke_rate: typeof value.stroke_rate === 'number' ? value.stroke_rate : undefined,
    watts: typeof value.watts === 'number' ? value.watts : undefined,
    calories_total: typeof value.calories_total === 'number' ? value.calories_total : undefined,
    workout_type: typeof value.workout_type === 'string' ? value.workout_type : undefined,
    rest_distance: typeof value.rest_distance === 'number' ? value.rest_distance : undefined,
  };
}

function roundToStandardDistance(meters: number) {
  const standardDistances = [
    100, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000,
    7500, 10000, 15000, 21097, 30000, 42195,
  ];
  const threshold = Math.max(20, meters * 0.01);
  return standardDistances.find((standard) => Math.abs(meters - standard) <= threshold) ?? Math.round(meters);
}

function formatRest(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

function calculateCanonicalName(intervals: Concept2Interval[]) {
  if (!intervals.length) return 'Unknown';
  const workIntervals = intervals.filter((interval) => interval.type !== 'rest');
  if (!workIntervals.length) return 'Rest Only';

  const first = workIntervals[0];
  const count = workIntervals.length;
  const firstDistance = first.distance ?? 0;
  const firstTime = first.time ?? 0;
  const distVariance = firstDistance > 0 && workIntervals.every((interval) => Math.abs((interval.distance ?? 0) - firstDistance) < 5);
  const timeVariance = firstTime > 0 && workIntervals.every((interval) => Math.abs((interval.time ?? 0) - firstTime) < 10);
  const restSeconds = (first.rest_time ?? 0) / 10;
  const restString = restSeconds > 0 ? `/${formatRest(restSeconds)}r` : '';

  if (count === 1) {
    const type = first.type;
    const timeSeconds = firstTime / 10;
    const isStandardTime = [1200, 1800, 2400, 3600].includes(timeSeconds);
    if (type === 'time' || (firstTime > 0 && firstDistance === 0) || isStandardTime) {
      const minutes = Math.floor(timeSeconds / 60);
      const seconds = Math.round(timeSeconds % 60);
      return seconds === 0 ? `${minutes}:00` : `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    if (type === 'distance' || firstDistance > 0) return `${roundToStandardDistance(firstDistance)}m`;
    if (type === 'calorie' || type === 'calories' || first.calories_total) return `${first.calories_total}cal`;
    return firstTime > 0 ? `${Math.floor(timeSeconds / 60)}:00` : `${Math.round(firstDistance)}m`;
  }

  if (distVariance) {
    return `${count}x${roundToStandardDistance(firstDistance)}m${restString}`;
  }

  if (timeVariance) {
    const timeSeconds = firstTime / 10;
    const minutes = Math.floor(timeSeconds / 60);
    const seconds = Math.round(timeSeconds % 60);
    const timeLabel = seconds === 0 ? `${minutes}:00` : `${minutes}:${seconds.toString().padStart(2, '0')}`;
    return `${count}x${timeLabel}${restString}`;
  }

  return 'Unknown';
}

function fallbackCanonicalName(summary: Concept2Summary, detail: Concept2Detail, calculated: string) {
  if (calculated && calculated !== 'Unknown') return calculated;

  const type = summary.workout_type || '';
  if (['FixedDistanceSplits', 'FixedDistanceNoSplits', 'FixedDistanceInterval'].includes(type) || type === 'DistanceInterval') {
    return `${roundToStandardDistance(summary.distance)}m`;
  }
  if (['FixedTimeSplits', 'FixedTimeNoSplits', 'FixedTimeInterval'].includes(type) || type === 'TimeInterval') {
    return `${Math.round(summary.time / 600)}:00`;
  }
  if (['FixedCalorie', 'FixedCalorieInterval', 'FixedCalorieSplits', 'FixedCalorieNoSplits'].includes(type) || type === 'CalorieInterval') {
    return `${detail.calories_total ?? summary.calories_total ?? 0} cal`;
  }
  if (['FixedWattMinute', 'FixedWattMinuteInterval', 'FixedWattSplits', 'FixedWattNoSplits'].includes(type) || type === 'WattInterval' || type === 'WattsInterval') {
    return `${Math.round(summary.watts || 0)}W`;
  }
  if (type === 'JustRow' || type.includes('Just Row')) {
    return `${Math.floor(summary.distance)}m JustRow`;
  }

  return summary.workout_type || 'Workout';
}

function normalizeForMatching(canonicalName: string | null | undefined) {
  if (!canonicalName) return null;
  let normalized = canonicalName.trim();
  if (!normalized || ['Unknown', 'Unstructured', 'Workout'].includes(normalized)) return null;
  const segments = normalized.split(/\s*\+\s*/);
  const workSegments = segments.filter((segment) => {
    const trimmed = segment.trim();
    return !trimmed.match(/^\[(w|c|t)\]/i) && !trimmed.match(/#(warmup|cooldown|test)$/i);
  });
  if (workSegments.length > 0) {
    normalized = workSegments
      .map((segment) => segment.replace(/#(warmup|cooldown|test)$/i, '').trim())
      .join(' + ');
  } else {
    normalized = normalized.replace(/^\[([wct])\]\s*/i, '').replace(/#(warmup|cooldown|test)$/i, '').trim();
  }
  normalized = normalized.replace(/\s*JustRow\s*$/i, '').trim();
  normalized = normalized.replace(/\s*\/\s*/g, '/');
  normalized = normalized.replace(/\s*\+\s*/g, ' + ');
  return normalized || null;
}

function calculateWattsFromSplit(splitSeconds: number) {
  return splitSeconds > 0 ? 2.8 / Math.pow(splitSeconds / 500, 3) : 0;
}

function classifyZone(watts: number, baseline2kWatts: number) {
  if (!baseline2kWatts || watts <= 0) return 'UT2';
  const pct = watts / baseline2kWatts;
  if (pct < 0.60) return 'UT2';
  if (pct < 0.75) return 'UT1';
  if (pct < 0.90) return 'AT';
  if (pct < 1.05) return 'TR';
  return 'AN';
}

function calculateZoneDistribution(strokes: Concept2Stroke[], intervals: Concept2Interval[], baseline2kWatts: number) {
  const distribution: Record<string, number> = { UT2: 0, UT1: 0, AT: 0, TR: 0, AN: 0 };
  if (!baseline2kWatts) return distribution;

  if (strokes.length) {
    for (const stroke of strokes) {
      if (!stroke.spm || stroke.spm <= 0) continue;
      let watts = stroke.watts ?? 0;
      if (!watts && stroke.p) {
        watts = stroke.p > 300 ? calculateWattsFromSplit(stroke.p / 10) : stroke.p;
      }
      if (watts > 0) {
        distribution[classifyZone(watts, baseline2kWatts)] += 60 / stroke.spm;
      }
    }
    return distribution;
  }

  for (const interval of intervals) {
    if (interval.type === 'rest') continue;
    const duration = interval.time ? interval.time / 10 : 0;
    const watts = interval.watts ?? 0;
    if (duration > 0) distribution[classifyZone(watts, baseline2kWatts)] += duration;
  }

  return distribution;
}

function calculatePowerBuckets(strokes: Concept2Stroke[]) {
  const buckets: Record<string, number> = {};
  for (const stroke of strokes) {
    if (!stroke.spm || stroke.spm <= 0) continue;
    let watts = stroke.watts ?? 0;
    if (!watts && stroke.p) {
      watts = stroke.p > 300 ? calculateWattsFromSplit(stroke.p / 10) : stroke.p;
    }
    if (watts <= 0) continue;
    const bucket = String(Math.floor(watts / 5) * 5);
    buckets[bucket] = (buckets[bucket] ?? 0) + (60 / stroke.spm);
  }

  for (const key of Object.keys(buckets)) {
    buckets[key] = Math.round(buckets[key] * 10) / 10;
  }
  return buckets;
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
          workouts_processed: getCounter(metadata, 'workouts_processed'),
          workouts_skipped_existing: getCounter(metadata, 'workouts_skipped_existing'),
          workouts_skipped_filtered: getCounter(metadata, 'workouts_skipped_filtered'),
          workouts_failed: getCounter(metadata, 'workouts_failed'),
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

async function markJobItem(
  supabase: ReturnType<typeof createClient>,
  job: C2SyncJob,
  summary: Concept2Summary,
  status: 'queued' | 'processing' | 'succeeded' | 'skipped_existing' | 'skipped_filtered' | 'failed',
  updates: Record<string, unknown> = {},
) {
  const now = new Date().toISOString();
  const terminal = ['succeeded', 'skipped_existing', 'skipped_filtered', 'failed'].includes(status);
  const { error } = await supabase
    .from('c2_sync_job_items')
    .upsert({
      job_id: job.id,
      user_id: job.user_id,
      external_id: String(summary.id),
      status,
      started_at: status === 'processing' ? now : updates.started_at,
      finished_at: terminal ? now : updates.finished_at,
      metadata: {
        summary_date: summary.date,
        workout_type: summary.workout_type ?? null,
        machine_type: summary.type ?? 'rower',
        ...(isObject(updates.metadata) ? updates.metadata : {}),
      },
      error_code: updates.error_code ?? null,
      error_message: updates.error_message ?? null,
    }, { onConflict: 'job_id,external_id' });

  if (error) {
    throw new Error(`Failed to persist sync item ${summary.id}: ${error.message}`);
  }
}

async function getBaselineWatts(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data } = await supabase
    .from('user_baseline_metrics')
    .select('pr_2k_watts')
    .eq('user_id', userId)
    .maybeSingle();

  const watts = isObject(data) && typeof data.pr_2k_watts === 'number' ? data.pr_2k_watts : 202;
  return watts || 202;
}

async function hasExistingWorkout(supabase: ReturnType<typeof createClient>, userId: string, externalId: string) {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('external_id', externalId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check existing workout ${externalId}: ${error.message}`);
  }

  return Boolean(data);
}

async function findMatchingWorkout(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  summary: Concept2Summary,
) {
  const date = new Date(summary.date);
  const windowMs = 600 * 1000;
  const minDate = new Date(date.getTime() - windowMs).toISOString();
  const maxDate = new Date(date.getTime() + windowMs).toISOString();

  const { data, error } = await supabase
    .from('workout_logs')
    .select('id, source, distance_meters, duration_seconds')
    .eq('user_id', userId)
    .gte('completed_at', minDate)
    .lte('completed_at', maxDate);

  if (error || !Array.isArray(data)) {
    return null;
  }

  const summarySeconds = summary.time / 10;
  return data.find((log) => {
    const distance = typeof log.distance_meters === 'number' ? log.distance_meters : 0;
    const duration = typeof log.duration_seconds === 'number' ? log.duration_seconds : 0;
    return Math.abs(distance - summary.distance) <= 100 && Math.abs(duration - summarySeconds) <= 10;
  }) ?? null;
}

function shouldUpgrade(existingSource: string | null | undefined, newSource: string) {
  const priority: Record<string, number> = { concept2: 3, erg_link: 2, manual: 1, unknown: 0 };
  return (priority[newSource] ?? 0) >= (priority[existingSource ?? 'unknown'] ?? 0);
}

async function matchWorkoutToTemplate(
  supabase: ReturnType<typeof createClient>,
  workoutId: string,
  userId: string,
  canonicalName: string,
) {
  const canonicalSignature = normalizeForMatching(canonicalName);
  if (!canonicalSignature) return null;

  const { data } = await supabase
    .from('workout_templates')
    .select('id, usage_count, created_by')
    .eq('canonical_name', canonicalSignature)
    .order('usage_count', { ascending: false })
    .limit(3);

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const [template] = [...data].sort((a, b) => {
    const aUser = a.created_by === userId ? 1 : 0;
    const bUser = b.created_by === userId ? 1 : 0;
    if (aUser !== bUser) return bUser - aUser;
    return (b.usage_count ?? 0) - (a.usage_count ?? 0);
  });

  const match_confidence = template.created_by === userId ? 0.92 : 0.84;
  const match_reason = template.created_by === userId ? 'exact_user_template' : 'exact_community_template';

  const { error } = await supabase
    .from('workout_logs')
    .update({ template_id: template.id, match_confidence, match_reason })
    .eq('id', workoutId);

  if (error) {
    return null;
  }

  return template.id as string;
}

async function linkAssignment(
  supabase: ReturnType<typeof createClient>,
  workoutId: string,
  userId: string,
  completedAt: string,
  templateId: string | null,
) {
  if (!templateId) return false;
  const dateStr = new Date(completedAt).toISOString().split('T')[0];
  const { data: assignment } = await supabase
    .from('daily_workout_assignments')
    .select('id')
    .eq('user_id', userId)
    .eq('workout_date', dateStr)
    .eq('original_template_id', templateId)
    .eq('completed', false)
    .maybeSingle();

  if (!assignment) return false;

  await supabase
    .from('daily_workout_assignments')
    .update({
      completed: true,
      completed_log_id: workoutId,
      completed_at: new Date().toISOString(),
    })
    .eq('id', assignment.id);

  return true;
}

async function refreshPersonalRecords(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('canonical_name, distance_meters, duration_seconds')
    .eq('user_id', userId)
    .eq('source', 'concept2')
    .not('duration_seconds', 'is', null)
    .limit(1000);

  if (error || !Array.isArray(data)) {
    return false;
  }

  const records: Record<string, number> = {};
  for (const row of data) {
    const label = typeof row.canonical_name === 'string' && row.canonical_name
      ? row.canonical_name
      : typeof row.distance_meters === 'number'
        ? `${roundToStandardDistance(row.distance_meters)}m`
        : null;
    const duration = typeof row.duration_seconds === 'number' ? row.duration_seconds : null;
    if (!label || !duration) continue;
    if (!records[label] || duration < records[label]) {
      records[label] = duration;
    }
  }

  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({ personal_records: records })
    .eq('user_id', userId);

  return !updateError;
}

async function processWorkoutSummary(
  supabase: ReturnType<typeof createClient>,
  job: C2SyncJob,
  token: string,
  summary: Concept2Summary,
  baseWatts: number,
  machineTypes: Record<string, boolean>,
  forceResync: boolean,
) {
  const machineType = summary.type || 'rower';
  if (machineTypes[machineType] === false) {
    await markJobItem(supabase, job, summary, 'skipped_filtered');
    return 'skipped_filtered' as const;
  }

  if (!forceResync && await hasExistingWorkout(supabase, job.user_id, String(summary.id))) {
    await markJobItem(supabase, job, summary, 'skipped_existing');
    return 'skipped_existing' as const;
  }

  await markJobItem(supabase, job, summary, 'processing');

  try {
    const detail = await fetchConcept2Json(token, buildResultDetailUrl(summary.id)) as Concept2Detail;
    const strokesResult = await fetchConcept2Json(token, buildStrokesUrl(summary.id), true);
    const strokes = Array.isArray(strokesResult) ? strokesResult as Concept2Stroke[] : [];
    const fullData = { ...detail, strokes };
    const intervals = detail.workout?.intervals ?? detail.workout?.splits ?? [];
    const calculated = calculateCanonicalName(intervals);
    const canonicalName = fallbackCanonicalName(summary, detail, calculated);
    const canonicalSignature = normalizeForMatching(canonicalName);
    const zoneDistribution = calculateZoneDistribution(strokes, intervals, baseWatts);
    const seconds = summary.time / 10;
    const avgSplit = summary.distance > 0 ? Math.min((seconds / summary.distance) * 500, 999.9) : null;
    let watts = summary.watts ? Math.round(summary.watts) : null;
    if (!watts && avgSplit) {
      watts = Math.min(Math.round(2.8 * Math.pow(500 / avgSplit, 3)), 3000);
    }

    const record: Record<string, unknown> = {
      external_id: String(summary.id),
      user_id: job.user_id,
      workout_name: summary.workout_type || 'Workout',
      workout_type: machineType,
      completed_at: summary.date,
      distance_meters: summary.distance,
      rest_distance_meters: summary.rest_distance ?? detail.rest_distance ?? null,
      duration_minutes: Math.round(summary.time / 600),
      duration_seconds: seconds,
      watts,
      average_stroke_rate: summary.stroke_rate ? Math.round(summary.stroke_rate) : null,
      calories_burned: detail.calories_total ?? summary.calories_total ?? null,
      average_heart_rate: detail.heart_rate?.average ?? null,
      max_heart_rate: detail.heart_rate?.max ?? null,
      source: 'concept2',
      notes: `RWN: ${canonicalName}`,
      raw_data: fullData,
      zone_distribution: zoneDistribution,
      canonical_name: canonicalName,
      canonical_signature: canonicalSignature,
      avg_split_500m: avgSplit,
    };

    const match = await findMatchingWorkout(supabase, job.user_id, summary);
    if (match) {
      if (shouldUpgrade(match.source, 'concept2')) {
        record.id = match.id;
      } else {
        await markJobItem(supabase, job, summary, 'skipped_existing', {
          metadata: { matched_log_id: match.id, matched_source: match.source },
        });
        return 'skipped_existing' as const;
      }
    }

    const writeQuery = record.id
      ? supabase
        .from('workout_logs')
        .update(record)
        .eq('id', record.id)
        .select('id')
      : supabase
        .from('workout_logs')
        .upsert(record, { onConflict: 'external_id' })
        .select('id');

    const { data: upserted, error } = await writeQuery.limit(1);

    if (error || !Array.isArray(upserted) || !upserted[0]?.id) {
      throw new Error(`Failed to upsert workout ${summary.id}: ${error?.message ?? 'No workout returned.'}`);
    }

    const workoutId = upserted[0].id as string;
    const templateId = await matchWorkoutToTemplate(supabase, workoutId, job.user_id, canonicalName);
    const assignmentLinked = await linkAssignment(supabase, workoutId, job.user_id, summary.date, templateId);

    if (strokes.length) {
      const buckets = calculatePowerBuckets(strokes);
      await supabase
        .from('workout_power_distribution')
        .upsert({ workout_id: workoutId, buckets });
    }

    await markJobItem(supabase, job, summary, 'succeeded', {
      metadata: {
        workout_log_id: workoutId,
        canonical_name: canonicalName,
        template_id: templateId,
        assignment_linked: assignmentLinked,
      },
    });

    return 'succeeded' as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Workout processing failed.';
    await markJobItem(supabase, job, summary, 'failed', {
      error_code: 'workout_processing_error',
      error_message: message,
    });
    return 'failed' as const;
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
    let workoutsProcessed = getCounter(metadata, 'workouts_processed');
    let workoutsSkippedExisting = getCounter(metadata, 'workouts_skipped_existing');
    let workoutsSkippedFiltered = getCounter(metadata, 'workouts_skipped_filtered');
    let workoutsFailed = getCounter(metadata, 'workouts_failed');
    let hasMore = false;

    try {
      const token = await getConcept2AccessToken(supabase, job.user_id);
      const baseWatts = await getBaselineWatts(supabase, job.user_id);
      const machineTypes = getMachineTypes(metadata);
      const forceResync = getBooleanMetadata(metadata, 'force_resync', false);

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
        const pageCounters: ProcessCounters = {
          processed: 0,
          skipped_existing: 0,
          skipped_filtered: 0,
          failed: 0,
        };

        for (const rawSummary of summaries) {
          const summary = asSummary(rawSummary);
          if (!summary) {
            pageCounters.failed += 1;
            continue;
          }

          const itemStatus = await processWorkoutSummary(
            supabase,
            job,
            token,
            summary,
            baseWatts,
            machineTypes,
            forceResync,
          );

          if (itemStatus === 'succeeded') pageCounters.processed += 1;
          if (itemStatus === 'skipped_existing') pageCounters.skipped_existing += 1;
          if (itemStatus === 'skipped_filtered') pageCounters.skipped_filtered += 1;
          if (itemStatus === 'failed') pageCounters.failed += 1;
        }

        const totalPages = page.meta?.pagination?.total_pages;
        const currentPage = page.meta?.pagination?.current_page ?? nextPage;
        const explicitNextPage = page.meta?.pagination?.next_page;

        pagesProcessed += 1;
        summariesSeen += summaries.length;
        workoutsProcessed += pageCounters.processed;
        workoutsSkippedExisting += pageCounters.skipped_existing;
        workoutsSkippedFiltered += pageCounters.skipped_filtered;
        workoutsFailed += pageCounters.failed;
        nextPage = typeof explicitNextPage === 'number' && explicitNextPage > currentPage
          ? explicitNextPage
          : currentPage + 1;
        hasMore = typeof totalPages === 'number' ? currentPage < totalPages : summaries.length > 0;

        if (!hasMore) {
          break;
        }
      }

      const finished = !hasMore;
      const noSuccessfulWrites = workoutsProcessed === 0 && workoutsFailed > 0 && workoutsSkippedExisting === 0 && workoutsSkippedFiltered === 0;
      if (finished) {
        await refreshPersonalRecords(supabase, job.user_id);
      }

      const nextMetadata = {
        ...metadata,
        next_page: finished ? null : nextPage,
        last_error: null,
        counters: mergeCounters(metadata, {
          pages_processed: pagesProcessed,
          summaries_seen: summariesSeen,
          workouts_processed: workoutsProcessed,
          workouts_skipped_existing: workoutsSkippedExisting,
          workouts_skipped_filtered: workoutsSkippedFiltered,
          workouts_failed: workoutsFailed,
        }),
      };

      const { error } = await supabase
        .from('c2_sync_jobs')
        .update({
          status: noSuccessfulWrites ? 'failed' : finished ? 'succeeded' : 'queued',
          finished_at: finished || noSuccessfulWrites ? new Date().toISOString() : null,
          last_processed_at: new Date().toISOString(),
          error_code: noSuccessfulWrites ? 'all_workouts_failed' : null,
          error_message: noSuccessfulWrites ? 'All workout items failed during server-side processing.' : null,
          metadata: nextMetadata,
        })
        .eq('id', job.id)
        .eq('status', 'running');

      if (error) {
        throw new Error(`Failed to persist sync progress: ${error.message}`);
      }

      let triggered_next_batch = false;
      if (!finished && !noSuccessfulWrites) {
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
        status: noSuccessfulWrites ? 'failed' : finished ? 'succeeded' : 'queued',
        pages_processed: pagesProcessed,
        summaries_seen: summariesSeen,
        workouts_processed: workoutsProcessed,
        workouts_skipped_existing: workoutsSkippedExisting,
        workouts_skipped_filtered: workoutsSkippedFiltered,
        workouts_failed: workoutsFailed,
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
