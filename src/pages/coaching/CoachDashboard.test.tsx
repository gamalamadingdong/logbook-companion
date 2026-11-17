// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  filter: 'a' as string | null, hasTeam: true, groups: [], teams: [
    { team_id: 'a', team_name: 'Juniors', org_id: 'club', org_name: 'Titan' },
    { team_id: 'b', team_name: 'Masters', org_id: 'club', org_name: 'Titan' },
  ], getAssignments: vi.fn(), getCompletions: vi.fn(),
  getAthletes: vi.fn(), getStats: vi.fn(), getLeaderboard: vi.fn(),
}));
vi.mock('../../hooks/useCoachingContext', () => ({ useCoachingContext: () => ({
  hasTeam: mocks.hasTeam, isLoadingTeam: false, teamId: 'a', teamName: 'Juniors', orgId: 'club', userId: 'coach',
  filterTeamId: mocks.filter, teamsByOrg: mocks.groups, teams: mocks.teams,
}) }));
vi.mock('../../components/coaching/CoachingNav', () => ({ CoachingNav: () => <nav>Scope controls</nav> }));
vi.mock('../../components/coaching/WeeklyFocusCard', () => ({ WeeklyFocusCard: ({ teamId }: { teamId: string }) => <div data-focus={teamId}>Weekly focus</div> }));
vi.mock('../../components/coaching/PendingCoachingRequests', () => ({ PendingCoachingRequests: () => <div>Pending requests</div> }));
vi.mock('../../services/coaching/coachingService', () => ({
  getAssignmentsForDate: mocks.getAssignments, getAssignmentCompletions: mocks.getCompletions,
  getAthletes: mocks.getAthletes, getTeamStats: mocks.getStats, getSeasonMeasuredLeaderboard: mocks.getLeaderboard,
}));
import { CoachDashboard } from './CoachDashboard';
let root: Root;
async function render() { await act(async () => root.render(<MemoryRouter><Routes><Route path="/" element={<CoachDashboard />} /><Route path="/team-management/setup" element={<div>Setup destination</div>} /></Routes></MemoryRouter>)); }
const workout = { id: 'workout', title: 'Shared workout', template_id: 'template' };
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.resetAllMocks(); mocks.filter = 'a'; mocks.hasTeam = true;
  mocks.getAssignments.mockResolvedValue([workout]);
  mocks.getCompletions.mockResolvedValue([{ group_assignment_id: 'workout', completed: 2, total: 3, missing_athletes: [] }]);
  mocks.getAthletes.mockImplementation(async (id: string) => [{ id: 'shared' }, { id: id + '-athlete' }]);
  mocks.getStats.mockResolvedValue({ athleteCount: 2, squadCount: 1, sessionsThisWeek: 2, weeklyCompletionRate: 80 });
  mocks.getLeaderboard.mockResolvedValue([{ athlete_id: 'a', athlete_name: 'Alice', titan_index: 102 }]);
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren(); });
describe('focused coaching dashboard', () => {
  it('shows one overview and routes management to dedicated pages', async () => {
    await render();
    expect(document.querySelectorAll('h3').length).toBeGreaterThan(0);
    expect(document.body.textContent?.match(/Today's Workouts/g)).toHaveLength(1);
    expect(document.querySelector('[data-focus]')?.getAttribute('data-focus')).toBe('a');
    expect(document.body.textContent).toContain('Alice');
    expect(document.querySelector('a[href="/team-management/roster"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain('Titan Roster');
    expect(document.body.textContent).not.toContain('Quick View');
    expect(document.body.textContent).not.toContain('Titan Overview');
    expect(document.body.textContent).not.toContain('Hierarchy');
    expect(document.querySelector('input')).toBeNull();
    expect(document.body.textContent).toContain('Pending requests');
  });
  it('aggregates club counts without combining team percentages, ranks or shared assignments', async () => {
    mocks.filter = null; await render();
    expect(document.querySelector('[data-focus]')).toBeNull();
    expect(mocks.getLeaderboard).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('80%');
    expect(document.querySelector('[data-stat="Athletes"]')?.textContent).toContain('3');
    expect(document.querySelector('[data-stat="Teams"]')?.textContent).toContain('2');
    expect(document.body.textContent?.match(/Shared workout/g)).toHaveLength(1);
    expect(document.body.textContent).toContain('2/3 complete');
    expect(document.body.textContent).not.toContain('Season Leaderboard');
  });
  it('discards late loads from the previous scope', async () => {
    let resolve!: (value: typeof workout[]) => void;
    mocks.getAssignments.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    await render(); mocks.filter = 'b'; await render();
    await act(async () => resolve([{ ...workout, title: 'Old team workout' }]));
    expect(document.body.textContent).not.toContain('Old team workout');
    expect(document.querySelector('[data-focus]')?.getAttribute('data-focus')).toBe('b');
  });
  it('shows an actionable error instead of false empty data and can retry', async () => {
    mocks.getStats.mockRejectedValueOnce(new Error('unavailable')); await render();
    expect(document.body.textContent).toContain('Unable to load this overview');
    expect(document.body.textContent).not.toContain('No workouts scheduled');
    expect(document.querySelector('[data-stat]')).toBeNull();
    await act(async () => Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Retry')!.click());
    expect(document.body.textContent).toContain('Shared workout');
    expect(document.body.textContent).not.toContain('Unable to load');
  });
  it('does not mark a workout without assigned athletes complete', async () => {
    mocks.getCompletions.mockResolvedValue([{ group_assignment_id: 'workout', completed: 0, total: 0, missing_athletes: [] }]);
    await render();
    expect(document.body.textContent).toContain('No athletes assigned');
    expect(document.body.textContent).not.toContain('All done');
  });
  it('does not let a late failure replace the next scope with an error', async () => {
    let reject!: (reason: Error) => void;
    mocks.getStats.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    await render(); mocks.filter = 'b'; await render();
    await act(async () => reject(new Error('old team unavailable')));
    expect(document.body.textContent).not.toContain('Unable to load');
    expect(document.body.textContent).toContain('Shared workout');
  });
  it('preserves the setup redirect when there is no team', async () => {
    mocks.hasTeam = false; await render(); expect(document.body.textContent).toContain('Setup destination');
    expect(mocks.getAssignments).not.toHaveBeenCalled();
  });
});
