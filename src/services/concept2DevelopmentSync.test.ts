import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHandler, PROVIDER, type Dependencies } from '../../supabase/functions/concept2-development-auth/handler';
import { parseResults } from '../../supabase/functions/concept2-development-auth/results';

const row = { id: 123, date: '2026-09-16 10:00:00', type: 'rower', distance: 5000, time: 12345 };
function fixture() {
  const sync = vi.fn(async (_user: string, action: string): Promise<Record<string, unknown>> => {
    if (action === 'claim') return { operation_id: 'claim', access_token: 'server-only' };
    if (action === 'list') return { results: [row], total: 1, environment: 'development' };
    return { imported: 1, environment: 'development' };
  });
  const network = vi.fn(async () => new Response(JSON.stringify({ data: [row], meta: { pagination: {
    current_page: 1, total_pages: 2, links: { next: 'https://evil.test' },
  } } })));
  const deps: Dependencies = { config: { origin: 'https://logbook-dev.readyall.org', clientId: 'id', clientSecret: 'secret' },
    authenticate: async () => 'owner', operation: async () => ({}), syncOperation: sync, fetch: network };
  const request = (body: unknown, origin = deps.config!.origin, auth = 'Bearer fixture') => createHandler(deps)(new Request('https://edge.test', {
    method: 'POST', headers: { Origin: origin, Authorization: auth }, body: JSON.stringify(body),
  }));
  return { deps, sync, network, request };
}
describe('isolated development import', () => {
  it('reads back only the returned development result ID and saves its sanitized summary', async () => {
    const f = fixture(); f.network.mockResolvedValue(new Response(JSON.stringify({ data: { ...row, private_token: 'discard' } })));
    const res = await f.request({ action: 'read_result', result_id: 123 });
    expect(res.status).toBe(200);
    expect(f.network).toHaveBeenCalledWith(`${PROVIDER}/api/users/me/results/123`, expect.objectContaining({ redirect: 'error' }));
    expect(f.sync).toHaveBeenLastCalledWith('owner', 'save', { operation_id: 'claim', results: [row] });
  });
  it('rejects an invalid or mismatched exact result ID without saving', async () => {
    const invalid = fixture();
    expect((await invalid.request({ action: 'read_result', result_id: '123' })).status).toBe(400);
    expect(invalid.sync).not.toHaveBeenCalled();
    const mismatched = fixture();
    mismatched.network.mockResolvedValue(new Response(JSON.stringify({ data: { ...row, id: 124 } })));
    expect((await mismatched.request({ action: 'read_result', result_id: 123 })).status).toBe(409);
    expect(mismatched.sync.mock.calls.map(call => call[1])).toEqual(['claim', 'release']);
  });
  it('releases a failed exact-ID read and never stores malformed provider data', async () => {
    const f = fixture(); f.network.mockResolvedValue(new Response(JSON.stringify({ data: { ...row, time: '12345' } })));
    expect((await f.request({ action: 'read_result', result_id: 123 })).status).toBe(409);
    expect(f.sync.mock.calls.map(call => call[1])).toEqual(['claim', 'release']);
  });
  it('marks an unauthorized exact-ID read for refresh without retrying the GET', async () => {
    const f = fixture(); f.network.mockResolvedValue(new Response('{}', { status: 401 }));
    expect((await f.request({ action: 'read_result', result_id: 123 })).status).toBe(409);
    expect(f.sync).toHaveBeenCalledWith('owner', 'unauthorized', { operation_id: 'claim' });
    expect(f.network).toHaveBeenCalledTimes(1);
  });
  it('fetches only development, preserves tenths, strips extra fields, ignores pagination links', async () => {
    const f = fixture(); const res = await f.request({ action: 'sync', page: 1 });
    expect(res.status).toBe(200); expect(await res.json()).toEqual({ environment: 'development', imported: 1, next_page: 2 });
    expect(f.network).toHaveBeenCalledWith(`${PROVIDER}/api/users/me/results?number=25&page=1`, expect.objectContaining({ redirect: 'error' }));
    expect(f.sync).toHaveBeenLastCalledWith('owner', 'save', { operation_id: 'claim', results: [row] });
    expect(parseResults({ data: [{ ...row, secret: 'never-store' }] }, 1).results).toEqual([row]);
  });
  it('lists persisted results without accessing provider credentials', async () => {
    const f = fixture(); const res = await f.request({ action: 'results', page: 2 });
    expect((await res.json()).total).toBe(1); expect(f.network).not.toHaveBeenCalled();
    expect(f.sync).toHaveBeenCalledExactlyOnceWith('owner', 'list', { page: 2 });
  });
  it.each([0, -1, '2', 1.5, 100001])('rejects invalid page %s before claiming', async page => {
    const f = fixture(); expect((await f.request({ action: 'sync', page })).status).toBe(409);
    expect(f.sync).not.toHaveBeenCalled(); expect(f.network).not.toHaveBeenCalled();
  });
  it('rejects unauthenticated, cross-origin and user overrides', async () => {
    const f = fixture();
    expect((await f.request({ action: 'sync' }, undefined, '')).status).toBe(401);
    expect((await f.request({ action: 'sync' }, 'https://evil.test')).status).toBe(403);
    expect((await f.request({ action: 'sync', user_id: 'someone-else' })).status).toBe(400);
    expect(f.sync).not.toHaveBeenCalled();
  });
  it('never fetches when the credential claim fails', async () => {
    const f = fixture(); f.sync.mockRejectedValue(new Error('busy or expired'));
    expect((await f.request({ action: 'sync' })).status).toBe(409); expect(f.network).not.toHaveBeenCalled();
  });
  it('releases only its GET claim on timeout and does not retry or leak token', async () => {
    const f = fixture(); f.network.mockRejectedValue(new Error('server-only'));
    const res = await f.request({ action: 'sync' }); expect(res.status).toBe(409);
    expect(await res.text()).not.toContain('server-only'); expect(f.network).toHaveBeenCalledTimes(1);
    expect(f.sync).toHaveBeenLastCalledWith('owner', 'release', { operation_id: 'claim' });
  });
  it('401 schedules a later refresh without retrying the request', async () => {
    const f = fixture(); f.network.mockResolvedValue(new Response('{}', { status: 401 }));
    expect((await f.request({ action: 'sync' })).status).toBe(409);
    expect(f.sync).toHaveBeenCalledWith('owner', 'unauthorized', { operation_id: 'claim' });
    expect(f.network).toHaveBeenCalledTimes(1);
  });
  it('rejects malformed/duplicate payloads and releases without partial saves', async () => {
    for (const payload of [{ data: [row, row] }, { data: [{ ...row, time: '12' }] }, { data: null }, { data: [row], meta: { pagination: { current_page: 3, total_pages: 1 } } }]) {
      const f = fixture(); f.network.mockResolvedValue(new Response(JSON.stringify(payload)));
      expect((await f.request({ action: 'sync' })).status).toBe(409);
      expect(f.sync.mock.calls.map(c => c[1])).toEqual(['claim', 'release']);
    }
  });
  it('handles empty accounts and provider pages without metadata', () => {
    expect(parseResults({ data: [] }, 1)).toEqual({ results: [], next_page: null });
    const rows = Array.from({ length: 25 }, (_, i) => ({ ...row, id: i + 1 }));
    expect(parseResults({ data: rows }, 2).next_page).toBe(3);
  });
  it('reports a failed save rather than success; retries stay DB-idempotent', async () => {
    const f = fixture(); f.sync.mockImplementation(async (_u, action) => {
      if (action === 'save') throw new Error('database unavailable');
      return { operation_id: 'claim', access_token: 'server-only' };
    });
    expect((await f.request({ action: 'sync' })).status).toBe(409);
    expect(f.sync).toHaveBeenLastCalledWith('owner', 'release', { operation_id: 'claim' });
  });
  it('dashboard lost-connection warning is production-only', () => {
    const source = readFileSync('src/pages/Dashboard.tsx', 'utf8');
    expect(source).toContain('legacyConcept2Enabled && !c2Connected');
    expect(source).toContain('Check development connection and imports');
  });
});
