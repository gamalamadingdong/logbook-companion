// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ context: { userId: 'user', teamId: 'team', orgId: 'club', filterTeamId: null as string | null, isLoadingTeam: false, teams: [{ team_id: 'team', role: 'coach' }] } }));
vi.mock('../../hooks/useCoachingContext', () => ({ useCoachingContext: () => mocks.context }));
vi.mock('../../components/coaching/CoachingNav', () => ({ CoachingNav: () => <nav>Scope</nav> }));
vi.mock('../../components/coaching/WeeklyFocusCard', () => ({ WeeklyFocusCard: ({teamId, userId, initialWeekStart}: { teamId: string; userId: string; initialWeekStart: string }) => <div>{teamId}:{userId}:Editor:{initialWeekStart}</div> }));
import { getWeekStart } from '../../services/coaching/coachingService';
import CoachingWeeklyFocus from './CoachingWeeklyFocus';
let root: Root;
async function render(query = "") { await act(async () => root.render(<MemoryRouter key={query} initialEntries={[`/team-management/weekly-focus${query}`]}><CoachingWeeklyFocus /></MemoryRouter>)); }
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); mocks.context.filterTeamId = null; mocks.context.teams[0].role = 'coach'; const host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren(); });
it('asks All Teams to select a team rather than editing an anchor', async () => { await render(); expect(document.body.textContent).toContain('Select a team'); expect(document.body.textContent).not.toContain('Editor'); });
it('opens selected staff team and denies member-only team', async () => { mocks.context.filterTeamId = 'team'; await render(); expect(document.body.textContent).toContain('team:user:Editor'); mocks.context.teams[0].role = 'member'; await render(); expect(document.body.textContent).not.toContain('Editor'); expect(document.body.textContent).toContain('Staff access required'); });

it('preserves valid queried weeks and falls back from invalid dates', async () => {
  mocks.context.filterTeamId = 'team';
  await render('?week=2026-10-07'); expect(document.body.textContent).toContain('Editor:2026-10-05');
  await render('?week=2026-02-31'); expect(document.body.textContent).toContain(`Editor:${getWeekStart()}`);
  await render('?week=malformed'); expect(document.body.textContent).toContain(`Editor:${getWeekStart()}`);
});
