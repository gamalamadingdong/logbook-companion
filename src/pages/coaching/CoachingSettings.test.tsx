// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ filter: null as string | null, id: 'a', getTeam: vi.fn(), select: vi.fn() }));
vi.mock('../../hooks/useCoachingContext', () => ({ useCoachingContext: () => ({
  userId: 'coach', teamId: mocks.id, filterTeamId: mocks.filter, orgId: 'club', isLoadingTeam: false,
  teams: [
    { team_id: 'a', team_name: 'Juniors', org_id: 'club', role: 'coach' },
    { team_id: 'b', team_name: 'Masters', org_id: 'club', role: 'coach' },
  ], refreshTeam: vi.fn(), setFilterTeamId: mocks.select,
}) }));
vi.mock('../../components/coaching/CoachingNav', () => ({ CoachingNav: () => <nav>Scope controls</nav> }));
vi.mock('../../components/team/TeamInfoEditorList', () => ({ TeamInfoEditorList: ({ teams }: { teams: { team_id: string }[] }) => <div data-testid="editable-teams">{teams.map(t => t.team_id).join(',')}</div> }));
vi.mock('../../services/coaching/coachingService', () => ({
  getTeam: mocks.getTeam, getTeamMembers: async () => [], getOrganizationsForUser: async () => [],
}));
import { CoachingSettings } from './CoachingSettings';
let root: Root;
async function render() { await act(async () => root.render(<MemoryRouter><CoachingSettings /></MemoryRouter>)); }
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks();
  mocks.id = 'a'; mocks.filter = null;
  mocks.getTeam.mockImplementation(async (id: string) => ({ id, name: id === 'a' ? 'Juniors' : 'Masters', org_id: 'club' }));
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren(); });
describe('settings destination isolation', () => {
  it('does not load or edit a hidden anchor team in All Teams', async () => {
    await render();
    expect(document.body.textContent).toContain('Select a team');
    expect(mocks.getTeam).not.toHaveBeenCalled();
    expect(document.querySelector('[data-testid="editable-teams"]')).toBeNull();
  });
  it('names and edits only the selected team, and discards old drafts on switching', async () => {
    mocks.filter = 'a'; await render();
    expect(document.querySelector('h1')?.textContent).toContain('Juniors');
    expect(document.querySelector('[data-testid="editable-teams"]')?.textContent).toBe('a');
    const email = document.querySelector('input[type="email"]') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(email, 'old@example.com');
      email.dispatchEvent(new Event('input', { bubbles: true }));
    });
    mocks.id = 'b'; mocks.filter = 'b'; await render();
    expect(document.querySelector('h1')?.textContent).toContain('Masters');
    expect(document.querySelector('[data-testid="editable-teams"]')?.textContent).toBe('b');
    expect((document.querySelector('input[type="email"]') as HTMLInputElement).value).toBe('');
  });
});
