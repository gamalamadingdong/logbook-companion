import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
const calls = vi.hoisted(() => ({ samples: vi.fn(), analysis: vi.fn() }));
vi.mock('../../api/_lib/logbook.js', async importOriginal => ({
  ...await importOriginal<typeof import('../../api/_lib/logbook')>(),
  getWorkoutSamples: calls.samples, analyzeWorkout: calls.analysis,
}));
import handler from '../../api/mcp';
let server: http.Server;
let baseUrl: string;
const prior = { ...process.env };
beforeAll(async () => {
  Object.assign(process.env, { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon', MCP_DISABLE_AUTH: 'true' });
  server = http.createServer((req, res) => { void handler(req as never, res as never); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/mcp`;
});
afterAll(async () => { process.env = prior; await new Promise<void>((resolve,reject) => server.close(error => error ? reject(error) : resolve())); });
beforeEach(() => { vi.clearAllMocks(); calls.samples.mockResolvedValue({ samples: [{ time_seconds: 1, heart_rate_bpm: 191 }], pagination: { next_offset: null } }); calls.analysis.mockResolvedValue({ analysis: { secondsAboveThreshold: 1, coveredSeconds: 2 } }); });
async function rpc(method: string, params = {}) {
  return fetch(baseUrl, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
}
it('discovers all original tools plus read-only samples and analysis', async () => {
  const response = await rpc('tools/list'); expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.result.tools.map((tool: { name: string }) => tool.name)).toEqual(expect.arrayContaining(['search_workouts','get_workout','get_training_summary','get_performance_trend','compare_training_periods','get_benchmark_history','list_benchmarks','get_workout_samples','analyze_workout']));
  for (const name of ['get_workout_samples','analyze_workout']) expect(body.result.tools.find((tool: { name: string }) => tool.name === name).annotations.readOnlyHint).toBe(true);
});
it('dispatches sample pages as structured content and rejects unbounded page sizes', async () => {
  const response = await rpc('tools/call', { name: 'get_workout_samples', arguments: { id: '98848028', limit: 2, offset: 4 } });
  const body = await response.json(); expect(body.result.structuredContent.samples[0].heart_rate_bpm).toBe(191);
  expect(calls.samples).toHaveBeenCalledWith(expect.any(Object), '98848028', { limit: 2, offset: 4 });
  calls.samples.mockClear();
  const invalid = await (await rpc('tools/call', { name: 'get_workout_samples', arguments: { id: '98848028', limit: 501 } })).json();
  expect(invalid.result?.isError || invalid.error).toBeTruthy(); expect(calls.samples).not.toHaveBeenCalled();
});
it('dispatches HR threshold analysis and reports inaccessible workouts without a fake result', async () => {
  const body = await (await rpc('tools/call', { name: 'analyze_workout', arguments: { id: '98848028', thresholdBpm: 190 } })).json();
  expect(body.result.structuredContent.analysis.coveredSeconds).toBe(2);
  expect(calls.analysis).toHaveBeenCalledWith(expect.any(Object), '98848028', 190, undefined);
  calls.analysis.mockResolvedValueOnce(null);
  const missing = await (await rpc('tools/call', { name: 'analyze_workout', arguments: { id: '98848028', thresholdBpm: 190 } })).json();
  expect(missing.result.structuredContent.error).toContain('not found');
});
it('rejects requests with no bearer token when normal authentication is enabled', async () => {
  delete process.env.MCP_DISABLE_AUTH;
  try { const response = await rpc('tools/list'); expect(response.status).toBe(401); expect(response.headers.get('www-authenticate')).toContain('resource_metadata'); }
  finally { process.env.MCP_DISABLE_AUTH = 'true'; }
});
