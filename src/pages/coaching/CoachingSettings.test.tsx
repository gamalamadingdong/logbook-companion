// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ filter: null as string | null, id: 'a', getTeam: vi.fn(), select: vi.fn(), admin: true as boolean | undefined, role: 'coach', members: vi.fn(), adminUpdate: vi.fn(), roleUpdate: vi.fn() }));
vi.mock('../../hooks/useCoachingContext', () => ({ useCoachingContext: () => ({
  userId: 'coach', teamId: mocks.id, filterTeamId: mocks.filter, orgId: 'club', isLoadingTeam: false,
  teams: [
    { team_id: 'a', team_name: 'Juniors', org_id: 'club', role: mocks.role, is_admin: mocks.admin },
    { team_id: 'b', team_name: 'Masters', org_id: 'club', role: mocks.role, is_admin: mocks.admin },
  ], refreshTeam: vi.fn(), setFilterTeamId: mocks.select,
}) }));
vi.mock('../../components/coaching/ClubManagement', () => ({ ClubManagement: () => <section>Clubs · Add club</section> }));
vi.mock('../../components/coaching/CoachingNav', () => ({ CoachingNav: () => <nav>Scope controls</nav> }));
vi.mock('../../components/team/TeamInfoEditorList', () => ({ TeamInfoEditorList: ({ teams }: { teams: { team_id: string }[] }) => <div data-testid="editable-teams">{teams.map(t => t.team_id).join(',')}</div> }));
vi.mock('../../services/coaching/coachingService', () => ({
  canCreateCoachingSpace: async () => true, updateTeamMemberAdmin: mocks.adminUpdate, updateTeamMemberRole: mocks.roleUpdate, getTeam: mocks.getTeam, getTeamMembers: mocks.members, getOrganizationsForUser: async () => [], getOrganizationMembershipsForUser: async () => [],
}));
import { CoachingSettings } from './CoachingSettings';
let root: Root;
async function render() { await act(async () => root.render(<MemoryRouter><CoachingSettings /></MemoryRouter>)); }
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks();
  mocks.id = 'a'; mocks.filter = null; mocks.admin = true; mocks.role = 'coach'; mocks.members.mockResolvedValue([]); mocks.adminUpdate.mockResolvedValue(undefined); mocks.roleUpdate.mockResolvedValue(undefined);
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
    expect(document.body.textContent).toContain('Clubs · Add club');
    expect(document.querySelector('a[href="/team-management/setup"]')?.textContent).toContain('Add team');
  });
  it('names and edits only the selected team, and discards old drafts on switching', async () => {
    mocks.filter = 'a'; await render();
    expect(document.body.textContent).toContain('Juniors');
    expect(document.querySelector('[data-testid="editable-teams"]')?.textContent).toBe('a');
    const email = document.querySelector('input[type="email"]') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(email, 'old@example.com');
      email.dispatchEvent(new Event('input', { bubbles: true }));
    });
    mocks.id = 'b'; mocks.filter = 'b'; await render();
    expect(document.body.textContent).toContain('Masters');
    expect(document.querySelector('[data-testid="editable-teams"]')?.textContent).toBe('b');
    expect((document.querySelector('input[type="email"]') as HTMLInputElement).value).toBe('');
  });
});

describe('settings administration', () => {
  it.each([['coach', false], ['coach', undefined], ['coxswain', false]])('keeps %s without admin access read-only (%s)', async (role, admin) => {
    mocks.role = role as string; mocks.admin = admin as boolean | undefined; mocks.filter = 'a';
    await render();
    expect(document.body.textContent).toContain('Team administration requires Admin access');
    expect(document.querySelector('input[type="email"]')).toBeNull();
    expect(document.querySelector('[data-testid="editable-teams"]')).toBeNull();
    expect(mocks.members).not.toHaveBeenCalled();
  });
  it('offers a simple Admin toggle only for coach memberships', async () => {
    mocks.filter = 'a'; mocks.members.mockResolvedValue([
      { id: 'staff', user_id: 'other', display_name: 'Assistant', role: 'coach', is_admin: false },
      { id: 'cox', user_id: 'cox', display_name: 'Cox', role: 'coxswain' },
    ]);
    await render();
    const toggle = document.querySelector('[aria-label="Admin access for Assistant"]') as HTMLButtonElement;
    expect(toggle).toBeTruthy();
    expect(document.querySelector('[aria-label="Admin access for Cox"]')).toBeNull();
    await act(async () => toggle.click());
    expect(mocks.adminUpdate).toHaveBeenCalledWith('staff', true);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });
});

it('keeps the previous Admin value when a permission change fails', async () => {
  mocks.filter = 'a'; mocks.members.mockResolvedValue([{ id: 'staff', user_id: 'other', display_name: 'Assistant', role: 'coach', is_admin: false }]);
  mocks.adminUpdate.mockRejectedValue(new Error('Permission denied'));
  await render(); const toggle = document.querySelector('[aria-label="Admin access for Assistant"]') as HTMLButtonElement;
  await act(async () => toggle.click());
  expect(toggle.getAttribute('aria-pressed')).toBe('false');
  expect(document.body.textContent).toContain('Permission denied');
});
it('removes settings immediately if Admin access is revoked', async () => {
  mocks.filter = 'a'; await render();
  expect(document.querySelector('input[type="email"]')).toBeTruthy();
  mocks.admin = false; await render();
  expect(document.querySelector('input[type="email"]')).toBeNull();
  expect(document.body.textContent).toContain('Team administration requires Admin access');
});

it('clears direct Admin after changing to a non-coach role, including if later restored to coach', async () => {
  mocks.filter = 'a'; mocks.members.mockResolvedValue([{ id: 'staff', user_id: 'other', display_name: 'Assistant', role: 'coach', is_admin: true }]);
  await render();
  const role = document.querySelector('[aria-label="Role for Assistant"]') as HTMLSelectElement;
  for (const value of ['coxswain', 'coach']) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(role, value);
      role.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  expect(document.querySelector('[aria-label="Admin access for Assistant"]')?.getAttribute('aria-pressed')).toBe('false');
});
it('shows inherited Admin for the team owner and protects their membership controls', async () => {
  mocks.filter = 'a'; mocks.getTeam.mockResolvedValue({ id: 'a', name: 'Juniors', coach_id: 'owner' });
  mocks.members.mockResolvedValue([{ id: 'owner-member', user_id: 'owner', display_name: 'Owner', role: 'coach', is_admin: false }]);
  await render();
  const toggle = document.querySelector('[aria-label="Admin access for Owner"]') as HTMLButtonElement;
  expect(toggle.getAttribute('aria-pressed')).toBe('true');
  expect(toggle.textContent).toContain('inherited');
  expect(toggle.disabled).toBe(true);
  expect(document.querySelector('[aria-label="Role for Owner"]')).toBeNull();
  expect(toggle.parentElement?.querySelector('[title="Remove from team"]')).toBeNull();
});
