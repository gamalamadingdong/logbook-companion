// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ role: 'coach', plan: vi.fn(), save: vi.fn() }));
vi.mock('../../hooks/useCoachingContext', () => ({ useCoachingContext: () => ({ teams: [{ team_id: 'team', role: mocks.role }] }) }));
vi.mock('../../services/coaching/coachingService', () => ({
  getWeeklyPlan: mocks.plan, upsertWeeklyPlan: mocks.save, deleteWeeklyPlan: vi.fn(),
  getWeekStart: () => '2026-11-16', getGroupAssignments: async () => [],
}));
import { WeeklyFocusCard } from './WeeklyFocusCard';
let root: Root;
async function render() { await act(async () => root.render(<WeeklyFocusCard teamId="team" userId="user" />)); }
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks();
  mocks.role = 'coach'; mocks.plan.mockResolvedValue(null);
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren(); });
describe('weekly focus permissions', () => {
  it('lets coaches create a focus', async () => {
    await render();
    const button = [...document.querySelectorAll('button')].find(b => b.textContent?.includes("Set this week's focus"));
    expect(button).toBeDefined();
    await act(async () => button!.click());
    expect([...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Save')).toBeDefined();
  });
  it('shows the empty state without a creation control for coxswains', async () => {
    mocks.role = 'coxswain'; await render();
    expect(document.body.textContent).toContain('No weekly focus published.');
    expect(document.body.textContent).not.toContain("Set this week's focus");
    expect(document.querySelector('textarea')).toBeNull();
  });
  it('lets coxswains read a published focus while hiding its edit control', async () => {
    mocks.role = 'coxswain';
    mocks.plan.mockResolvedValue({ id: 'plan', theme: 'Patient catches', goals: [], coaching_points: [], drill_examples: [], piece_examples: [], notes: null, reflection: null });
    await render();
    expect(document.body.textContent).toContain('Patient catches');
    expect(document.querySelector('button[title="Edit this week"]')).toBeNull();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
