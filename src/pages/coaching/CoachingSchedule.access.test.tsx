// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoachingAthlete, CoachingSession } from '../../services/coaching/types';
const mocks = vi.hoisted(() => ({ role: 'coach', notes: vi.fn(), deleteSession: vi.fn(), addCrew: vi.fn() }));
vi.mock('../../hooks/useCoachingContext', () => ({ useCoachingContext: () => ({ teams: [
  { team_id: 'anchor', role: 'coach' }, { team_id: 'session-team', role: mocks.role },
] }) }));
vi.mock('../../services/coaching/coachingService', async (original) => ({ ...await original<object>(), getNotesForSession: mocks.notes }));
import { SessionCard } from './CoachingSchedule';
let root: Root;
const noop = () => {};
async function render() {
  await act(async () => root.render(<SessionCard
    session={{ id: 'session', team_id: 'session-team', type: 'water', date: '2026-11-16', general_notes: 'Meet at the dock' } as CoachingSession}
    athletes={[{ id: 'athlete', name: 'Alex River' } as CoachingAthlete]}
    isExpanded addingNoteFor={null} onToggle={noop} onStartAddNote={noop} onAddNote={noop} onCancelNote={noop}
    onDeleteNote={noop} onEditNote={noop} onEdit={noop} onDelete={mocks.deleteSession} notesVersion={0}
    crewCount={0} crews={[]} onAddCrew={mocks.addCrew} onManageTemplates={noop}
  />));
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); mocks.role = 'coach'; mocks.notes.mockResolvedValue([]);
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren(); });
const button = (text: string) => [...document.querySelectorAll('button')].find(b => b.textContent?.includes(text));
describe('session team permissions', () => {
  it('hides session deletion and private athlete notes for coxswains while retaining session/crew operations', async () => {
    mocks.role = 'coxswain'; await render();
    expect(document.querySelector('button[aria-label="Delete session"]')).toBeNull();
    expect(button('Add athlete note')).toBeUndefined();
    expect(mocks.notes).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Meet at the dock');
    expect(document.querySelector('button[aria-label="Edit session"]')).not.toBeNull();
    await act(async () => button('Add crew snapshot')!.click());
    expect(mocks.addCrew).toHaveBeenCalledOnce();
  });
  it('retains session deletion and private athlete notes for the actual session team coach', async () => {
    await render();
    expect(mocks.notes).toHaveBeenCalledWith('session');
    expect(button('Add athlete note')).toBeDefined();
    await act(async () => (document.querySelector('button[aria-label="Delete session"]') as HTMLButtonElement).click());
    expect(mocks.deleteSession).toHaveBeenCalledOnce();
  });
});
