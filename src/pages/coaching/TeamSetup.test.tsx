// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ capability: vi.fn(), clubs: vi.fn(), memberships: vi.fn() }));
vi.mock('../../hooks/useCoachingContext', () => ({ useCoachingContext: () => ({ userId: 'coach', hasTeam: true, refreshTeam: vi.fn() }) }));
vi.mock('../../services/coaching/coachingService', () => ({ canCreateCoachingSpace: mocks.capability, getOrganizationsForUser: mocks.clubs, getOrganizationMembershipsForUser: mocks.memberships }));
import { TeamSetup } from './TeamSetup';
let root: Root;
async function render() { await act(async () => root.render(<MemoryRouter><TeamSetup /></MemoryRouter>)); }
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.resetAllMocks();
  mocks.clubs.mockResolvedValue([{ id: 'adminclub', name: 'Admin club' }, { id: 'coachclub', name: 'Coach club' }]);
  mocks.memberships.mockResolvedValue([{ org_id: 'adminclub', role: 'admin' }, { org_id: 'coachclub', role: 'coach' }]);
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren(); });
it('keeps creation forms out of the coxswain/athlete experience', async () => {
  mocks.capability.mockResolvedValue(false); await render();
  expect(document.querySelector('form')).toBeNull();
  expect(document.body.textContent).toContain('requires coaching access');
});
it('only offers club affiliation where the creator administers the club', async () => {
  mocks.capability.mockResolvedValue(true); await render();
  expect(document.querySelector('form')).not.toBeNull();
  expect(document.querySelector('option[value="adminclub"]')).not.toBeNull();
  expect(document.querySelector('option[value="coachclub"]')).toBeNull();
});
it('can retry a failed permission lookup without exposing the creation form', async () => {
  mocks.capability.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(true); await render();
  expect(document.querySelector('form')).toBeNull();
  await act(async () => Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Retry')!.click());
  expect(document.querySelector('form')).not.toBeNull();
});
