// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ role: 'coach', plan: vi.fn(), save: vi.fn(), assignments: vi.fn(), delete: vi.fn() }));
vi.mock('../../hooks/useCoachingContext', () => ({ useCoachingContext: () => ({ teams: [{ team_id: 'team', role: mocks.role }] }) }));
vi.mock('../../services/coaching/coachingService', () => ({
  getWeeklyPlan: mocks.plan, upsertWeeklyPlan: mocks.save, deleteWeeklyPlan: mocks.delete,
  getWeekStart: () => '2026-11-16', getGroupAssignments: mocks.assignments,
}));
import { WeeklyFocusCard } from './WeeklyFocusCard';
let root: Root;
async function render() { await act(async () => root.render(<WeeklyFocusCard teamId="team" userId="user" />)); }
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks();
  mocks.role = 'coach'; mocks.plan.mockResolvedValue(null); mocks.assignments.mockResolvedValue([]);
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

it('uses dated Schedule link while keeping assignments in export', async () => {
  mocks.plan.mockResolvedValue({ id: 'plan', theme: 'Patient catches', goals: [], coaching_points: [], drill_examples: [], piece_examples: [], notes: null, reflection: null });
  mocks.assignments.mockResolvedValue([{ id: 'work', title: 'Exported workout', scheduled_date: '2026-11-17' }]);
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  await render();
  expect([...document.querySelectorAll('button')].some(b => b.textContent?.trim() === 'Schedule')).toBe(false);
  expect(document.querySelector('a')?.getAttribute('href')).toBe('/team-management/schedule?date=2026-11-16');
  await act(async () => document.querySelector<HTMLButtonElement>('button[title="Copy to clipboard for email"]')!.click());
  expect(writeText.mock.calls[0][0]).toContain('Exported workout');
});
it('shows failed plan reads with retry rather than an empty editor', async () => {
  mocks.plan.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(null);
  await render(); expect(document.querySelector('[role="alert"]')).not.toBeNull();
  const retry = [...document.querySelectorAll('button')].find(button => button.textContent?.includes('Retry'));
  await act(async () => retry!.click()); expect(document.body.textContent).toContain("Set this week's focus");
});
it('keeps a failed save draft and feedback visible', async () => {
  mocks.save.mockRejectedValueOnce(new Error('offline'));
  await render();
  await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent?.includes("Set this week's focus"))!.click());
  await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Save')!.click());
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('draft is kept');
  expect(document.querySelector('textarea')).not.toBeNull();
});
it('does not let a retry for sharing replace an unsaved focus draft', async () => {
  mocks.assignments.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
  await render();
  await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent?.includes("Set this week's focus"))!.click());
  const before = mocks.plan.mock.calls.length;
  await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent?.includes('Retry assignments'))!.click());
  expect(mocks.plan.mock.calls.length).toBe(before);
});
it('isolates the full editor when account changes during a read', async () => {
  let resolve!: (value: unknown) => void;
  mocks.plan.mockReturnValueOnce(new Promise(r => { resolve = r; })).mockResolvedValueOnce({ id: 'new', theme: 'Current account', goals: [], coaching_points: [], drill_examples: [], piece_examples: [] });
  await render();
  await act(async () => root.render(<WeeklyFocusCard teamId="team" userId="new-user" />));
  await act(async () => resolve({ id: 'old', theme: 'Old account', goals: [], coaching_points: [], drill_examples: [], piece_examples: [] }));
  expect(document.body.textContent).toContain('Current account'); expect(document.body.textContent).not.toContain('Old account');
});
it('reports clipboard failure without losing the published plan', async () => {
  mocks.plan.mockResolvedValue({ id: 'plan', theme: 'Patient catches', goals: [], coaching_points: [], drill_examples: [], piece_examples: [] });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
  await render();
  await act(async () => document.querySelector<HTMLButtonElement>('button[title="Copy to clipboard for email"]')!.click());
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('clipboard permissions'); expect(document.body.textContent).toContain('Patient catches');
});
it('confirms deletion and keeps the dialog open after failure', async () => {
  mocks.plan.mockResolvedValue({ id: 'plan', theme: 'Patient catches', goals: [], coaching_points: [], drill_examples: [], piece_examples: [] });
  mocks.delete.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  await render();
  await act(async () => document.querySelector<HTMLButtonElement>('button[title="Edit this week"]')!.click());
  await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Delete')!.click());
  expect(mocks.delete).not.toHaveBeenCalled(); expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Confirm delete')!.click());
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('could not be deleted');
  await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Confirm delete')!.click());
  expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(document.body.textContent).toContain("Set this week's focus");
});
it('keeps reflection-only plans visible and in weekly sharing', async () => {
  mocks.plan.mockResolvedValue({ id: 'plan', theme: null, goals: [], coaching_points: [], drill_examples: [], piece_examples: [], reflection: 'More patient catches next week' });
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  await render();
  expect(document.body.textContent).toContain('More patient catches next week');
  await act(async () => document.querySelector<HTMLButtonElement>('button[title="Copy to clipboard for email"]')!.click());
  expect(writeText.mock.calls[0][0]).toContain('Reflection: More patient catches next week');
});
it('loads a supplied initial week and isolates a changed week', async () => {
  await act(async () => root.render(<WeeklyFocusCard teamId="team" userId="user" initialWeekStart="2026-10-05" />));
  expect(mocks.plan).toHaveBeenLastCalledWith('team', '2026-10-05');
  await act(async () => root.render(<WeeklyFocusCard teamId="team" userId="user" initialWeekStart="2026-10-12" />));
  expect(mocks.plan).toHaveBeenLastCalledWith('team', '2026-10-12');
  expect(document.querySelector('a')?.getAttribute('href')).toBe('/team-management/schedule?date=2026-10-12');
});
