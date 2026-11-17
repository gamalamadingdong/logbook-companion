// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoachingAthlete, GroupAssignment } from '../../services/coaching/types';
const mocks = vi.hoisted(() => ({ role: 'coach', orgRole: null as string | null, rows: vi.fn(), save: vi.fn() }));
vi.mock('../../hooks/useCoachingContext', () => ({ useCoachingContext: () => ({ userId: 'user', teamId: 'team', teamName: 'Juniors', orgId: 'club', filterTeamId: 'team', isLoadingTeam: false, teams: [{ team_id: 'team', org_id: 'club', role: mocks.role, org_role: mocks.orgRole }] }) }));
vi.mock('../../hooks/useMeasurementUnits', () => ({ useMeasurementUnits: () => 'metric' }));
vi.mock('../../services/coaching/coachingService', async (original) => ({
  ...await original<object>(), getAthleteAssignmentRows: mocks.rows, saveAssignmentResults: mocks.save,
  getResultWeightColumnAvailability: () => true,
  getGroupAssignments: async () => [{ id: 'assignment', team_id: 'team', org_id: null, title: 'Steady', canonical_name: '2000m', scheduled_date: new Date().toLocaleDateString('en-CA') }],
  getAthletes: async () => athletes, getOrgAthletes: async () => athletes, getTeamSquads: async () => [], getComplianceData: async () => [],
}));
vi.mock('../../services/templateService', () => ({ fetchTemplates: async () => [] }));
vi.mock('../../components/coaching/CoachingNav', () => ({ CoachingNav: () => <nav>Team</nav> }));
import { ResultsEntryModal, CoachingAssignments } from './CoachingAssignments';
let root: Root;
const assignment = { id: 'assignment', team_id: 'team', org_id: null, title: 'Steady', canonical_name: '2000m', scheduled_date: '2026-11-16' } as GroupAssignment;
const athletes = [{ id: 'athlete', first_name: 'Alex', last_name: 'River', name: 'Alex River' }, { id: 'other', first_name: 'Sam', last_name: 'River', name: 'Sam River' }] as CoachingAthlete[];
async function render() {
  await act(async () => root.render(<MemoryRouter><ResultsEntryModal groupAssignmentId="assignment" assignment={assignment} athletes={athletes} teamId="team" userId="user" onClose={() => {}} onComplete={() => {}} /></MemoryRouter>));
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); mocks.role = 'coach'; mocks.orgRole = null;
  mocks.rows.mockResolvedValue([{ athlete_id: 'athlete', athlete_name: 'Alex River', completed: false, result_intervals: null }]);
  mocks.save.mockResolvedValue(undefined);
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren(); });
const button = (text: string) => [...document.querySelectorAll('button')].find(b => b.textContent?.includes(text));
describe('results entry permissions', () => {
  it('keeps completion and result saving available for a coxswain without recipient edits', async () => {
    mocks.role = 'coxswain'; await render();
    expect(button('Add athlete')).toBeUndefined();
    expect(button('Mark all complete')).toBeDefined();
    await act(async () => button('Mark all complete')!.click());
    await act(async () => button('Save')!.click());
    expect(mocks.save).toHaveBeenCalledWith('assignment', expect.arrayContaining([expect.objectContaining({ athlete_id: 'athlete', completed: true })]));
  });
  it('allows an assigned coach to add recipients', async () => {
    await render();
    expect(button('Add athlete')).toBeDefined();
    await act(async () => button('Add athlete')!.click());
    expect(button('Sam River')).toBeDefined();
  });
  it('hides prescription actions for coxswains while leaving result entry on the calendar', async () => {
    mocks.role = 'coxswain';
    await act(async () => root.render(<MemoryRouter><CoachingAssignments /></MemoryRouter>));
    expect(button('Assign Workout')).toBeUndefined();
    await act(async () => button('Calendar')!.click());
    expect(document.querySelector('button[aria-label="Edit assignment"]')).toBeNull();
    expect(document.querySelector('button[aria-label="Delete assignment"]')).toBeNull();
    expect(button('Enter Results')).toBeDefined();
  });
  it('retains coach prescription editing without a team admin flag', async () => {
    await act(async () => root.render(<MemoryRouter><CoachingAssignments /></MemoryRouter>));
    expect(button('Assign Workout')).toBeDefined();
    await act(async () => button('Calendar')!.click());
    expect(document.querySelector('button[aria-label="Edit assignment"]')).not.toBeNull();
    expect(document.querySelector('button[aria-label="Delete assignment"]')).not.toBeNull();
  });

});
