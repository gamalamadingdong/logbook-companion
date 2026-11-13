// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'owner', email: 'owner@example.com' }, profile: { display_name: 'Athlete' }, logout: vi.fn(), isAdmin: false, isCoach: false }) }));
vi.mock('../services/concept2Auth', () => ({ connectConcept2: vi.fn() }));
vi.mock('./NotificationBell', () => ({ NotificationBell: () => null }));
vi.mock('./FeedbackModal', () => ({ FeedbackModal: () => null }));
vi.mock('./ReconnectPrompt', () => ({ ReconnectPrompt: () => null }));
vi.mock('./PM5ConnectionPill', () => ({ PM5ConnectionPill: () => null }));
vi.mock('./CommandPalette', () => ({ CommandPalette: ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const navigate = useNavigate();
  return open ? <div role="dialog" aria-label="Search your training"><button onClick={() => { onClose(); navigate('/training-block?enrollment=chosen'); }}>Open result</button></div> : null;
} }));
import { Layout } from './Layout';
let root: Root;
function Probe() { const l = useLocation(); return <output>{l.pathname}{l.search}</output>; }
const button = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(window, 'localStorage', { configurable: true, value: { getItem: () => null } });
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren(); });
async function render() { await act(async () => root.render(<MemoryRouter><Layout><Probe /></Layout></MemoryRouter>)); }
describe('mobile search entry', () => {
  it('opens from the mobile header and navigates without replacing the mobile shell', async () => {
    await render();
    expect(button('Search your training')).not.toBeNull();
    await act(async () => button('Search your training').click());
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Search your training');
    await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === 'Open result')!.click());
    expect(document.querySelector('output')?.textContent).toBe('/training-block?enrollment=chosen');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector('[aria-label="Primary mobile navigation"]')).not.toBeNull();
  });
  it('closes the navigation drawer and account sheet before opening search', async () => {
    await render();
    await act(async () => button('Open navigation menu').click());
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => button('Search your training').click());
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })));
    await act(async () => button('Account menu').click());
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })));
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(button('Account menu').getAttribute('aria-expanded')).toBe('false');
  });
});
