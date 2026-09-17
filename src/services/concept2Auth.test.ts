import { describe, expect, it, vi } from 'vitest';
import { configuration, createHandler, PROVIDER, type Dependencies } from '../../supabase/functions/concept2-development-auth/handler';
import { blockedDevelopmentRequest, legacyConcept2Enabled, requireProductionConcept2 } from './concept2Environment';
import { getDevelopmentPublishBlockers, validateDevelopmentWorkoutDraft } from './concept2Auth';

const origin = 'https://logbook-dev.readyall.org';
const state = 's'.repeat(72);
function fixture() {
  const operation = vi.fn(async (...args: Parameters<Dependencies['operation']>) => args[1] === 'status'
    ? { connected: false, environment: 'development' }
    : { operation_id: 'operation', refresh_token: 'test-refresh', provider_user_id: '42',
      token_scope: args[1] === 'refresh' ? 'user:read,results:read' : 'user:read,results:write' });
  const network = vi.fn(async (...args: Parameters<typeof fetch>) => new Response(JSON.stringify(
    String(args[0]).endsWith('/users/me') ? { data: { id: 42 } } : { access_token: 'test-access', refresh_token: 'test-rotated', expires_in: 3600 },
  ), { status: 200 }));
  const deps: Dependencies = { config: { origin, clientId: 'test-client', clientSecret: 'test-secret' },
    authenticate: vi.fn(async () => 'user-1'), operation, fetch: network as typeof fetch };
  const request = (body: unknown, options: { origin?: string; auth?: string } = {}) => createHandler(deps)(new Request('https://edge.test', {
    method: 'POST', headers: { Origin: options.origin ?? origin, Authorization: options.auth ?? 'Bearer app-session' }, body: JSON.stringify(body),
  }));
  return { deps, operation, network, request };
}
describe('development Concept2 boundary', () => {
  it('explains incomplete workout-entry fields instead of silently disabling save', () => {
    expect(validateDevelopmentWorkoutDraft({ distance: '', duration: '0', completedAt: '' }, new Date('2026-09-17T12:00:00Z'))).toEqual({
      distance: 'Enter a whole number of meters greater than zero.',
      duration: 'Enter work time in seconds greater than zero.',
      completedAt: 'Enter when the workout was completed.',
    });
    expect(validateDevelopmentWorkoutDraft({ distance: '5000', duration: '1200', completedAt: '2026-09-17T08:00' }, new Date('2026-09-17T12:00:00Z'))).toEqual({});
  });
  it('lists the exact prerequisites blocking publication', () => {
    expect(getDevelopmentPublishBlockers({ connection: { connected: true, can_publish: true, environment: 'development' },
      selectedId: '', weightClass: '', timezone: 'America/New_York', confirmed: false })).toEqual([
      'Save or select a completed LC workout.', 'Select your Concept2 weight class.', 'Confirm that you completed the saved workout.',
    ]);
    expect(getDevelopmentPublishBlockers({ connection: { connected: true, can_publish: false, environment: 'development' },
      selectedId: 'workout', weightClass: 'H', timezone: 'America/New_York', confirmed: true })).toEqual([
      'Reconnect Concept2 to grant development write permission.',
    ]);
    expect(getDevelopmentPublishBlockers({ connection: { connected: true, can_publish: true, environment: 'development' },
      selectedId: 'workout', weightClass: 'H', timezone: 'America/New_York', confirmed: true,
      existingStatus: 'published' })).toEqual(['This workout is already published to Concept2 development.']);
  });
  it('fails closed without complete server configuration; rejects arbitrary and production origins', () => {
    expect(configuration(() => undefined)).toBeNull();
    expect(configuration(k => k.endsWith('ORIGIN') ? 'https://logbook.readyall.org' : 'fixture')).toBeNull();
    expect(configuration(k => k.endsWith('ORIGIN') ? origin : 'fixture')).not.toBeNull();
  });
  it('missing config never reaches authentication or provider', async () => {
    const f = fixture(); f.deps.config = null;
    expect((await f.request({ action: 'begin' })).status).toBe(503);
    expect(f.operation).not.toHaveBeenCalled(); expect(f.network).not.toHaveBeenCalled();
  });
  it('denies foreign origins and unauthenticated requests', async () => {
    const f = fixture();
    expect((await f.request({ action: 'begin' }, { origin: 'https://evil.test' })).status).toBe(403);
    expect((await f.request({ action: 'begin' }, { auth: '' })).status).toBe(401);
    f.deps.authenticate = async () => null;
    expect((await f.request({ action: 'begin' })).status).toBe(401);
    expect(f.operation).not.toHaveBeenCalled();
  });
  it.each(['environment', 'user_id', 'redirect_uri', 'provider', 'access_token'])('rejects caller override %s', async key => {
    const f = fixture(); expect((await f.request({ action: 'begin', [key]: 'override' })).status).toBe(400);
    expect(f.operation).not.toHaveBeenCalled();
  });
  it('generates hashed user-bound state and a fixed development authorization URL', async () => {
    const f = fixture(); const result = await (await f.request({ action: 'begin' })).json();
    const url = new URL(result.authorization_url);
    expect(url.origin).toBe(PROVIDER); expect(url.searchParams.get('redirect_uri')).toBe(`${origin}/callback`);
    expect(url.searchParams.get('scope')).toBe('user:read,results:write');
    const values = f.operation.mock.calls[0] as unknown[];
    expect(values[0]).toBe('user-1'); expect(values[1]).toBe('begin');
    expect(values[2]).toMatchObject({ requested_scope: 'user:read,results:write' });
    expect(JSON.stringify(values[2])).not.toContain(url.searchParams.get('state'));
    expect(JSON.stringify(result)).not.toContain('test-secret');
  });
  it('exchanges once, saves tokens only server-side and returns a scoped identity', async () => {
    const f = fixture(); const response = await f.request({ action: 'exchange', code: 'test-code', state });
    const text = await response.text(); expect(response.status).toBe(200);
    expect(text).not.toMatch(/test-access|test-rotated|test-secret/); expect(text).toContain('development');
    expect(f.network.mock.calls.map(call => String(call[0]))).toEqual([`${PROVIDER}/oauth/access_token`, `${PROVIDER}/api/users/me`]);
    expect(f.operation.mock.calls.map(call => call[1])).toEqual(['exchange', 'save']);
    const tokenRequest = f.network.mock.calls[0]?.[1] as RequestInit;
    expect(new URLSearchParams(String(tokenRequest.body)).get('scope')).toBe('user:read,results:write');
    expect(f.operation.mock.calls[1]?.[2]).toMatchObject({ token_scope: 'user:read,results:write' });
  });
  it('invalid, expired, cross-user and replayed state rejected by DB never reaches provider', async () => {
    const f = fixture(); f.deps.operation = async () => { throw new Error('invalid state'); };
    expect((await f.request({ action: 'exchange', code: 'test-code', state })).status).toBe(409);
    expect(f.network).not.toHaveBeenCalled();
  });
  it('refresh uses only server-held tokens and preserves rotated refresh tokens', async () => {
    const f = fixture(); expect((await f.request({ action: 'refresh' })).status).toBe(200);
    expect(f.network).toHaveBeenCalledTimes(1);
    const save = f.operation.mock.calls[1] as unknown[];
    expect(save[2]).toMatchObject({ refresh_token: 'test-rotated', provider_user_id: '42' });
    const tokenRequest = f.network.mock.calls[0]?.[1] as RequestInit;
    expect(new URLSearchParams(String(tokenRequest.body)).get('scope')).toBe('user:read,results:read');
  });
  it('refresh keeps write scope after a write-authorized reconnect', async () => {
    const f = fixture();
    f.deps.operation = async () => ({ operation_id: 'operation', refresh_token: 'test-refresh',
      provider_user_id: '42', token_scope: 'user:read,results:write' });
    expect((await f.request({ action: 'refresh' })).status).toBe(200);
    const tokenRequest = f.network.mock.calls[0]?.[1] as RequestInit;
    expect(new URLSearchParams(String(tokenRequest.body)).get('scope')).toBe('user:read,results:write');
  });
  it('fresh tokens and busy account claims never trigger another refresh', async () => {
    const f = fixture(); f.deps.operation = async () => ({ fresh: true });
    expect((await f.request({ action: 'refresh' })).status).toBe(200);
    f.deps.operation = async () => { throw new Error('busy'); };
    expect((await f.request({ action: 'refresh' })).status).toBe(409);
    expect(f.network).not.toHaveBeenCalled();
  });
  it('ambiguous provider failures have no retry or lock release; errors never leak payloads', async () => {
    const f = fixture(); f.deps.fetch = vi.fn(async () => { throw new Error('sensitive provider payload'); });
    const result = await f.request({ action: 'refresh' }); expect(result.status).toBe(409);
    expect(await result.text()).not.toContain('sensitive');
    expect(f.deps.fetch).toHaveBeenCalledTimes(1); expect(f.operation).toHaveBeenCalledTimes(1);
  });
  it('revoked refresh credentials require reconnect and are cleared with a fenced rejection', async () => {
    const f = fixture(); f.deps.fetch = vi.fn(async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }));
    const result = await f.request({ action: 'refresh' });
    expect(result.status).toBe(409); expect(await result.text()).toContain('Reconnect');
    expect(f.operation.mock.calls.map(call => call[1])).toEqual(['refresh', 'reject']);
  });
  it('save failure never leaks or retries newly rotated credentials', async () => {
    const f = fixture(); f.deps.operation = async (_user, action) => {
      if (action === 'save') throw new Error('DB unavailable');
      return { operation_id: 'operation', refresh_token: 'test-refresh', provider_user_id: '42',
        token_scope: 'user:read,results:read' };
    };
    const result = await f.request({ action: 'refresh' });
    expect(result.status).toBe(409); expect(await result.text()).not.toContain('test-rotated');
    expect(f.network).toHaveBeenCalledTimes(1);
  });
  it('legacy API exports reject in staging before loading production refresh code', async () => {
    const api = await import('../api/concept2');
    await expect(api.getProfile()).rejects.toThrow(/disabled/);
    await expect(api.getResults()).rejects.toThrow(/disabled/);
    await expect(api.getResultDetail(42)).rejects.toThrow(/disabled/);
    await expect(api.getStrokes(42)).rejects.toThrow(/disabled/);
  });
  it('rejects an incomplete publishing request before provider dispatch', async () => {
    const f = fixture(); expect((await f.request({ action: 'publish' })).status).toBe(400);
    expect(f.network).not.toHaveBeenCalled();
  });
  it('creates a tightly bounded owned manual workout without contacting Concept2', async () => {
    const f = fixture();
    f.deps.createWorkout = vi.fn(async (user, values) => ({ workout_id: 'workout-1', user, ...values }));
    const response = await f.request({ action: 'create_workout', distance_meters: 5000,
      duration_seconds: 1200, completed_at: '2026-09-17T11:00:00.000Z' });
    expect(response.status).toBe(200);
    expect(f.deps.createWorkout).toHaveBeenCalledWith('user-1', expect.objectContaining({ distance_meters: 5000 }));
    expect(f.network).not.toHaveBeenCalled();
    expect((await f.request({ action: 'create_workout', distance_meters: -1,
      duration_seconds: 1200, completed_at: '2026-09-17T11:00:00.000Z' })).status).toBe(400);
  });
  it('publishes one owned claim to the fixed development endpoint and returns only the result ID', async () => {
    const f = fixture();
    const publication = vi.fn(async (_user: string, action: string) => action === 'claim'
      ? { dispatch: true, attempt_id: 'attempt', access_token: 'secret-access', workout_id: 'workout',
          payload: { type: 'rower', date: '2026-09-16 08:00:00', timezone: 'America/New_York', distance: 5000, time: 12000 } }
      : { status: 'published' });
    f.deps.publishOperation = publication;
    f.deps.fetch = vi.fn(async () => new Response(JSON.stringify({ data: {
      id: 999, type: 'rower', date: '2026-09-16 08:00:00', distance: 5000, time: 12000,
    } }), { status: 201 }));
    const response = await f.request({ action: 'publish', workout_id: '00000000-0000-0000-0000-00000000aaaa',
      timezone: 'America/New_York', weight_class: 'H', privacy: 'private', confirmed_completed: true });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'published', result_id: 999, workout_id: 'workout' });
    expect((f.deps.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe(`${PROVIDER}/api/users/me/results`);
    expect(publication.mock.calls.map(call => call[1])).toEqual(['claim', 'finish']);
  });
  it('keeps uncertain POST results for review without another dispatch', async () => {
    const f = fixture();
    const publication = vi.fn(async (_user: string, action: string) => action === 'claim'
      ? { dispatch: true, attempt_id: 'attempt', access_token: 'secret-access', workout_id: 'workout',
          payload: { type: 'rower', date: '2026-09-16 08:00:00', timezone: 'America/New_York', distance: 5000, time: 12000 } }
      : { status: 'outcome_unknown' });
    f.deps.publishOperation = publication;
    f.deps.fetch = vi.fn(async () => { throw new Error('response lost'); });
    const request = { action: 'publish', workout_id: '00000000-0000-0000-0000-00000000aaaa',
      timezone: 'America/New_York', weight_class: 'H', privacy: 'private', confirmed_completed: true };
    expect(await (await f.request(request)).json()).toMatchObject({ status: 'outcome_unknown' });
    expect(f.deps.fetch).toHaveBeenCalledTimes(1);
    f.deps.publishOperation = async () => ({ dispatch: false, status: 'outcome_unknown' });
    expect(await (await f.request(request)).json()).toMatchObject({ status: 'outcome_unknown' });
    expect(f.deps.fetch).toHaveBeenCalledTimes(1);
  });
  it.each([[401, 'rejected', true], [403, 'rejected', true], [422, 'rejected', false],
    [409, 'outcome_unknown', false], [503, 'outcome_unknown', false]])('classifies POST status %i without retry', async (status, outcome, reconnectRequired) => {
    const f = fixture();
    const publication = vi.fn(async (...args: [string, string, Record<string, unknown>?]) => args[1] === 'claim'
      ? { dispatch: true, attempt_id: 'attempt', access_token: 'secret-access', workout_id: 'workout',
          payload: { type: 'rower', date: '2026-09-16 08:00:00', timezone: 'America/New_York', distance: 5000, time: 12000 } }
      : { status: outcome });
    f.deps.publishOperation = publication;
    f.deps.fetch = vi.fn(async () => new Response('{}', { status }));
    const response = await f.request({ action: 'publish', workout_id: '00000000-0000-0000-0000-00000000aaaa',
      timezone: 'America/New_York', weight_class: 'H', privacy: 'private', confirmed_completed: true });
    expect((await response.json()).status).toBe(outcome);
    expect(f.deps.fetch).toHaveBeenCalledTimes(1);
    expect(publication.mock.calls[1]?.[2]).toEqual({ attempt_id: 'attempt', outcome,
      ...(reconnectRequired ? { reconnect_required: true } : {}) });
  });
  it('staging blocks legacy tokens, jobs and analytics writes but permits the new auth function', () => {
    expect(legacyConcept2Enabled).toBe(false); expect(requireProductionConcept2).toThrow(/disabled/);
    for (const path of ['rest/v1/user_integrations', 'rest/v1/c2_sync_jobs', 'functions/v1/start-c2-sync', 'functions/v1/run-c2-sync-batch', 'functions/v1/publish-to-c2']) {
      expect(blockedDevelopmentRequest(`https://db.test/${path}`, 'GET')).toBe(true);
    }
    expect(blockedDevelopmentRequest('https://db.test/rest/v1/workout_logs', 'POST')).toBe(true);
    expect(blockedDevelopmentRequest('https://db.test/rest/v1/workout_logs', 'GET')).toBe(false);
    expect(blockedDevelopmentRequest('https://db.test/functions/v1/concept2-development-auth', 'POST')).toBe(false);
  });
});
