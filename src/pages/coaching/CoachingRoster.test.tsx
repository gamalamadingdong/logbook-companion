// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoachingAthlete } from '../../services/coaching/types';
const mocks = vi.hoisted(() => ({ team: 'a', roleA: 'coach', roleB: 'coach', filter: null as string | null, load: vi.fn(), create: vi.fn() }));
vi.mock('../../hooks/useCoachingContext', () => ({ useCoachingContext: () => ({
  userId: 'coach', teamId: mocks.team, orgId: 'club', filterTeamId: mocks.filter, filterTeamName: 'Juniors', isLoadingTeam: false,
  teams: [{ team_id: 'a', team_name: 'Juniors', org_id: 'club', org_name: 'River Club', role: mocks.roleA }, { team_id: 'b', team_name: 'Masters', org_id: 'club', org_name: 'River Club', role: mocks.roleB }],
}) }));
vi.mock('../../hooks/useMeasurementUnits', () => ({ useMeasurementUnits: () => 'metric' }));
vi.mock('../../hooks/useNotifications', () => ({ useNotifications: () => ({ addNotification: vi.fn() }) }));
vi.mock('../../components/coaching/CoachingNav', () => ({ CoachingNav: () => <nav>Scope</nav> }));
vi.mock('../../components/coaching/QuickScoreModal', () => ({ QuickScoreModal: ({ teamId }: { teamId: string }) => <div data-testid="score-team">{teamId}</div> }));
vi.mock('../../components/coaching/AthleteNotesDrawer', () => ({ AthleteNotesDrawer: ({ teamId, athlete }: { teamId: string; athlete: unknown }) => athlete ? <div data-testid="note-team">{teamId}</div> : null }));
vi.mock('../../services/coaching/coachingService', () => ({
  getAthletes: mocks.load, getOrgAthletesWithTeam: mocks.load, createAthlete: mocks.create,
  getErgScores: async () => [], getAssignmentCompletions: async () => [], getOrganizationsForUser: async () => [],
  getCoachNoteCountsByTeam: async () => ({}), getCoachNoteCountsByOrg: async () => ({}),
}));
import { CoachingRoster } from './CoachingRoster';
let root: Root;
const button = (text: string) => [...document.querySelectorAll('button')].find(b => b.textContent?.includes(text))!;
async function render() { await act(async () => root.render(<MemoryRouter><CoachingRoster /></MemoryRouter>)); }
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks();
  mocks.team = 'a'; mocks.roleA = 'coach'; mocks.roleB = 'coach'; mocks.filter = null; mocks.load.mockResolvedValue([]); mocks.create.mockResolvedValue({ id: 'new' });
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren(); });
describe('roster scope actions', () => {
  it('writes a single athlete to the explicitly chosen destination rather than the anchor', async () => {
    await render();
    await act(async () => button('Add Athlete').click());
    const select = document.querySelector('select#roster-destination') as HTMLSelectElement;
    expect(select).not.toBeNull();
    await act(async () => { select.value = 'b'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    await act(async () => button('Continue').click());
    await act(async () => {
      const input = document.querySelector('#ae-first-name') as HTMLInputElement;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Alex');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(mocks.create).toHaveBeenCalledWith('b', 'coach', expect.objectContaining({ first_name: 'Alex' }), null, null);
  });
  it('ignores an old roster response after switching teams', async () => {
    let resolveOld!: (rows: CoachingAthlete[]) => void;
    mocks.filter = 'a';
    mocks.load.mockReturnValueOnce(new Promise<CoachingAthlete[]>(resolve => { resolveOld = resolve; }));
    await render();
    mocks.team = 'b'; mocks.filter = 'b'; await render();
    await act(async () => resolveOld([{ id: 'old', first_name: 'OldScope', last_name: 'Athlete', name: 'OldScope Athlete', team_id: 'a' } as CoachingAthlete]));
    expect(document.body.textContent).not.toContain('OldScope');
  });
  it('uses the athlete row team for score and note actions in All Teams', async () => {
    mocks.load.mockResolvedValue([{ id: 'athlete-b', first_name: 'Alex', last_name: 'River', name: 'Alex River', team_id: 'b' }]);
    await render();
    await act(async () => (document.querySelector('button[aria-label="Add score"]') as HTMLButtonElement).click());
    expect(document.querySelector('[data-testid="score-team"]')?.textContent).toBe('b');
    await act(async () => (document.querySelector('button[aria-label="Add note for Alex River"]') as HTMLButtonElement).click());
    expect(document.querySelector('[data-testid="note-team"]')?.textContent).toBe('b');
  });
  it('offers transfer destinations relative to the athlete rather than the anchor', async () => {
    mocks.load.mockResolvedValue([{ id: 'athlete-b', first_name: 'Alex', last_name: 'River', name: 'Alex River', team_id: 'b' }]);
    await render();
    await act(async () => (document.querySelector('button[aria-label="Move to another team"]') as HTMLButtonElement).click());
    const dialog = document.querySelector('.max-w-sm')!;
    expect(dialog.textContent).toContain('Juniors');
    expect(dialog.textContent).not.toContain('Masters');
  });
  it('keeps score entry for a coxswain while hiding roster and private note operations', async () => {
    mocks.roleA = 'coxswain'; mocks.roleB = 'coxswain'; mocks.filter = 'a';
    mocks.load.mockResolvedValue([{ id: 'athlete-a', first_name: 'Alex', last_name: 'River', name: 'Alex River', team_id: 'a', user_id: null }]);
    await render();
    expect(button('Add Athlete')).toBeUndefined();
    expect(button('Bulk Add')).toBeUndefined();
    expect(button('Edit Mode')).toBeUndefined();
    expect(document.querySelector('button[aria-label="Delete athlete"]')).toBeNull();
    expect(document.querySelector('button[aria-label="Move to another team"]')).toBeNull();
    expect(document.querySelector('button[aria-label="Add note for Alex River"]')).toBeNull();
    await act(async () => (document.querySelector('button[aria-label="Add score"]') as HTMLButtonElement).click());
    expect(document.querySelector('[data-testid="score-team"]')?.textContent).toBe('a');
  });
  it('uses each row role in All Teams without granting the anchor coach role to another team', async () => {
    mocks.roleB = 'coxswain';
    mocks.load.mockResolvedValue([{ id: 'athlete-b', first_name: 'Alex', last_name: 'River', name: 'Alex River', team_id: 'b' }]);
    await render();
    expect(button('Add Athlete')).toBeDefined();
    expect(document.querySelector('button[aria-label="Delete athlete"]')).toBeNull();
    expect(document.querySelector('button[aria-label="Add note for Alex River"]')).toBeNull();
    await act(async () => button('Add Athlete').click());
    const destinations = [...document.querySelectorAll('select#roster-destination option')].map(o => (o as HTMLOptionElement).value);
    expect(destinations).toContain('a');
    expect(destinations).not.toContain('b');
  });

});
