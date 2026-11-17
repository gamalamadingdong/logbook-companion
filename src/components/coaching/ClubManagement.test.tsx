// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ list: vi.fn(), members: vi.fn(), create: vi.fn(), update: vi.fn(), canCreate: vi.fn(), people: vi.fn(), role: vi.fn() }));
vi.mock('../../services/coaching/coachingService', () => ({ getOrganizationsForUser: mocks.list, getOrganizationMembershipsForUser: mocks.members, canCreateCoachingSpace: mocks.canCreate, getOrganizationMembers: mocks.people, updateOrganizationMemberRole: mocks.role, createOrganization: mocks.create, updateOrganization: mocks.update }));
import { ClubManagement } from './ClubManagement';
let root: Root;
const changed = vi.fn();
const club = { id: 'club', name: 'Titan', description: 'Rowing' };
async function render(userId = 'coach') { await act(async () => root.render(<ClubManagement key={userId} userId={userId} onChanged={changed} />)); }
async function click(label: string) { const button = Array.from(document.querySelectorAll('button')).find(b => b.textContent === label)!; await act(async () => button.click()); }
async function name(value: string) { await act(async () => { const input = document.querySelector('#club-name')!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); }); }
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.resetAllMocks();
  mocks.canCreate.mockResolvedValue(true); mocks.people.mockResolvedValue([]); mocks.role.mockResolvedValue(undefined); mocks.list.mockResolvedValue([club]); mocks.members.mockResolvedValue([{ org_id: 'club', role: 'owner' }]);
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
