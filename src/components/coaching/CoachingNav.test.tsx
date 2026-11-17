// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CoachingContextType } from '../../contexts/coachingContextDef';
import type { UserTeamInfo } from '../../services/coaching/types';
const mocks = vi.hoisted(() => ({ context: {} as CoachingContextType, stats: vi.fn(), counts: vi.fn() }));
vi.mock('../../hooks/useCoachingContext', () => ({ useCoachingContext: () => mocks.context }));
vi.mock('../../services/coaching/coachingService', () => ({ getTeamStats: mocks.stats, getTeamAthleteCounts: mocks.counts }));
import { CoachingNav } from './CoachingNav';
let root: Root;
const team = (id: string, orgId = 'club-a'): UserTeamInfo => ({ team_id: id, team_name: `Team ${id}`, org_id: orgId, org_name: orgId, role: 'coach' } as UserTeamInfo);
const links = (selector = 'a') => Array.from(document.querySelectorAll<HTMLAnchorElement>(selector));
const link = (label: string) => links().find(item => item.textContent?.trim() === label)!;
async function render(path = '/team-management') {
  await act(async () => root.render(<MemoryRouter initialEntries={[path]}><CoachingNav /></MemoryRouter>));
}
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  const teams = [team('a1'), team('a2'), team('b1', 'club-b')];
  mocks.context = { teamId: 'a1', orgId: 'club-a', filterTeamId: null, teams,
    teamsByOrg: [{ org_id: 'club-a', org_name: 'Club A', teams: teams.slice(0, 2) }, { org_id: 'club-b', org_name: 'Club B', teams: teams.slice(2) }],
    isLoadingTeam: false, switchOrganization: vi.fn(), setFilterTeamId: vi.fn(),
  } as unknown as CoachingContextType;
});
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren(); });
it('presents five daily destinations as ordinary navigation links without roster reads', async () => {
  await render();
  const primary = document.querySelector('nav[aria-label="Coaching workspace"]')!;
  expect(Array.from(primary.querySelectorAll('a')).map(item => item.textContent?.trim())).toEqual(['Overview', 'Roster', 'Schedule', 'Workouts', 'Analytics']);
  expect(link('Workouts').getAttribute('href')).toBe('/team-management/assignments');
  expect(document.querySelector('[role="tablist"], [role="tab"]')).toBeNull();
  expect(primary.className).not.toContain('overflow-x-auto');
  expect(mocks.stats).not.toHaveBeenCalled(); expect(mocks.counts).not.toHaveBeenCalled();
});
it.each([
  ['/team-management', 'Overview'], ['/team-management/roster/athlete-a', 'Roster'],
  ['/team-management/schedule', 'Schedule'], ['/team-management/assignments/id/results', 'Workouts'],
  ['/team-management/analytics', 'Analytics'],
])('marks %s as the current %s destination', async (path, label) => {
  await render(path);
  expect(link(label).getAttribute('aria-current')).toBe('page');
  expect(links('nav[aria-label="Coaching workspace"] a[aria-current="page"]')).toHaveLength(1);
});
it.each([
  ['/team-management/weekly-focus', 'Weekly focus'], ['/team-management/live', 'Live'],
  ['/team-management/seasons', 'Seasons'], ['/team-management/administration', 'Administration'],
])('opens secondary destinations on direct URL %s', async (path, label) => {
  mocks.context.teams[2].org_role = 'admin';
  await render(path);
  const toggle = Array.from(document.querySelectorAll('button')).find(item => item.textContent?.includes('Tools & administration'))!;
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(link(label).getAttribute('aria-current')).toBe('page');
  expect(link(label).getAttribute('href')).toBe(path);
});
it('discloses tools on request and gates account administration by club role across effective teams', async () => {
  await render();
  expect(link('Weekly focus')).toBeUndefined(); expect(link('Administration')).toBeUndefined();
  await act(async () => Array.from(document.querySelectorAll('button')).find(item => item.textContent?.includes('Tools & administration'))!.click());
  expect(link('Weekly focus').getAttribute('href')).toBe('/team-management/weekly-focus');
  expect(link('Administration')).toBeUndefined();
  expect(link('Manage clubs & teams').getAttribute('href')).toBe('/team-management/settings');
});
it('preserves exact Club and Team selection and All Teams', async () => {
  await render();
  const club = document.querySelector<HTMLSelectElement>('select[aria-label="Club"]')!;
  const scope = document.querySelector<HTMLSelectElement>('select[aria-label="Team"]')!;
  expect(scope.value).toBe('__all__');
  await act(async () => { scope.value = 'a2'; scope.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(mocks.context.setFilterTeamId).toHaveBeenCalledWith('a2');
  await act(async () => { scope.value = '__all__'; scope.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(mocks.context.setFilterTeamId).toHaveBeenCalledWith(null);
  await act(async () => { club.value = 'club-b'; club.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(mocks.context.switchOrganization).toHaveBeenCalledWith('club-b');
});
it('keeps settings discoverable once and marks its management link active for read-only staff', async () => {
  await render('/team-management/settings');
  expect(link('Manage clubs & teams').getAttribute('aria-current')).toBe('page');
  expect(links('a[href="/team-management/settings"]')).toHaveLength(1);
});
it('allows closing tools after opening a direct secondary destination', async () => {
  await render('/team-management/weekly-focus');
  const toggle = Array.from(document.querySelectorAll('button')).find(item => item.textContent?.includes('Tools & administration'))!;
  await act(async () => toggle.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(link('Weekly focus')).toBeUndefined();
});
it('opens a directly loaded administration page when effective roles finish loading', async () => {
  await render('/team-management/administration');
  mocks.context.teams[2].org_role = 'owner';
  await render('/team-management/administration');
  expect(link('Administration')?.getAttribute('aria-current')).toBe('page');
});
