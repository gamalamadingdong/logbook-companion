// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserTeamInfo } from '../../services/coaching/types';
const mocks = vi.hoisted(() => ({ createAthlete: vi.fn(), save: vi.fn(), close: vi.fn(), saved: vi.fn() }));
vi.mock('../../services/coaching/coachingService', () => ({ createAthlete: mocks.createAthlete }));
import { RosterAddModal } from './RosterAddModal';
const teams: UserTeamInfo[] = [
  { team_id: 'a', team_name: 'Juniors', org_id: 'club', org_name: 'River Club', role: 'coach' },
  { team_id: 'b', team_name: 'Masters', org_id: 'club', org_name: 'River Club', role: 'coach' },
];
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks(); mocks.createAthlete.mockResolvedValue({ id: 'new' });
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren(); });
const button = (label: string) => [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === label)!;
async function render(mode: 'single' | 'bulk' = 'single', initialTeamId: string | null = null) {
  await act(async () => root.render(<RosterAddModal mode={mode} teams={teams} initialTeamId={initialTeamId}
    userId="coach" units="metric" squads={[]} onSave={mocks.save} onSaved={mocks.saved} onClose={mocks.close} />));
}
async function input(el: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function chooseTeam() {
  const el = document.querySelector('select')!;
  await act(async () => { el.value = 'b'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => button('Continue').click());
}
describe('roster add destinations', () => {
  it.each(['single', 'bulk'] as const)('requires an explicit All Teams destination for %s and cancels without writes', async mode => {
    await render(mode);
    expect(button('Continue').disabled).toBe(true);
    expect(document.querySelector('#ae-first-name')).toBeNull();
    await act(async () => button('Cancel').click());
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.createAthlete).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('names the selected team and binds a single add to it', async () => {
    await render(); await chooseTeam();
    expect(document.body.textContent).toContain('River Club · Masters');
    await input(document.querySelector('#ae-first-name')!, 'Alex');
    await act(async () => document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(mocks.save).toHaveBeenCalledWith('b', expect.objectContaining({ first_name: 'Alex' }));
  });
  it('binds real bulk creation to the chosen team', async () => {
    await render('bulk'); await chooseTeam();
    expect(document.body.textContent).toContain('River Club · Masters');
    const firstName = document.querySelector('input[placeholder="First name"]') as HTMLInputElement;
    await input(firstName, 'Alex');
    await act(async () => button('Save 1 athlete').click());
    expect(mocks.createAthlete).toHaveBeenCalledWith('b', 'coach', expect.objectContaining({ first_name: 'Alex' }), null, null);
    expect(mocks.saved).toHaveBeenCalledWith(1);
  });
  it('uses the explicit team immediately without an extra destination step', async () => {
    await render('single', 'b');
    expect(document.querySelector('#ae-first-name')).not.toBeNull();
    expect(document.body.textContent).toContain('River Club · Masters');
    expect(button('Continue')).toBeUndefined();
  });
});
