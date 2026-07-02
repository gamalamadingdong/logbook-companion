import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourcePath = resolve(process.cwd(), 'supabase/functions/run-c2-sync-batch/index.ts');
const source = readFileSync(sourcePath, 'utf8');

describe('run-c2-sync-batch edge function contract', () => {
  it('accepts only POST requests while allowing CORS preflight', () => {
    expect(source).toContain("req.method === 'OPTIONS'");
    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain('jsonResponse(405');
  });

  it('requires service role authorization before processing jobs', () => {
    expect(source).toContain("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");
    expect(source).toContain('authHeader(req) !== supabaseServiceRoleKey');
    expect(source).toContain('Service role authorization is required.');
  });

  it('claims only queued Concept2 jobs and marks the claimed job running', () => {
    expect(source).toContain(".from('c2_sync_jobs')");
    expect(source).toContain(".eq('source', 'concept2')");
    expect(source).toContain(".eq('status', 'queued')");
    expect(source).toContain("status: 'running'");
    expect(source).toContain("worker: 'run-c2-sync-batch'");
    expect(source).toContain(".eq('id', job.id)");
    expect(source).toContain(".eq('status', 'queued')");
  });

  it('keeps Concept2 tokens server-side and refreshes them when needed', () => {
    expect(source).toContain(".from('user_integrations')");
    expect(source).toContain('concept2_token, concept2_refresh_token, concept2_expires_at');
    expect(source).toContain("Deno.env.get('CONCEPT2_CLIENT_ID')");
    expect(source).toContain("Deno.env.get('CONCEPT2_CLIENT_SECRET')");
    expect(source).toContain('refreshConcept2Token');
    expect(source).not.toContain('concept2_token: integration.concept2_token');
  });

  it('processes bounded summary pages, workout details, and per-item outcomes', () => {
    expect(source).toContain('DEFAULT_PAGE_LIMIT');
    expect(source).toContain('DEFAULT_TIME_BUDGET_MS');
    expect(source).toContain("new URL('/users/me/results', CONCEPT2_API_BASE_URL)");
    expect(source).toContain("new URL(`/users/me/results/${resultId}`, CONCEPT2_API_BASE_URL)");
    expect(source).toContain("new URL(`/users/me/results/${resultId}/strokes`, CONCEPT2_API_BASE_URL)");
    expect(source).toContain('pages_processed');
    expect(source).toContain('summaries_seen');
    expect(source).toContain('workouts_processed');
    expect(source).toContain('workouts_failed');
    expect(source).toContain('next_page');
    expect(source).toContain(".from('c2_sync_job_items')");
    expect(source).toContain(".from('workout_logs')");
    expect(source).toContain("'skipped_existing'");
    expect(source).toContain("'skipped_filtered'");
    expect(source).toContain('calculateZoneDistribution');
    expect(source).toContain('calculatePowerBuckets');
    expect(source).toContain('matchWorkoutToTemplate');
    expect(source).toContain('refreshPersonalRecords');
  });

  it('requeues unfinished work, triggers the next batch, and persists terminal failures', () => {
    expect(source).toContain("status: noSuccessfulWrites ? 'failed' : finished ? 'succeeded' : 'queued'");
    expect(source).toContain('triggerNextBatch');
    expect(source).toContain("status: 'failed'");
    expect(source).toContain('error_code');
    expect(source).toContain('error_message');
    expect(source).toContain('last_error');
  });
});
