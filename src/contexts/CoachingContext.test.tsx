// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoachingContextType } from './coachingContextDef';
import type { UserTeamInfo } from '../services/coaching/types';

const mocks = vi.hoisted(() => ({ userId: 'coach', getTeams: vi.fn() }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.userId ? { id: mocks.userId } : null }) }));
vi.mock('../services/coaching/coachingService', () => ({
  getTeamsForUser: mocks.getTeams,
  getTeamStats: async () => ({ athleteCount: 1 }),
  getTeamAthleteCounts: async () => ({}),
}));
import { CoachingProvider } from './CoachingContext';
import { useScopedTeamScope } from '../hooks/useScopedTeamScope';
import { CoachingNav } from '../components/coaching/CoachingNav';

const teams: UserTeamInfo[] = [
  { team_id: 'a1', team_name: 'Juniors', org_id: 'a', org_name: 'River Club', role: 'coach' },
  { team_id: 'a2', team_name: 'Masters', org_id: 'a', org_name: 'River Club', role: 'coach' },
  { team_id: 'b1', team_name: 'Juniors', org_id: 'b', org_name: 'Lake Club', role: 'coach' },
  { team_id: 's1', team_name: 'Independent', role: 'coach' },
  { team_id: 's2', team_name: 'Another Independent', role: 'coach' },
];
let root: Root;
let ctx: CoachingContextType & { scopeLabel: string };
function Probe() {
  const value = useScopedTeamScope();
  useEffect(() => { ctx = value; }, [value]);
  return <CoachingNav />;
}
async function render() {
  await act(async () => root.render(<MemoryRouter><CoachingProvider><Probe /></CoachingProvider></MemoryRouter>));
}
async function select(label: string, value: string) {
  const el = document.querySelector(`select[aria-label="${label}"]`) as HTMLSelectElement;
  expect(el, `${label} selector`).not.toBeNull();
  await act(async () => { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
  vi.clearAllMocks(); mocks.userId = 'coach';
  mocks.getTeams.mockResolvedValue(teams);
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren(); });

describe('coach scope selection', () => {
  it('shows a single club and team as context text and exposes season management', async () => {
    mocks.getTeams.mockResolvedValue([teams[0]]);
    await render();
    expect(document.querySelector('select[aria-label="Club"]')).toBeNull();
    expect(document.querySelector('select[aria-label="Team"]')).toBeNull();
    expect(document.body.textContent).toContain('River Club');
    expect(document.body.textContent).toContain('Juniors');
    const tools = [...document.querySelectorAll('button')].find(button => button.textContent?.includes('Tools & administration'));
    expect(tools).toBeDefined();
    await act(async () => tools!.click());
    expect(document.querySelector('a[href="/team-management/seasons"]')).not.toBeNull();
    expect([...document.querySelectorAll('a')].find(a => a.textContent?.includes('Manage clubs & teams'))?.getAttribute('href'))
      .toBe('/team-management/settings');
  });
  it('can report refresh failure to a saved-write recovery flow', async () => {
    await render();
    mocks.getTeams.mockRejectedValue(new Error('offline'));
    await act(async () => { await expect(ctx.refreshTeam({ throwOnError: true })).rejects.toThrow('offline'); });
    expect(ctx.teamError).toBe('offline');
    expect(ctx.teamId).toBe('a1');
    await act(async () => { await expect(ctx.refreshTeam()).resolves.toBeUndefined(); });
  });
  it('keeps the selected roster and action team together, including after refresh', async () => {
    await render();
    await act(async () => ctx.setFilterTeamId('a2'));
    expect(ctx.teamId).toBe('a2');
    expect(ctx.filterTeamId).toBe('a2');
    expect(localStorage.getItem('lc_selected_team_coach')).toBe('a2');
    await act(async () => ctx.refreshTeam());
    expect(ctx.teamId).toBe('a2');
    expect(ctx.filterTeamId).toBe('a2');
  });
  it('opens dashboard team links as that team rather than All Teams', async () => {
    await render();
    await act(async () => ctx.switchTeam('a2'));
    expect(ctx.filterTeamId).toBe('a2');
  });
  it('shows labeled selectors and scopes club switching without carrying another club filter', async () => {
    await render();
    await select('Team', 'a2');
    expect(ctx.teamId).toBe('a2');
    await select('Club', 'b');
    expect(ctx.orgId).toBe('b');
    expect(ctx.teamId).toBe('b1');
    expect(ctx.filterTeamId).toBe('b1');
    await select('Club', 'a');
    expect(ctx.orgId).toBe('a');
    expect(ctx.filterTeamId).toBeNull();
    expect(ctx.scopeLabel).toContain('All Teams');
  });
  it('does not restore a saved filter from a different club', async () => {
    localStorage.setItem('lc_selected_team_coach', 'a1');
    localStorage.setItem('lc_filter_team_coach', 'b1');
    await render();
    expect(ctx.orgId).toBe('a');
    expect(ctx.filterTeamId).toBeNull();
    expect(localStorage.getItem('lc_filter_team_coach')).toBeNull();
    await act(async () => ctx.setFilterTeamId('b1'));
    expect(ctx.teamId).toBe('a1');
  });
  it('migrates a same-club legacy filter and persists an explicit All Teams choice', async () => {
    localStorage.setItem('lc_selected_team_coach', 'a1');
    localStorage.setItem('lc_filter_team_coach', 'a2');
    await render();
    expect(ctx.teamId).toBe('a2');
    expect(ctx.filterTeamId).toBe('a2');
    await select('Team', '__all__');
    await act(async () => ctx.refreshTeam());
    expect(ctx.teamId).toBe('a2');
    expect(ctx.filterTeamId).toBeNull();
  });
  it('can select either standalone team without an All Teams pseudo-roster', async () => {
    await render();
    await select('Club', '__standalone__');
    await select('Team', 's2');
    expect(ctx.teamId).toBe('s2');
    expect(ctx.scopeLabel).toBe('Another Independent');
    expect([...document.querySelectorAll('select[aria-label="Team"] option')].some(o => o.textContent === 'All Teams')).toBe(false);
  });
  it('clears previous account scope and ignores its late response', async () => {
    let resolveOld!: (value: UserTeamInfo[]) => void;
    mocks.getTeams.mockReturnValueOnce(new Promise<UserTeamInfo[]>(resolve => { resolveOld = resolve; }));
    await render();
    mocks.userId = 'other';
    mocks.getTeams.mockResolvedValue([teams[2]]);
    await render();
    expect(ctx.teamId).toBe('b1');
    await act(async () => resolveOld(teams));
    expect(ctx.teams).toEqual([teams[2]]);
    mocks.userId = '';
    await render();
    expect(ctx.teams).toEqual([]);
    expect(ctx.teamId).toBe('');
  });
});
