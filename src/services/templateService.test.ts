import { beforeEach, describe, expect, it, vi } from 'vitest';

const { request } = vi.hoisted(() => ({ request: vi.fn<typeof fetch>() }));

vi.mock('./supabase', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    return {
        supabase: createClient('https://example.supabase.co', 'test-key', {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
            global: { fetch: request },
        }),
    };
});

import { getTemplatePersonalBest } from './templateService';

describe('getTemplatePersonalBest', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        request.mockReset();
    });

    it('requests an optional result so a template with no workouts returns HTTP 200', async () => {
        const statuses: number[] = [];
        request.mockImplementation(async (_input, init) => {
            const singular = new Headers(init?.headers).get('Accept') === 'application/vnd.pgrst.object+json';
            const status = singular ? 406 : 200;
            statuses.push(status);
            return new Response(JSON.stringify(singular
                ? { code: 'PGRST116', message: 'Cannot coerce the result to a single JSON object', details: 'The result contains 0 rows' }
                : []), { status, headers: { 'Content-Type': 'application/json' } });
        });

        expect(await getTemplatePersonalBest('template-1', 'user-1')).toBeNull();
        expect(statuses).toEqual([200]);
    });

    it('returns the best workout while retaining owner scope and ranking', async () => {
        const best = { id: 'workout-1', completed_at: '2026-11-13', distance_meters: 2000, duration_seconds: 480, average_stroke_rate: 28, watts: 203 };
        request.mockImplementation(async (_input, init) => {
            const singular = new Headers(init?.headers).get('Accept') === 'application/vnd.pgrst.object+json';
            return new Response(JSON.stringify(singular ? best : [best]), { status: 200 });
        });

        expect(await getTemplatePersonalBest('template-1', 'user-1')).toEqual(best);
        const url = new URL(String(request.mock.calls[0][0]));
        expect(url.pathname).toBe('/rest/v1/workout_logs');
        expect(Object.fromEntries(url.searchParams)).toMatchObject({
            template_id: 'eq.template-1', user_id: 'eq.user-1',
            order: 'watts.desc,completed_at.asc', limit: '1',
        });
    });

    it('reports actual request failures', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => {});
        request.mockResolvedValue(new Response(JSON.stringify({ code: '42501', message: 'permission denied' }), { status: 403 }));

        expect(await getTemplatePersonalBest('template-1', 'user-1')).toBeNull();
        expect(log).toHaveBeenCalledWith('Error fetching personal best:', expect.objectContaining({ code: '42501' }));
    });

    it('skips the request when template or user is missing', async () => {
        expect(await getTemplatePersonalBest('', 'user-1')).toBeNull();
        expect(await getTemplatePersonalBest('template-1', '')).toBeNull();
        expect(request).not.toHaveBeenCalled();
    });
});
