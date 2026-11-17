// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ role: 'coach' }));
vi.mock('../../hooks/useCoachingContext', () => ({ useCoachingContext: () => ({ userId: 'user', teams: [{ org_role: state.role }] }) }));
vi.mock('../../components/coaching/CoachingNav', () => ({ CoachingNav: () => <nav>Scope controls</nav> }));
vi.mock('../../components/coaching/PendingCoachingRequests', () => ({ PendingCoachingRequests: () => <div>Request review</div> }));
import { CoachingAdministration } from './CoachingAdministration';
let root: Root;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); state.role = 'coach'; const host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren(); });
it.each(['owner', 'admin'])('retains %s account-wide review independently of selected team', async role => {
  state.role = role; await act(async () => root.render(<CoachingAdministration />));
  expect(document.body.textContent).toContain('Request review');
  expect(document.body.textContent).toContain('independently of the selected club or team');
});
it.each(['coach', 'coxswain', 'member'])('does not mount request review for %s', async role => {
  state.role = role; await act(async () => root.render(<CoachingAdministration />));
  expect(document.body.textContent).toContain('Administrator access required');
  expect(document.body.textContent).not.toContain('Request review');
});
