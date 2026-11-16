// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('../../services/coaching/teamSeasonService', () => ({ listTeamSeasons: mocks.list }));
import { TeamSeasonNotice } from './TeamSeasonNotice';
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren(); });
it('shows current season rather than a prepared future draft', async () => {
  mocks.list.mockResolvedValue([{ name: '2027/2028', status: 'draft' }, { name: '2026/2027', status: 'active' }]);
  await act(async () => root.render(<MemoryRouter><TeamSeasonNotice teamId="team-a" /></MemoryRouter>));
  expect(document.body.textContent).toContain('2026/2027');
  expect(document.body.textContent).not.toContain('2027/2028');
});
it('ignores an old team response after switching scope', async () => {
  let resolveOld!: (value: unknown[]) => void;
  mocks.list.mockImplementation((id: string) => id === 'team-a' ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve([{ name: 'New team season', status: 'active' }]));
  const render = (id: string) => <MemoryRouter><TeamSeasonNotice teamId={id} /></MemoryRouter>;
  await act(async () => root.render(render('team-a')));
  await act(async () => root.render(render('team-b')));
  await act(async () => resolveOld([{ name: 'Old team season', status: 'active' }]));
  expect(document.body.textContent).toContain('New team season');
  expect(document.body.textContent).not.toContain('Old team season');
});
