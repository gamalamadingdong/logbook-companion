// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ load: vi.fn(), update: vi.fn() }));
vi.mock('../../services/coaching/coachingService', () => ({ getTeamsByIds: mocks.load, updateTeam: mocks.update }));
import { TeamInfoEditorList } from './TeamInfoEditorList';
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks();
  mocks.load.mockResolvedValue([{ id: 'a', name: 'Juniors', description: 'Team' }]);
  mocks.update.mockResolvedValue({ id: 'a', name: 'Juniors', description: 'Team' });
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren(); });
it.each([false, undefined])('keeps ordinary coaches read-only without explicit admin flag (%s)', async (isAdmin) => {
  await act(async () => root.render(<TeamInfoEditorList teams={[{ team_id: 'a', team_name: 'Juniors', role: 'coach', is_admin: isAdmin, org_id: null, org_name: null }]} />));
  expect((document.querySelector('#team-name-a') as HTMLInputElement).disabled).toBe(true);
  expect((document.querySelector('textarea') as HTMLTextAreaElement).disabled).toBe(true);
  expect((document.querySelector('button') as HTMLButtonElement).disabled).toBe(true);
  expect(document.body.textContent).toContain('Read-only');
  expect(mocks.update).not.toHaveBeenCalled();
});
it('allows an explicitly authorized admin to save team identity', async () => {
  await act(async () => root.render(<TeamInfoEditorList teams={[{ team_id: 'a', team_name: 'Juniors', role: 'coach', is_admin: true, org_id: null, org_name: null }]} />));
  const save = document.querySelector('button') as HTMLButtonElement;
  expect(save.disabled).toBe(false);
  await act(async () => save.click());
  expect(mocks.update).toHaveBeenCalledWith('a', { name: 'Juniors', description: 'Team' });
});
