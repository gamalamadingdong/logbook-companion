// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ events: vi.fn(), seasons: vi.fn() }));
vi.mock('../../services/coaching/coachingService', () => ({ getScheduleEvents: mocks.events }));
vi.mock('../../services/coaching/teamSeasonService', () => ({ listTeamSeasons: mocks.seasons }));
import { DashboardEvents, DashboardSeason } from './DashboardContext';
let root: Root;
const scope = { orgId: 'club', teamIds: ['a'], date: '2026-11-17' };
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.resetAllMocks();
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  mocks.events.mockResolvedValue([]); mocks.seasons.mockResolvedValue([]);
});
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren(); });
async function events(s = scope) { await act(async () => root.render(<MemoryRouter><DashboardEvents scope={s} /></MemoryRouter>)); }
it('shows overlapping club/shared and selected team events once while excluding other scope', async () => {
  const event = { id: 'shared', org_id: 'club', team_ids: [], date: '2026-11-16', end_date: '2026-11-18', title: 'Club camp' };
  mocks.events.mockResolvedValue([event, event, { ...event, id: 'a', team_ids: ['a'], title: 'Team meeting' }, { ...event, id: 'b', team_ids: ['b'], title: 'Other team' }, { ...event, id: 'c', org_id: 'elsewhere', title: 'Other club' }, { ...event, id: 'd', date: '2026-11-19', title: 'Tomorrow' }]);
  await events();
  expect(document.body.textContent).toContain('Team meeting');
  expect(document.body.textContent?.match(/Club camp/g)).toHaveLength(1);
  expect(document.body.textContent).not.toMatch(/Other team|Other club|Tomorrow/);
  expect(document.querySelector('a')?.getAttribute('href')).toBe('/team-management/schedule?date=2026-11-17');
});
it('skips club event reads for standalone teams', async () => { await events({ ...scope, orgId: null as unknown as string }); expect(mocks.events).not.toHaveBeenCalled(); });
it('retries event failures without treating them as empty', async () => {
  mocks.events.mockRejectedValueOnce(new Error('offline')); await events();
  expect(document.body.textContent).toContain('Unable to load events');
  expect(document.body.textContent).not.toContain('No events today');
  await act(async () => (document.querySelector('button') as HTMLButtonElement).click());
  expect(document.body.textContent).toContain('No events today');
});
it('prevents a previous event scope response from replacing current events', async () => {
  let resolve!: (value: unknown[]) => void;
  mocks.events.mockReturnValueOnce(new Promise(r => { resolve = r; })); await events();
  await events({ ...scope, orgId: 'new-club' });
  await act(async () => resolve([{ id: 'old', org_id: 'club', team_ids: [], date: scope.date, title: 'Old event' }]));
  expect(document.body.textContent).not.toContain('Old event');
});
it('shows active roster context only, not archived season or a training date filter', async () => {
  mocks.seasons.mockResolvedValue([{ id: 'old', team_id: 'a', status: 'archived', name: '2025/2026' }, { id: 'now', team_id: 'a', status: 'active', name: '2026/2027' }]);
  await act(async () => root.render(<MemoryRouter><DashboardSeason teamId="a" /></MemoryRouter>));
  expect(document.body.textContent).toContain('Roster season · 2026/2027');
  expect(document.body.textContent).not.toContain('2025/2026');
  expect(document.querySelector('a')?.getAttribute('href')).toBe('/team-management/seasons');
});
it('makes a season read failure retryable rather than reporting no season', async () => {
  mocks.seasons.mockRejectedValueOnce(new Error('offline'));
  await act(async () => root.render(<MemoryRouter><DashboardSeason teamId="a" /></MemoryRouter>));
  expect(document.body.textContent).toContain('Unable to load roster season');
  expect(document.body.textContent).not.toContain('No active roster season');
  await act(async () => (document.querySelector('button') as HTMLButtonElement).click());
  expect(document.body.textContent).toContain('No active roster season');
});
