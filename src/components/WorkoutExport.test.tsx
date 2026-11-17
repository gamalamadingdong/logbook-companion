// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ load: vi.fn(), download: vi.fn(), user: { id: 'owner' } as { id: string } | null, guest: false }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.user, isGuest: mocks.guest }) }));
vi.mock('../services/workoutExportService', () => ({ loadWorkoutForExport: mocks.load, downloadWorkoutExport: mocks.download }));
import { WorkoutExport } from './WorkoutExport';
import { normalizeWorkoutDetail } from '../../shared/workoutDetail';
let root: Root;
const detail = () => normalizeWorkoutDetail({ id: 'workout', source: 'manual' });
async function render(id = 'workout') { await act(async () => root.render(<WorkoutExport workoutId={id} />)); }
async function click() { await act(async () => document.querySelector('button')!.click()); }
async function choose(format: string) { await act(async () => { const select = document.querySelector('select')!; select.value = format; select.dispatchEvent(new Event('change', { bubbles: true })); }); }
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); mocks.user = { id: 'owner' }; mocks.guest = false; mocks.load.mockResolvedValue(detail()); const host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren(); });
it('fetches only on export and downloads full JSON', async () => {
  await render(); expect(mocks.load).not.toHaveBeenCalled();
  expect(document.querySelector('select')?.options.length).toBe(2);
  await click(); expect(mocks.load).toHaveBeenCalledWith('workout', 'owner'); expect(mocks.download).toHaveBeenCalledWith(detail(), 'json');
});
it('explains missing CSV and keeps JSON export available', async () => {
  await render(); await choose('csv'); await click(); expect(mocks.download).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain('JSON'); expect(document.body.textContent).toContain('sample');
  await choose('json'); await click(); expect(mocks.download).toHaveBeenCalledWith(detail(), 'json');
});
it('downloads available CSV through the shared document', async () => {
  const available = normalizeWorkoutDetail({ id: 'workout', source: 'concept2', raw_data: { strokes: [{ t: 10, d: 20, p: 1200 }] } });
  mocks.load.mockResolvedValue(available); await render(); await choose('csv'); await click(); expect(mocks.download).toHaveBeenCalledWith(available, 'csv');
});
it('shows immediate busy, prevents duplicate requests and supports retry', async () => {
  let reject!: (error: Error) => void; mocks.load.mockReturnValueOnce(new Promise((_, r) => { reject = r; }));
  await render(); await click(); expect(document.querySelector('button')?.disabled).toBe(true); await click(); expect(mocks.load).toHaveBeenCalledTimes(1);
  await act(async () => reject(new Error('Unable to load. Retry export.'))); expect(document.querySelector('[role="alert"]')?.textContent).toContain('Retry');
  await click(); expect(mocks.download).toHaveBeenCalledTimes(1);
});
it.each(['workout', 'account', 'guest', 'unmount'])('discards pending responses after %s changes', async change => {
  let resolve!: (value: unknown) => void; mocks.load.mockReturnValueOnce(new Promise(r => { resolve = r; }));
  await render(); await click();
  if (change === 'account') mocks.user = { id: 'other' };
  if (change === 'guest') mocks.guest = true;
  if (change === 'unmount') await act(async () => root.render(null));
  else await render(change === 'workout' ? 'other-workout' : 'workout');
  await act(async () => resolve(detail())); expect(mocks.download).not.toHaveBeenCalled();
});
it.each(['signed-out', 'guest'])('hides persisted export from %s sessions', async session => {
  if (session === 'guest') mocks.guest = true;
  else mocks.user = null;
  await render(); expect(document.querySelector('button')).toBeNull(); expect(mocks.load).not.toHaveBeenCalled();
});
it('allows retry after file creation fails', async () => {
  mocks.download.mockImplementationOnce(() => { throw new Error('Download failed. Retry export.'); });
  await render(); await click(); expect(document.querySelector('[role="alert"]')?.textContent).toContain('Retry');
  await click(); expect(mocks.download).toHaveBeenCalledTimes(2); expect(document.querySelector('[role="alert"]')).toBeNull();
});
