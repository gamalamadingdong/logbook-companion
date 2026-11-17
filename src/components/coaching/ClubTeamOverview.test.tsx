// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoachingSession, UserTeamInfo } from '../../services/coaching/types';
import type { DashboardScope, getDashboardWorkouts } from '../../services/coaching/teamDashboardService';
const mocks = vi.hoisted(() => ({ roster: vi.fn() }));
vi.mock('../../services/coaching/teamDashboardService', () => ({ getDashboardRoster: mocks.roster }));
import { ClubTeamOverview } from './ClubTeamOverview';

const date = '2026-11-17';
const team = (id: string, role: UserTeamInfo['role'] = 'coach', org = 'club'): UserTeamInfo => ({ team_id: id, team_name: `Team ${id}`, role, org_id: org });
const teams = [team('a'), team('b', 'coxswain'), team('member', 'member'), team('outside', 'coach', 'other'), team('hidden')];
const scope: DashboardScope = { teamIds: ['a', 'b', 'member', 'outside'], orgId: 'club', date };
const practice = (id: string, teamId: string, practiceDate = date): CoachingSession => ({ id, team_id: teamId, date: practiceDate, type: 'water', coach_user_id: 'coach', created_at: '', updated_at: '' });
const workout = (id: string, teamId: string | null, workoutDate = date): Awaited<ReturnType<typeof getDashboardWorkouts>>[number] => ({ assignment: { id, team_id: teamId, org_id: 'club', title: id, template_id: 'template', scheduled_date: workoutDate, created_at: '' }, total: 4, completed: 2 });
let root: Root;
const open = vi.fn();
const defaults = { teams, scope, practices: [practice('p-a', 'a'), practice('p-b', 'b'), practice('old', 'a', '2026-11-16')], workouts: [workout('shared', null), workout('a-workout', 'a'), workout('b-workout', 'b'), workout('old', 'a', '2026-11-16')], onOpenTeam: open };
async function render(props: Partial<Parameters<typeof ClubTeamOverview>[0]> = {}) {
  await act(async () => root.render(<ClubTeamOverview {...defaults} {...props} />));
}
const row = (name: string) => [...document.querySelectorAll('li')].find(element => element.textContent?.includes(name))!;
const text = (name: string) => row(name).textContent;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks(); mocks.roster.mockResolvedValue([{ id: 'athlete' }]);
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren(); });

describe('club team overview', () => {
  it('lists only accessible current-club staff teams and reads each exact active roster', async () => {
    await render();
    expect(document.querySelectorAll('li')).toHaveLength(2);
    for (const excluded of ['member', 'outside', 'hidden']) expect(document.body.textContent).not.toContain(`Team ${excluded}`);
    expect(mocks.roster).toHaveBeenCalledTimes(2);
    expect(mocks.roster).toHaveBeenCalledWith({ ...scope, teamIds: ['a'] });
    expect(mocks.roster).toHaveBeenCalledWith({ ...scope, teamIds: ['b'] });
    expect(text('Team a')).toContain('Active roster1');
  });
  it('counts actual-team practices and workouts once, excluding shared assignments and other dates', async () => {
    await render({ practices: [...defaults.practices, defaults.practices[0]], workouts: [...defaults.workouts, defaults.workouts[1]] });
    for (const name of ['Team a', 'Team b']) {
      expect(text(name)).toContain('Practices today1');
      expect(text(name)).toContain('Team workouts today1');
    }
    expect(document.body.textContent).not.toContain('shared');
    expect(document.body.textContent).not.toContain('%');
  });
  it('opens the exact team using an accessible action', async () => {
    await render();
    await act(async () => row('Team b').querySelector('button')!.click());
    expect(open).toHaveBeenCalledExactlyOnceWith('b');
    expect(row('Team b').querySelector('button')!.getAttribute('aria-label')).toBe('Open team Team b');
  });
  it('hides single-team and inaccessible scopes without querying rosters', async () => {
    await render({ scope: { ...scope, teamIds: ['a', 'member', 'outside'] } });
    expect(document.body.textContent).toBe('');
    expect(mocks.roster).not.toHaveBeenCalled();
    await render({ scope: { ...scope, teamIds: [] } });
    expect(document.body.textContent).toBe('');
  });
  it('shows unavailable source counts distinctly from loaded zeroes', async () => {
    await render({ practices: null, workouts: null });
    expect(text('Team a')).toContain('Practices todayUnavailable');
    expect(text('Team a')).toContain('Team workouts todayUnavailable');
    await render({ practices: [], workouts: [] });
    expect(text('Team a')).toContain('Practices today0');
    expect(text('Team a')).toContain('Team workouts today0');
  });
  it('keeps a failed roster unavailable and retries only that team', async () => {
    mocks.roster.mockImplementation(({ teamIds }: DashboardScope) => teamIds[0] === 'a' ? Promise.reject(new Error('offline')) : Promise.resolve([{ id: 'b' }, { id: 'b2' }]));
    await render();
    expect(text('Team a')).toContain('Active rosterUnavailable');
    expect(text('Team b')).toContain('Active roster2');
    mocks.roster.mockResolvedValueOnce([{ id: 'a' }, { id: 'a2' }, { id: 'a3' }]);
    await act(async () => [...row('Team a').querySelectorAll('button')].find(button => button.textContent?.includes('Retry'))!.click());
    expect(text('Team a')).toContain('Active roster3');
    expect(mocks.roster).toHaveBeenCalledTimes(3);
    expect(mocks.roster).toHaveBeenLastCalledWith({ ...scope, teamIds: ['a'] });
  });
  it('isolates roster reads when switching clubs and team sets', async () => {
    let resolveOld!: (rows: { id: string }[]) => void;
    mocks.roster.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    await render();
    mocks.roster.mockResolvedValue([{ id: 'current1' }, { id: 'current2' }]);
    await render({ teams: [team('c', 'coach', 'new-club'), team('d', 'coxswain', 'new-club')], scope: { teamIds: ['c', 'd'], orgId: 'new-club', date } });
    expect(document.body.textContent).not.toContain('Team a');
    expect(text('Team c')).toContain('Active roster2');
    expect(mocks.roster).toHaveBeenLastCalledWith({ teamIds: ['d'], orgId: 'new-club', date });
    await act(async () => resolveOld([{ id: 'old' }]));
    expect(text('Team c')).toContain('Active roster2');
    expect(text('Team d')).toContain('Active roster2');
  });
  it('discards pending reads after scope/date changes, including a late rejection', async () => {
    let resolveOld!: (rows: { id: string }[]) => void;
    let rejectOld!: (error: Error) => void;
    mocks.roster.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectOld = reject; }));
    await render();
    expect(text('Team a')).toContain('Loading');
    mocks.roster.mockResolvedValue([{ id: 'new1' }, { id: 'new2' }]);
    await render({ scope: { ...scope, date: '2026-11-18' } });
    expect(text('Team a')).toContain('Active roster2');
    await act(async () => { resolveOld([{ id: 'old' }]); rejectOld(new Error('old failure')); });
    expect(text('Team a')).toContain('Active roster2');
    expect(text('Team b')).toContain('Active roster2');
    expect(document.body.textContent).not.toContain('Retry');
  });
});
