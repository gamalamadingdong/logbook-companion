// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoachingSession } from '../../services/coaching/types';
const mocks = vi.hoisted(() => ({
  filter: null as string | null, sessions: vi.fn(), athletes: vi.fn(), assignments: vi.fn(), crews: vi.fn(),
  events: vi.fn(), orgTeams: vi.fn(), create: vi.fn(), boats: vi.fn(), boatings: vi.fn(), createBoat: vi.fn(), createCrew: vi.fn(), setFilter: vi.fn(),
}));
const teams = [
  { team_id: 'a', team_name: 'Alpha', org_id: 'club', role: 'coach' },
  { team_id: 'b', team_name: 'Beta', org_id: 'club', role: 'coxswain' },
  { team_id: 'other', team_name: 'Other club', org_id: 'other-club', role: 'coach' },
];
vi.mock('../../hooks/useCoachingContext', () => ({ useCoachingContext: () => ({ userId: 'user', teamId: 'a', orgId: 'club', teams, filterTeamId: mocks.filter, setFilterTeamId: mocks.setFilter, isLoadingTeam: false }) }));
vi.mock('../../components/coaching/CoachingNav', () => ({ CoachingNav: () => null }));
vi.mock('../../components/coaching/WeeklyFocusBanner', () => ({ WeeklyFocusBanner: () => <div>Weekly focus</div> }));
vi.mock('./CoachingBoatings', () => ({ LineupsWorkspace: () => null }));
vi.mock('../../services/coaching/coachingService', async original => ({ ...await original<object>(),
  getSessionsByDateRange: mocks.sessions, getAthletes: mocks.athletes, getGroupAssignments: mocks.assignments,
  getSessionCrewsForSessions: mocks.crews, getScheduleEvents: mocks.events, getTeamsForOrg: mocks.orgTeams,
  createSession: mocks.create, getNotesForSession: vi.fn().mockResolvedValue([]), getOrgBoats: mocks.boats,
  getOrgBoatings: mocks.boatings, createBoat: mocks.createBoat, createSessionCrew: mocks.createCrew,
}));
import CoachingSchedule from './CoachingSchedule';
let root: Root;
const button = (text: string) => [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === text)!;
const session = (id: string, team: string) => ({ id, team_id: team, date: '2026-11-17', type: 'water', focus: `${team} practice` } as CoachingSession);
async function render() { await act(async () => root.render(<MemoryRouter initialEntries={['/?date=2026-11-17&sessionId=b-session']}><CoachingSchedule /></MemoryRouter>)); }
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); mocks.filter = null;
  mocks.sessions.mockImplementation(async (team, from, to) => from <= '2026-11-17' && to >= '2026-11-17' ? [session(`${team}-session`, team)] : []);
  mocks.athletes.mockImplementation(async team => [{ id: `${team}-athlete`, team_id: team, name: `${team} athlete` }]);
  mocks.assignments.mockResolvedValue([
    { id: 'a-workout', team_id: 'a', org_id: 'club', title: 'Alpha workout' },
    { id: 'b-workout', team_id: 'b', org_id: 'club', title: 'Beta workout' },
    { id: 'hidden', team_id: 'hidden', org_id: 'club', title: 'Hidden workout' },
    { id: 'shared', team_id: null, org_id: 'club', title: 'Shared workout' },
    { id: 'other', team_id: null, org_id: 'other-club', title: 'Other club workout' },
  ]);
  mocks.crews.mockResolvedValue([]); mocks.events.mockResolvedValue([]);
  mocks.orgTeams.mockResolvedValue([{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }, { id: 'hidden', name: 'Hidden' }]);
  mocks.boats.mockResolvedValue([]); mocks.boatings.mockResolvedValue([]); mocks.createBoat.mockResolvedValue({ id: 'boat' }); mocks.createCrew.mockResolvedValue({});
  mocks.create.mockResolvedValue({});
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren(); });
describe('schedule scope', () => {
  it('aggregates accessible club teams and crews, filters broad assignment results and requires a creation destination', async () => {
    await render();
    expect(document.body.textContent).toContain('a practice'); expect(document.body.textContent).toContain('b practice');
    expect(mocks.athletes.mock.calls.map(c => c[0]).sort()).toEqual(['a', 'b']);
    expect(mocks.crews).toHaveBeenCalledWith('b', ['b-session']);
    expect(document.body.textContent).not.toContain('Weekly focus');
    await act(async () => button('Add Session').click());
    const select = document.querySelector('#session-team') as HTMLSelectElement;
    expect(select.value).toBe(''); expect(select.textContent).not.toContain('Hidden');
    const assignments = document.querySelector('#session-assignment')!;
    expect(assignments.textContent).not.toContain('Hidden workout'); expect(assignments.textContent).not.toContain('Other club workout');
    await act(async () => document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(mocks.create).not.toHaveBeenCalled();
    await act(async () => { select.value = 'b'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(document.querySelector('#session-assignment')!.textContent).toContain('Beta workout');
    expect(document.querySelector('#session-assignment')!.textContent).not.toContain('Alpha workout');
    await act(async () => document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(mocks.create).toHaveBeenCalledWith('b', 'user', expect.objectContaining({ date: '2026-11-17' }));
  });
  it('keeps selected team exact while retaining shared club workouts', async () => {
    mocks.filter = 'b'; await render();
    expect(document.body.textContent).not.toContain('a practice'); expect(document.body.textContent).toContain('b practice');
    expect(mocks.athletes).toHaveBeenCalledWith('b'); expect(mocks.athletes).not.toHaveBeenCalledWith('a');
    await act(async () => button('Add Session').click());
    expect((document.querySelector('#session-team') as HTMLSelectElement).value).toBe('b');
    expect(document.querySelector('#session-assignment')!.textContent).toContain('Shared workout');
    expect(document.querySelector('#session-assignment')!.textContent).not.toContain('Alpha workout');
  });
  it('uses the session team roster and destination when a coxswain saves a crew in All Teams', async () => {
    await render();
    await act(async () => button('Add crew snapshot').click());
    const seats = document.querySelector('#session-seat-8') as HTMLSelectElement;
    expect(seats.textContent).toContain('b athlete'); expect(seats.textContent).not.toContain('a athlete');
    const name = document.querySelector('#session-boat-name') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, 'Beta shell');
      name.dispatchEvent(new Event('input', { bubbles: true }));
      seats.value = 'b-athlete'; seats.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(mocks.createBoat).toHaveBeenCalledWith('b', 'user', expect.objectContaining({ boat_name: 'Beta shell' }));
    expect(mocks.createCrew).toHaveBeenCalledWith('b', 'user', expect.objectContaining({ session_id: 'b-session', positions: [expect.objectContaining({ athlete_id: 'b-athlete' })] }));
  });
  it('selects the actual session team before opening standing lineups', async () => {
    await render();
    const lineups = [...document.querySelectorAll('button')].filter(b => b.textContent?.trim() === 'Lineups');
    await act(async () => lineups.at(-1)!.click());
    expect(mocks.setFilter).toHaveBeenCalledWith('b');
  });
  it('ignores a late old-scope response after selecting another team', async () => {
    mocks.filter = 'a'; let resolve!: (value: CoachingSession[]) => void;
    mocks.sessions.mockImplementation((team, from, to) => team === 'a' && from <= '2026-11-17' && to >= '2026-11-17'
      ? new Promise<CoachingSession[]>(r => { resolve = r; }) : Promise.resolve(team === 'b' ? [session('b-session', 'b')] : []));
    await render(); mocks.filter = 'b'; await render();
    expect(document.body.textContent).toContain('b practice');
    await act(async () => resolve([session('a-session', 'a')]));
    expect(document.body.textContent).not.toContain('a practice'); expect(document.body.textContent).toContain('b practice');
  });
});
