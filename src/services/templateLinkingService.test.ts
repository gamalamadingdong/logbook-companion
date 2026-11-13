import { beforeEach, describe, expect, it, vi } from 'vitest';
const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { from } }));
import { previewTemplateLinks, saveTemplateLinks, type LinkSnapshot } from './templateLinkingService';
const row = (id: string): LinkSnapshot => ({ id, user_id: 'owner', template_id: null, updated_at: 'stamp', workout_type: 'rower', manual_rwn: '3000m', distance_meters: 3000, duration_seconds: 800, raw_workout_type: null, raw_workout: null });
const chains: Array<Record<string, ReturnType<typeof vi.fn>>> = [];
function query(result: unknown) {
  const q = Object.fromEntries(['select','eq','is','neq','order','limit','gt','abortSignal','update'].map(k => [k, vi.fn().mockReturnThis()]));
  q.single = vi.fn().mockResolvedValue(result);
  q.then = vi.fn((resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve));
  chains.push(q); return q;
}
beforeEach(() => { from.mockReset(); chains.length = 0; });
describe('historical template linking', () => {
  it('paginates own unlinked history without loading raw strokes', async () => {
    from.mockReturnValueOnce(query({ data: row('current') })).mockReturnValueOnce(query({ data: Array.from({ length: 250 }, (_, i) => row(String(i))) })).mockReturnValueOnce(query({ data: [row('last')] }));
    const preview = await previewTemplateLinks('owner', 'current');
    expect(preview.matches).toHaveLength(251);
    for (const q of chains) expect(q.eq).toHaveBeenCalledWith('user_id', 'owner');
    expect(chains[1].is).toHaveBeenCalledWith('template_id', null);
    expect(chains[2].gt).toHaveBeenCalledWith('id', '249');
    expect(chains[0].select.mock.calls[0][0]).not.toContain('raw_data,');
  });
  it('saves every selected row with ownership, timestamp and previous-link guards', async () => {
    from.mockImplementation(() => query({ data: [{ id: 'updated' }] }));
    const rows = Array.from({ length: 12 }, (_, i) => row(String(i)));
    const result = await saveTemplateLinks('owner', 'template', rows);
    expect(result.linked).toHaveLength(12);
    expect(result.failed).toEqual([]);
    chains.forEach(q => {
      expect(q.eq).toHaveBeenCalledWith('user_id', 'owner');
      expect(q.eq).toHaveBeenCalledWith('updated_at', 'stamp');
      expect(q.is).toHaveBeenCalledWith('template_id', null);
    });
  });
  it('does not touch history when the current snapshot changed', async () => {
    from.mockReturnValue(query({ data: [] }));
    expect(await saveTemplateLinks('owner', 'template', [row('current'), row('history')])).toEqual({ linked: [], skipped: ['current', 'history'], failed: [] });
    expect(from).toHaveBeenCalledTimes(1);
  });
  it('retains all selected rows for retry when the first request fails', async () => {
    from.mockReturnValue(query({ error: { message: 'offline' }, data: null }));
    const rows = [row('current'), row('history')];
    expect(await saveTemplateLinks('owner', 'template', rows)).toEqual({ linked: [], skipped: [], failed: rows });
    expect(from).toHaveBeenCalledTimes(1);
  });
  it('reports partial failures and skips without claiming they linked', async () => {
    from.mockReturnValueOnce(query({ data: [{ id: 'current' }] })).mockReturnValueOnce(query({ data: [], error: { message: 'offline' } })).mockReturnValueOnce(query({ data: [] }));
    const result = await saveTemplateLinks('owner', 'template', [row('current'), row('failed'), row('changed'), { ...row('foreign'), user_id: 'other' }]);
    expect(result.linked).toEqual(['current']);
    expect(result.failed.map(r => r.id)).toEqual(['failed']);
    expect(result.skipped).toEqual(expect.arrayContaining(['changed', 'foreign']));
    expect(from).toHaveBeenCalledTimes(3);
  });
  it('fails the preview rather than offering an incomplete count', async () => {
    from.mockReturnValueOnce(query({ data: row('current') })).mockReturnValueOnce(query({ data: null, error: { message: 'offline' } }));
    await expect(previewTemplateLinks('owner', 'current')).rejects.toThrow('Retry the scan');
  });
});
