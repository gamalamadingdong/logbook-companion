// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ plan: vi.fn(), role: 'coach' }));
vi.mock('../../hooks/useCoachingContext', () => ({ useCoachingContext: () => ({ teams: [{ team_id: 'team', role: mocks.role }] }) }));
vi.mock('../../services/coaching/coachingService', () => ({ getWeeklyPlan: mocks.plan, getWeekStart: () => '2026-11-16' }));
import { WeeklyFocusSummary } from './WeeklyFocusSummary';
let root: Root;
async function render(teamId = 'team', userId = 'user') { await act(async () => root.render(<MemoryRouter><WeeklyFocusSummary teamId={teamId} userId={userId} /></MemoryRouter>)); }
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); mocks.role = 'coach'; const host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren(); });
it('shows current theme and only three goals with coach destination', async () => {
  mocks.plan.mockResolvedValue({ theme: 'Patient catches', goals: ['One', 'Two', 'Three', 'Four'] }); await render();
  expect(document.body.textContent).toContain('Patient catches'); expect(document.querySelectorAll('li')).toHaveLength(3);
  expect(document.querySelector('a')?.getAttribute('href')).toBe('/team-management/weekly-focus'); expect(document.body.textContent).toContain('Edit weekly focus');
});
it('keeps read only access and retries a failed load', async () => {
  mocks.role = 'coxswain'; mocks.plan.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(null); await render();
  expect(document.querySelector('[role="alert"]')).not.toBeNull();
  await act(async () => document.querySelector('button')!.click());
  expect(document.body.textContent).toContain('No weekly focus published.'); expect(document.body.textContent).toContain('View weekly focus');
});
it('discards old account responses', async () => {
  let resolve!: (data: unknown) => void; mocks.plan.mockReturnValueOnce(new Promise(r => { resolve = r; })).mockResolvedValueOnce({ theme: 'New account', goals: [] });
  await render(); await render('team', 'other'); await act(async () => resolve({ theme: 'Old account', goals: [] }));
  expect(document.body.textContent).toContain('New account'); expect(document.body.textContent).not.toContain('Old account');
});
