// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ preview: vi.fn(), save: vi.fn(), linked: vi.fn(), close: vi.fn() }));
vi.mock('../services/templateLinkingService', () => ({ previewTemplateLinks: mocks.preview, saveTemplateLinks: mocks.save, loadLinkSnapshot: vi.fn() }));
vi.mock('../services/templateService', () => ({ fetchTemplateById: async () => ({ id: 'template', name: 'Pyramid' }) }));
import { TemplateLinkConfirmation } from './TemplateLinkConfirmation';
let root: Root;
const rows = [{ id: 'current' }, { id: 'match1' }, { id: 'match2' }];
const button = (label: string) => [...document.querySelectorAll('button')].find(b => b.textContent === label)!;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  mocks.preview.mockResolvedValue({ current: rows[0], matches: rows.slice(1), comparable: true });
  mocks.save.mockResolvedValue({ linked: rows.map(r => r.id), skipped: [], failed: [] });
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren(); });
async function render() { await act(async () => root.render(<TemplateLinkConfirmation userId="owner" workoutId="current" templateId="template" onClose={mocks.close} onLinked={mocks.linked} />)); }
describe('template history confirmation', () => {
  it('previews the count without writing and cancels safely', async () => {
    await render();
    expect(document.body.textContent).toContain('2 other unlinked workouts');
    expect(button('Link all 3 workouts')).toBeDefined();
    expect(mocks.save).not.toHaveBeenCalled();
    await act(async () => button('Cancel').click());
    expect(mocks.close).toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it.each([false, true])('saves the explicitly selected scope (bulk=%s)', async bulk => {
    await render();
    await act(async () => button(bulk ? 'Link all 3 workouts' : 'Link this workout').click());
    expect(mocks.save).toHaveBeenCalledWith('owner', 'template', bulk ? rows : rows.slice(0, 1));
    expect(mocks.linked).toHaveBeenCalledWith(expect.objectContaining({ id: 'template' }));
  });
  it('reports partial failures and retries only those rows', async () => {
    mocks.save.mockResolvedValueOnce({ linked: ['current', 'match1'], skipped: [], failed: [rows[2]] }).mockResolvedValueOnce({ linked: ['match2'], skipped: [], failed: [] });
    await render();
    await act(async () => button('Link all 3 workouts').click());
    expect(document.body.textContent).toContain('2 workouts linked');
    await act(async () => button('Retry failed links').click());
    expect(mocks.save).toHaveBeenLastCalledWith('owner', 'template', [rows[2]]);
    expect(document.body.textContent).toContain('3 workouts linked');
  });
  it('shows a scan error and does not offer an unverified bulk action', async () => {
    mocks.preview.mockRejectedValue(new Error('offline'));
    await render();
    expect(document.body.textContent).toContain('Could not check your history');
    expect(button('Link all 3 workouts')).toBeUndefined();
    expect(button('Link this workout')).toBeDefined();
  });
});
