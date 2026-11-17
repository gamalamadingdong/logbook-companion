// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ list: vi.fn(), members: vi.fn(), create: vi.fn(), update: vi.fn(), canCreate: vi.fn(), people: vi.fn(), role: vi.fn(), counts: vi.fn(), remove: vi.fn() }));
vi.mock('../../services/coaching/coachingService', () => ({ getClubDeletionCounts: mocks.counts, deleteOrganization: mocks.remove, getOrganizationsForUser: mocks.list, getOrganizationMembershipsForUser: mocks.members, canCreateCoachingSpace: mocks.canCreate, getOrganizationMembers: mocks.people, updateOrganizationMemberRole: mocks.role, createOrganization: mocks.create, updateOrganization: mocks.update }));
import type { UserTeamInfo } from '../../services/coaching/types';
import { ClubManagement } from './ClubManagement';
let root: Root;
const changed = vi.fn();
const manage = vi.fn();
let teams: UserTeamInfo[] = [];
const club = { id: 'club', name: 'Titan', description: 'Rowing' };
async function render(userId = 'coach') { await act(async () => root.render(<ClubManagement key={userId} userId={userId} onChanged={changed} teams={teams} onManageTeam={manage} />)); }
async function click(label: string) { const button = Array.from(document.querySelectorAll('button')).find(b => b.textContent === label)!; await act(async () => button.click()); }
async function name(value: string) { await act(async () => { const input = document.querySelector('#club-name')!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); }); }
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.resetAllMocks();
  teams = []; mocks.counts.mockResolvedValue({ teams: 0, schedule_events: 0, assignments: 0, training_enrollments: 0, leaderboard_shares: 0 }); mocks.remove.mockResolvedValue(undefined); mocks.canCreate.mockResolvedValue(true); mocks.people.mockResolvedValue([]); mocks.role.mockResolvedValue(undefined); mocks.list.mockResolvedValue([club]); mocks.members.mockResolvedValue([{ org_id: 'club', role: 'owner' }]);
  mocks.create.mockResolvedValue({ ...club, id: 'new', name: 'New club' }); changed.mockResolvedValue(undefined);
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren(); });
it('lists clubs without a selected team and limits edits to owners/admins', async () => {
  mocks.members.mockResolvedValue([{ org_id: 'club', role: 'coach' }]); await render();
  expect(document.body.textContent).toContain('Titan'); expect(document.body.textContent).toContain('Add club');
  expect(document.body.textContent).not.toContain('Edit club');
});
it('creates a club independently and does not repeat a successful save when refresh fails', async () => {
  changed.mockRejectedValue(new Error('offline')); await render(); await click('Add club'); await name('New club'); await click('Create club');
  expect(mocks.create).toHaveBeenCalledWith('coach', { name: 'New club', description: undefined });
  expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(document.body.textContent).toContain('Club saved');
  await click('Retry refresh'); expect(mocks.create).toHaveBeenCalledTimes(1);
});
it('retains edit drafts on failed saves', async () => {
  mocks.update.mockRejectedValue(new Error('Permission denied')); await render(); await click('Edit club'); await name('Titan Rowing'); await click('Save club');
  expect((document.querySelector('#club-name') as HTMLInputElement).value).toBe('Titan Rowing');
  expect(document.body.textContent).toContain('Permission denied');
});
it('discards late club loads after changing accounts', async () => {
  let resolve!: (clubs: unknown[]) => void;
  mocks.list.mockReturnValueOnce(new Promise(r => { resolve = r; })).mockResolvedValueOnce([]);
  await render(); await render('other'); await act(async () => resolve([club]));
  expect(document.body.textContent).not.toContain('Titan');
});
it('shows a retry when clubs fail to load', async () => {
  mocks.list.mockRejectedValueOnce(new Error('offline')); await render(); expect(document.body.textContent).toContain('Unable to load clubs');
  await click('Retry'); expect(document.body.textContent).toContain('Titan');
});

it('prevents creation while an older club snapshot is still loading', async () => {
  mocks.list.mockReturnValue(new Promise(() => {})); await render();
  const add = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Add club')!;
  expect(add?.disabled ?? true).toBe(true);
});

it('hides creation for an account without coaching creation permission', async () => {
  mocks.canCreate.mockResolvedValue(false); await render();
  expect([...document.querySelectorAll('button')].some(b => b.textContent === 'Add club')).toBe(false);
});
it('lets club owners grant Admin to existing club coaches', async () => {
  mocks.people.mockResolvedValue([
    { id: 'owner', user_id: 'coach', role: 'owner', display_name: 'Owner' },
    { id: 'assistant', user_id: 'assistant', role: 'coach', display_name: 'Assistant' },
  ]);
  await render(); await click('People & access');
  expect(document.querySelector('[aria-label="Club admin access for Owner"]')).toBeNull();
  const toggle = document.querySelector('[aria-label="Club admin access for Assistant"]') as HTMLButtonElement;
  expect(toggle).toBeTruthy(); await act(async () => toggle.click());
  expect(mocks.role).toHaveBeenCalledWith('assistant', 'admin');
  expect(toggle.getAttribute('aria-pressed')).toBe('true');
});

it('preserves club Admin state and shows an actionable failure when save fails', async () => {
  mocks.people.mockResolvedValue([{ id: 'assistant', user_id: 'assistant', role: 'admin', display_name: 'Assistant' }]);
  mocks.role.mockRejectedValue(new Error('denied'));
  await render(); await click('People & access');
  const toggle = document.querySelector('[aria-label="Club admin access for Assistant"]') as HTMLButtonElement;
  await act(async () => toggle.click());
  expect(mocks.role).toHaveBeenCalledWith('assistant', 'coach');
  expect(toggle.getAttribute('aria-pressed')).toBe('true');
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('Check your permissions');
});
it('never offers club people controls to ordinary club coaches', async () => {
  mocks.members.mockResolvedValue([{ org_id: 'club', role: 'coach' }]); await render();
  expect(document.querySelector('[aria-label="People & access for Titan"]')).toBeNull();
  expect(mocks.people).not.toHaveBeenCalled();
});

it('groups only accessible teams by club and standalone and offers exact admin destinations', async () => {
  teams = [
    { team_id: 'a', team_name: 'Juniors', org_id: 'club', org_name: 'Titan', role: 'coach', is_admin: true },
    { team_id: 'b', team_name: 'Masters', org_id: 'other', org_name: 'Other club', role: 'coxswain', is_admin: false },
    { team_id: 'c', team_name: 'Independent', role: 'coach', is_admin: true },
  ];
  await render();
  expect(document.body.textContent).toContain('Other club');
  expect(document.body.textContent).toContain('Masters');
  expect(document.body.textContent).toContain('Standalone teams');
  expect(document.querySelector('[aria-label="Manage team Masters"]')).toBeNull();
  await act(async () => (document.querySelector('[aria-label="Manage team Independent"]') as HTMLButtonElement).click());
  expect(manage).toHaveBeenCalledWith('c');
  expect(document.body.textContent).toContain('Admin access is required');
});
it('blocks deletion with every dependency count and does not offer deletion to ordinary club coaches', async () => {
  mocks.counts.mockResolvedValue({ teams: 2, schedule_events: 3, assignments: 4, training_enrollments: 5, leaderboard_shares: 6 });
  await render(); await click('Delete club');
  expect(mocks.counts).toHaveBeenCalledWith('club');
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Training enrollments: 5');
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Leaderboard shares: 6');
  expect(document.querySelector('[role="dialog"] button[type="submit"]')?.hasAttribute('disabled')).toBe(true);
  expect(mocks.remove).not.toHaveBeenCalled();
});
async function confirmDelete() {
  await act(async () => {
    const input = document.querySelector('#club-delete-confirm')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Titan');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const submit = document.querySelector('[role="dialog"] button[type="submit"]') as HTMLButtonElement;
  await act(async () => { submit.click(); submit.click(); });
}
it('fails closed on preview errors and allows retry before deletion', async () => {
  mocks.counts.mockRejectedValueOnce({ message: 'Preview unavailable' }); await render(); await click('Delete club');
  expect(document.body.textContent).toContain('Preview unavailable'); expect(mocks.remove).not.toHaveBeenCalled();
  await click('Retry preview'); await confirmDelete(); expect(mocks.remove).toHaveBeenCalledWith('club');
});
it('retains the confirmation and plain Supabase error after failed deletion', async () => {
  mocks.remove.mockRejectedValue({ message: 'Club changed. Teams remain.' }); await render(); await click('Delete club'); await confirmDelete();
  expect(document.querySelector('[role="dialog"]')).toBeTruthy();
  expect((document.querySelector('#club-delete-confirm') as HTMLInputElement).value).toBe('Titan');
  expect(document.body.textContent).toContain('Club changed. Teams remain.');
  expect(mocks.remove).toHaveBeenCalledTimes(1);
});
it('removes deleted club locally and retries only refresh when context refresh fails', async () => {
  changed.mockRejectedValue(new Error('offline')); await render(); await click('Delete club'); await confirmDelete();
  expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(document.body.textContent).not.toContain('Titan');
  expect(document.body.textContent).toContain('Club deleted'); await click('Retry refresh'); expect(mocks.remove).toHaveBeenCalledTimes(1);
});

it('refreshing a preview with the correct confirmation never submits deletion', async () => {
  await render(); await click('Delete club');
  await act(async () => {
    const input = document.querySelector('#club-delete-confirm')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Titan');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await click('Refresh preview'); expect(mocks.remove).not.toHaveBeenCalled();
  expect(mocks.counts).toHaveBeenCalledTimes(2);
});
