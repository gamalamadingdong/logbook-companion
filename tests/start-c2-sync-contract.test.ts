import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourcePath = resolve(process.cwd(), 'supabase/functions/start-c2-sync/index.ts');
const source = readFileSync(sourcePath, 'utf8');

describe('start-c2-sync edge function contract', () => {
  it('accepts only POST requests while allowing CORS preflight', () => {
    expect(source).toContain("req.method === 'OPTIONS'");
    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain('jsonResponse(405');
  });

  it('requires an authenticated bearer token before creating a job', () => {
    expect(source).toContain("req.headers.get('Authorization')");
    expect(source).toContain("authHeader?.startsWith('Bearer ')");
    expect(source).toContain('supabase.auth.getUser(jwt)');
    expect(source).toContain('jsonResponse(401');
  });

  it('validates the bounded phase 2 request payload', () => {
    expect(source).toContain('Request body must be valid JSON.');
    expect(source).toContain('Request body must be a JSON object.');
    expect(source).toContain("normalizeOptionalDate(payload.requested_from, 'requested_from')");
    expect(source).toContain("normalizeOptionalDate(payload.requested_to, 'requested_to')");
    expect(source).toContain('must use YYYY-MM-DD format.');
    expect(source).toContain('must be a valid calendar date.');
    expect(source).toContain('requested_from cannot be after requested_to.');
    expect(source).toContain('mode must be workout_processing for this phase.');
    expect(source).toContain('metadata must be a JSON object when provided.');
  });

  it('queues a Concept2 sync job and returns a polling-compatible job id immediately', () => {
    expect(source).toContain(".from('c2_sync_jobs')");
    expect(source).toContain("status: 'queued'");
    expect(source).toContain("source: 'concept2'");
    expect(source).toContain("trigger: 'start-c2-sync'");
    expect(source).toContain(".select('id, status, created_at')");
    expect(source).toContain('jsonResponse(202');
    expect(source).toContain('job_id: data.id');
    expect(source).toContain('status: data.status');
    expect(source).toContain('created_at: data.created_at');
  });
});
