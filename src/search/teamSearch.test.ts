import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadTeamSearchDetail, searchTeam } from './teamSearch';
import type { SearchTeamScope } from './types';

const { calls, responses } = vi.hoisted(() => ({
    calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
    responses: {} as Record<string, { data: unknown; error: { message: string } | null }>,
}));
vi.mock('../services/supabase', () => ({
    supabase: {
        from(table: string) {
            const chain: Record<string, unknown> = {};
            for (const method of ['select', 'eq', 'or', 'order', 'limit', 'in', 'maybeSingle']) {
                chain[method] = (...args: unknown[]) => {
                    calls.push({ table, method, args });
                    return chain;
                };
            }
            chain.then = (resolve: (result: unknown) => unknown) => Promise.resolve(responses[table] ?? { data: [], error: null }).then(resolve);
            return chain;
        },
    },
}));
const team: SearchTeamScope = { id: 'team-a', name: 'Varsity', role: 'member', canManage: false };

beforeEach(() => {
    calls.length = 0;
    for (const key of Object.keys(responses)) delete responses[key];
});

describe('active team search', () => {
    it('does no reads without an authenticated user and active team', async () => {
        expect(await searchTeam('intervals', 'user-a', null)).toEqual({ items: [], hasMore: false });
        expect(await searchTeam('intervals', '', team)).toEqual({ items: [], hasMore: false });
        expect(calls).toEqual([]);
    });

    it('scopes member assignment reads to the user and selected team with a member destination', async () => {
        responses.daily_workout_assignments = { data: [{ id: 'daily-a', workout_date: '2026-11-10', completed: false, group_assignments: { id: 'group-a', title: 'Winter intervals', instructions: null, workout_templates: { name: '4x500m', canonical_name: '4x500m', rwn: '4x500m' } } }], error: null };
        const result = await searchTeam('intervals', 'user-a', team);
        expect(result.items).toMatchObject([{ id: 'assignment:daily-a', title: 'Winter intervals', href: '/team/search/assignment/daily-a' }]);
        expect(calls).toContainEqual({ table: 'daily_workout_assignments', method: 'eq', args: ['user_id', 'user-a'] });
        expect(calls).toContainEqual({ table: 'daily_workout_assignments', method: 'eq', args: ['team_id', 'team-a'] });
        expect(calls.some((call) => call.table === 'athletes')).toBe(false);
        expect(calls).toContainEqual({ table: 'group_assignments', method: 'eq', args: ['team_id', 'team-a'] });
    });

    it('gives coaches team assignment and athlete links without searching other teams', async () => {
        responses.group_assignments = { data: [{ id: 'group-a', scheduled_date: '2026-11-10', title: 'Winter intervals', instructions: null, workout_templates: null }], error: null };
        responses.athletes = { data: [{ id: 'athlete-a', first_name: 'Winter', last_name: 'Jones', team_athletes: [{ squad: 'Varsity' }] }], error: null };
        const result = await searchTeam('winter', 'user-a', { ...team, role: 'coach', canManage: true });
        expect(result.items.map((item) => item.href)).toContain('/team-management/assignments/group-a/results');
        expect(result.items.map((item) => item.href)).toContain('/team-management/roster/athlete-a');
        expect(calls).toContainEqual({ table: 'group_assignments', method: 'eq', args: ['team_id', 'team-a'] });
        expect(calls).toContainEqual({ table: 'athletes', method: 'eq', args: ['team_athletes.team_id', 'team-a'] });
    });

    it('retains permitted session matches when assignment search fails', async () => {
        responses.daily_workout_assignments = { data: null, error: { message: 'denied' } };
        responses.coaching_sessions = { data: [{ id: 'session-a', date: '2026-11-11', type: 'erg', focus: 'Winter intervals' }], error: null };
        const result = await searchTeam('winter', 'user-a', team);
        expect(result.items[0]).toMatchObject({ title: 'Winter intervals', href: '/team/search/session/session-a' });
        expect(result.error).toContain('assignments');
        expect(calls).toContainEqual({ table: 'coaching_sessions', method: 'eq', args: ['team_id', 'team-a'] });
        expect(calls.filter((call) => call.method === 'select').every((call) => !String(call.args[0]).includes('general_notes'))).toBe(true);
    });

    it('matches assignment template names through bounded accessible template IDs', async () => {
        responses.workout_templates = { data: [{ id: 'template-a' }], error: null };
        responses.daily_workout_assignments = { data: [{ id: 'daily-a', workout_date: '2026-11-10', completed: false, group_assignments: { id: 'group-a', title: 'Tuesday workout', instructions: null, workout_templates: { name: '4x500m', canonical_name: '4x500m', rwn: '4x500m' } } }], error: null };
        const result = await searchTeam('4x500m', 'user-a', team);
        expect(result.items[0].title).toBe('Tuesday workout');
        expect(calls).toContainEqual({ table: 'daily_workout_assignments', method: 'or', args: ['title.ilike."%4%500m%",instructions.ilike."%4%500m%",template_id.in.(template-a)', { referencedTable: 'group_assignments' }] });
        expect(calls.filter((call) => call.method === 'limit').every((call) => call.args[0] === 40)).toBe(true);
    });

    it('quotes reserved PostgREST syntax inside a literal search pattern', async () => {
        await searchTeam('winter,foo)', 'user-a', team);
        expect(calls).toContainEqual({ table: 'coaching_sessions', method: 'or', args: ['focus.ilike."%winter,foo)%",type.ilike."%winter,foo)%"'] });
    });

    it('surfaces shared coach workouts when member daily assignment rows are unavailable', async () => {
        responses.group_assignments = { data: [{ id: 'group-a', scheduled_date: '2026-11-10', title: 'Winter intervals', instructions: null, workout_templates: null }], error: null };
        const result = await searchTeam('winter', 'user-a', team);
        expect(result.items).toMatchObject([{ id: 'group-assignment:group-a', title: 'Winter intervals', subtitle: 'Varsity · Team workout · 2026-11-10', href: '/team/search/group-assignment/group-a' }]);
        expect(result.items[0].subtitle).not.toContain('Assigned');
    });

    it('prefers an owned daily assignment over its shared group workout', async () => {
        responses.group_assignments = { data: [{ id: 'group-a', scheduled_date: '2026-11-10', title: 'Winter intervals', instructions: null, workout_templates: null }], error: null };
        responses.daily_workout_assignments = { data: [{ id: 'daily-a', workout_date: '2026-11-10', completed: false, group_assignments: { id: 'group-a', title: 'Winter intervals', instructions: null, workout_templates: null } }], error: null };
        const result = await searchTeam('winter', 'user-a', team);
        expect(result.items).toHaveLength(1);
        expect(result.items[0].href).toBe('/team/search/assignment/daily-a');
    });

    it('includes only selected-team or organization-wide group assignments for coaches and members', async () => {
        for (const scope of [team, { ...team, role: 'coach' as const, canManage: true }]) {
            calls.length = 0;
            await searchTeam('winter', 'user-a', { ...scope, orgId: 'org-a' });
            expect(calls).toContainEqual({ table: 'group_assignments', method: 'or', args: ['team_id.eq.team-a,and(team_id.is.null,org_id.eq.org-a)'] });
            expect(calls).toContainEqual({ table: 'coaching_sessions', method: 'eq', args: ['team_id', 'team-a'] });
        }
    });

    it('finds multi-word sessions across focus and type in either word order', async () => {
        responses.coaching_sessions = { data: [{ id: 'session-a', date: '2026-11-11', type: 'erg', focus: 'Winter intervals' }], error: null };
        for (const query of ['winter erg', 'erg winter']) {
            calls.length = 0;
            expect((await searchTeam(query, 'user-a', team)).items[0].href).toBe('/team/search/session/session-a');
            expect(calls).toContainEqual({ table: 'coaching_sessions', method: 'or', args: ['focus.ilike."%winter%",type.ilike."%winter%"'] });
            expect(calls).toContainEqual({ table: 'coaching_sessions', method: 'or', args: ['focus.ilike."%erg%",type.ilike."%erg%"'] });
        }
    });

    it('allows query words to match assignment title and linked template separately', async () => {
        responses.workout_templates = { data: [{ id: 'template-a' }], error: null };
        responses.group_assignments = { data: [{ id: 'group-a', scheduled_date: '2026-11-10', title: 'Winter intervals', instructions: null, workout_templates: { name: '4x500m', canonical_name: '4x500m', rwn: '4x500m' } }], error: null };
        const result = await searchTeam('500m winter', 'user-a', team);
        expect(result.items[0].title).toBe('Winter intervals');
        expect(calls).toContainEqual({ table: 'group_assignments', method: 'or', args: ['title.ilike."%500m%",instructions.ilike."%500m%",template_id.in.(template-a)'] });
        expect(calls).toContainEqual({ table: 'group_assignments', method: 'or', args: ['title.ilike."%winter%",instructions.ilike."%winter%",template_id.in.(template-a)'] });
    });

    it('never gives coxswains coach-only routes even when canManage is inconsistent', async () => {
        responses.coaching_sessions = { data: [{ id: 'session-a', date: '2026-11-11', type: 'erg', focus: 'Winter intervals' }], error: null };
        const result = await searchTeam('winter', 'user-a', { ...team, role: 'coxswain', canManage: true });
        expect(result.items[0].href).toBe('/team/search/session/session-a');
        expect(calls.some((call) => call.table === 'athletes')).toBe(false);
    });
});

describe('team search detail', () => {
    it('revalidates assignment ownership and active team at the destination', async () => {
        responses.daily_workout_assignments = { data: { id: 'daily-a', workout_date: '2026-11-10', completed: false, group_assignments: { title: 'Winter intervals', instructions: 'Controlled pace', workout_templates: { name: '4x500m', canonical_name: '4x500m', rwn: '4x500m' } } }, error: null };
        expect(await loadTeamSearchDetail('assignment', 'daily-a', 'user-a', 'team-a')).toMatchObject({ title: 'Winter intervals', description: 'Controlled pace', date: '2026-11-10' });
        expect(calls).toContainEqual({ table: 'daily_workout_assignments', method: 'eq', args: ['id', 'daily-a'] });
        expect(calls).toContainEqual({ table: 'daily_workout_assignments', method: 'eq', args: ['user_id', 'user-a'] });
        expect(calls).toContainEqual({ table: 'daily_workout_assignments', method: 'eq', args: ['team_id', 'team-a'] });
    });

    it('revalidates shared group workout scope without claiming personal completion', async () => {
        responses.group_assignments = { data: { id: 'group-a', scheduled_date: '2026-11-10', title: 'Winter intervals', instructions: 'Controlled pace', workout_templates: null }, error: null };
        const detail = await loadTeamSearchDetail('group-assignment', 'group-a', 'user-a', 'team-a', 'org-a');
        expect(detail).toMatchObject({ title: 'Winter intervals', type: 'Team workout', description: 'Controlled pace' });
        expect(detail?.completed).toBeUndefined();
        expect(calls).toContainEqual({ table: 'group_assignments', method: 'or', args: ['team_id.eq.team-a,and(team_id.is.null,org_id.eq.org-a)'] });
        expect(calls).toContainEqual({ table: 'group_assignments', method: 'eq', args: ['id', 'group-a'] });
    });

    it('rejects unknown content kinds without a database request', async () => {
        expect(await loadTeamSearchDetail('private-note', 'note-a', 'user-a', 'team-a')).toBeNull();
        expect(calls).toEqual([]);
    });
});
