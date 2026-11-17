// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  filter: 'a' as string | null, hasTeam: true, role: 'coach', admin: false, memberTeam: false, switchTeam: vi.fn(), teams: [
    { team_id: 'a', team_name: 'Juniors', org_id: 'club', org_name: 'Titan' },
    { team_id: 'b', team_name: 'Masters', org_id: 'club', org_name: 'Titan' },
  ], workouts: vi.fn(), practices: vi.fn(), roster: vi.fn(),
}));
vi.mock('../../hooks/useCoachingContext', () => ({ useCoachingContext: () => ({
  hasTeam: mocks.hasTeam, isLoadingTeam: false, teamId: 'a', teamName: 'Juniors', orgId: 'club', userId: 'coach',
  filterTeamId: mocks.filter, teamsByOrg: [], teams: [...mocks.teams.map(t => ({ ...t, role: mocks.role, org_role: mocks.admin ? 'admin' : 'coach' })), ...(mocks.memberTeam ? [{ team_id: 'read-only', team_name: 'Athlete team', org_id: 'club', org_name: 'Titan', role: 'member', org_role: 'member' }] : [])], switchTeam: mocks.switchTeam,
}) }));
vi.mock('../../components/coaching/CoachingNav', () => ({ CoachingNav: () => <nav>Scope controls</nav> }));
vi.mock('../../components/coaching/WeeklyFocusSummary', () => ({ WeeklyFocusSummary: ({ teamId }: { teamId: string }) => <div data-focus={teamId}>Weekly focus</div> }));
vi.mock('../../components/coaching/ClubTeamOverview', () => ({ ClubTeamOverview: ({ onOpenTeam }: { onOpenTeam: (id: string) => void }) => <button onClick={() => onOpenTeam('b')}>Open Masters team</button> }));
vi.mock('../../components/coaching/DashboardContext', () => ({ DashboardEvents: () => <div>Events today</div>, DashboardSeason: ({ teamId }: { teamId: string }) => <div data-season={teamId}>Roster season</div> }));
vi.mock('../../components/coaching/PendingCoachingRequests', () => ({ PendingCoachingRequests: () => <div>Pending requests</div> }));
vi.mock('../../services/coaching/teamDashboardService', () => ({
  getDashboardWorkouts: mocks.workouts, getDashboardPractices: mocks.practices, getDashboardRoster: mocks.roster,
}));
import { CoachDashboard } from './CoachDashboard';
let root: Root;
async function render() { await act(async () => root.render(<MemoryRouter><Routes><Route path="/" element={<CoachDashboard />} /><Route path="/team-management/setup" element={<div>Setup destination</div>} /><Route path="/team-management/schedule" element={<div>Practice destination</div>} /></Routes></MemoryRouter>)); }
const workout = { assignment: { id: 'workout', title: 'Shared workout', org_id: 'club', template_id: 'template' }, completed: 2, total: 3 };
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.resetAllMocks(); mocks.filter = 'a'; mocks.hasTeam = true; mocks.role = 'coach'; mocks.admin = false; mocks.memberTeam = false;
  mocks.workouts.mockResolvedValue([workout]);
  mocks.practices.mockResolvedValue([{ id: 'practice', team_id: 'a', date: '2026-11-17', type: 'water', focus: 'Starts and catches' }]);
  mocks.roster.mockResolvedValue([{ id: 'athlete' }, { id: 'other' }]);
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren(); });
const findButton = (text: string) => [...document.querySelectorAll('button')].find(b => b.textContent?.includes(text));
describe('today-first coaching dashboard', () => {
  it('leads with today and links each practice and workout to its exact destination', async () => {
    await render();
    expect(document.querySelector('h1')?.textContent).toBe('Today');
    expect(document.body.textContent).toContain('Starts and catches');
    expect(document.querySelector('a[href="/team-management/schedule?date=2026-11-17&sessionId=practice"]')).not.toBeNull();
    expect(document.querySelector('a[href="/team-management/assignments/workout/results"]')).not.toBeNull();
    expect(document.body.textContent).toContain('2/3 recorded complete');
    expect(document.body.textContent).toContain('1 not recorded complete');
    expect(document.body.textContent).toContain('Shared club workout');
    expect(document.body.textContent).toContain('Completion for the selected roster');
    expect(document.body.textContent).not.toContain('Season Leaderboard');
    expect(document.body.textContent).not.toContain('Pending requests');
    expect(document.querySelector('[data-focus]')?.getAttribute('data-focus')).toBe('a');
    expect(document.body.textContent!.indexOf('Practices')).toBeLessThan(document.body.textContent!.indexOf('Weekly focus'));
  });
  it('uses all accessible club teams for all-team reads without a misleading team focus', async () => {
    mocks.filter = null; await render();
    expect(mocks.workouts).toHaveBeenCalledWith(expect.objectContaining({ teamIds: ['a', 'b'], orgId: 'club' }));
    expect(mocks.practices).toHaveBeenCalledWith(expect.objectContaining({ teamIds: ['a', 'b'] }));
    expect(document.querySelector('[data-focus]')).toBeNull();
    expect(document.querySelector('[data-season]')).toBeNull();
    await act(async () => findButton('Open Masters team')!.click());
    expect(mocks.switchTeam).toHaveBeenCalledWith('b');
  });
  it('labels a club-associated team workout with its actual team', async () => {
    mocks.workouts.mockResolvedValue([{ ...workout, assignment: { ...workout.assignment, team_id: 'a' } }]);
    await render();
    const item = document.querySelector('a[href="/team-management/assignments/workout/results"]')?.closest('li');
    expect(item?.textContent).toContain('Juniors');
  });
  it('restricts a selected-team read to that team', async () => {
    mocks.filter = 'b'; await render();
    expect(mocks.workouts).toHaveBeenCalledWith(expect.objectContaining({ teamIds: ['b'] }));
    expect(document.querySelector('[data-focus]')?.getAttribute('data-focus')).toBe('b');
  });
  it('changes context to the actual practice team before opening from All Teams', async () => {
    mocks.filter = null;
    mocks.practices.mockResolvedValue([{ id: 'practice', team_id: 'b', date: '2026-11-17', type: 'erg', focus: 'Winter erg' }]);
    await render();
    await act(async () => (document.querySelector('a[href*="sessionId=practice"]') as HTMLAnchorElement).click());
    expect(mocks.switchTeam).toHaveBeenCalledWith('b');
    expect(document.body.textContent).toContain('Practice destination');
  });
  it('keeps practices and roster visible when workouts fail and retries only workouts', async () => {
    mocks.workouts.mockRejectedValueOnce(new Error('offline')); await render();
    expect(document.body.textContent).toContain('Unable to load workouts');
    expect(document.body.textContent).toContain('Starts and catches');
    expect(document.querySelector('a[href="/team-management/roster"]')?.textContent).toContain('2 athletes');
    await act(async () => findButton('Retry workouts')!.click());
    expect(document.body.textContent).toContain('Shared workout');
    expect(mocks.practices).toHaveBeenCalledTimes(1);
    expect(mocks.roster).toHaveBeenCalledTimes(1);
  });
  it('keeps workouts visible when practices fail and offers a section retry', async () => {
    mocks.practices.mockRejectedValueOnce(new Error('offline')); await render();
    expect(document.body.textContent).toContain('Unable to load practices');
    expect(document.body.textContent).toContain('Shared workout');
    await act(async () => findButton('Retry practices')!.click());
    expect(document.body.textContent).toContain('Starts and catches');
    expect(mocks.workouts).toHaveBeenCalledTimes(1);
  });
  it('never turns an unavailable roster into a zero count', async () => {
    mocks.roster.mockRejectedValueOnce(new Error('offline')); await render();
    expect(document.body.textContent).toContain('Unable to load roster');
    expect(document.body.textContent).not.toContain('0 athletes');
    expect(document.body.textContent).toContain('Shared workout');
  });
  it('preserves zero-recipient semantics without claiming completion', async () => {
    mocks.workouts.mockResolvedValue([{ ...workout, completed: 0, total: 0 }]); await render();
    expect(document.body.textContent).toContain('No athletes assigned in this roster');
    expect(document.body.textContent).not.toContain('0/0');
    expect(document.body.textContent).not.toContain('All done');
  });
  it('has separate useful empty states for practices and workouts', async () => {
    mocks.workouts.mockResolvedValue([]); mocks.practices.mockResolvedValue([]); await render();
    expect(document.body.textContent).toContain('No practices today');
    expect(document.body.textContent).toContain('No workouts today');
    expect(document.querySelector('a[href="/team-management/schedule"]')).not.toBeNull();
    expect(document.querySelector('a[href="/team-management/assignments"]')).not.toBeNull();
  });
  it('discards late loads and failures from a previous scope', async () => {
    let resolve!: (value: typeof workout[]) => void;
    let reject!: (error: Error) => void;
    mocks.workouts.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    mocks.practices.mockImplementationOnce(() => new Promise((_, r) => { reject = r; }));
    await render(); mocks.filter = 'b'; await render();
    await act(async () => { resolve([{ ...workout, assignment: { ...workout.assignment, title: 'Old team workout' } }]); reject(new Error('old failure')); });
    expect(document.body.textContent).not.toContain('Old team workout');
    expect(document.body.textContent).not.toContain('Unable to load practices');
    expect(document.body.textContent).toContain('Shared workout');
  });
  it('keeps coxswain navigation operational without prescription or admin shortcuts', async () => {
    mocks.role = 'coxswain'; await render();
    expect(document.querySelector('a[href*="sessionId=practice"]')).not.toBeNull();
    expect(document.querySelector('a[href$="/workout/results"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain('Assign workout');
    expect(document.body.textContent).not.toContain('Delete');
  });
  it('keeps account administration off the daily overview even for admins', async () => {
    mocks.admin = true; await render();
    expect(document.body.textContent).not.toContain('Pending requests');
    expect(document.querySelector('details')).toBeNull();
    expect(document.querySelector('[data-season]')?.getAttribute('data-season')).toBe('a');
  });
  it('excludes ordinary athlete memberships from All Teams coaching reads', async () => {
    mocks.filter = null; mocks.memberTeam = true; await render();
    expect(mocks.workouts).toHaveBeenCalledWith(expect.objectContaining({ teamIds: ['a', 'b'] }));
  });
  it('explains an ordinary-member selection without loading staff dashboard data', async () => {
    mocks.filter = 'read-only'; mocks.memberTeam = true; await render();
    expect(document.body.textContent).toContain('Staff access required');
    expect(mocks.workouts).not.toHaveBeenCalled();
    expect(document.querySelector('[data-focus]')).toBeNull();
  });
  it('preserves the setup redirect when there is no team', async () => {
    mocks.hasTeam = false; await render(); expect(document.body.textContent).toContain('Setup destination');
    expect(mocks.workouts).not.toHaveBeenCalled();
  });
});
