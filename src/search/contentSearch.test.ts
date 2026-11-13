import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ results: {} as Record<string, {data: unknown; error: unknown}>, calls: [] as Array<{table: string; method: string; args: unknown[]}> }));
vi.mock('../services/supabase', () => ({ supabase: { from: (table: string) => {
    const q: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'is', 'in', 'neq', 'or', 'order', 'limit']) q[method] = (...args: unknown[]) => { mock.calls.push({table,method,args}); return q; };
    q.then = (resolve: (result: unknown) => unknown) => Promise.resolve(mock.results[table] ?? {data: [],error: null}).then(resolve);
    return q;
} } }));
import { searchWorkouts, searchTemplates, searchBlocks } from './contentSearch';
beforeEach(() => { mock.results = {}; mock.calls = []; });
describe('owned workout search', () => {
    it('searches only the authenticated owner and opens the durable workout UUID', async () => {
        mock.results.workout_logs = {data: [{id:'uuid', workout_name:'Intervals', canonical_name:'4x500m', manual_rwn:'4x500m/1:00r', completed_at:'2026-11-10T12:00:00Z', distance_meters:2000, duration_seconds:480, duration_minutes:8}],error:null};
        const result = await searchWorkouts('4 × 500m','owner');
        expect(result.items[0]).toMatchObject({href:'/workout/uuid',title:'4x500m'});
        expect(result.items[0].subtitle).toContain('2,000 m');
        expect(mock.calls).toContainEqual({table:'workout_logs',method:'eq',args:['user_id','owner']});
    });
    it('does not query anonymous or blank searches', async () => {
        expect((await searchWorkouts('row','')).items).toEqual([]);
        expect((await searchWorkouts('  ','owner')).items).toEqual([]);
        expect(mock.calls).toEqual([]);
    });
    it('quotes OR values so punctuation cannot add filter conditions', async () => {
        await searchWorkouts('row,source.eq.secret','owner');
        const filter = mock.calls.find(c => c.method === 'or')?.args[0] as string;
        expect(filter).toContain('workout_name.ilike."%row,source.eq.secret%"');
    });
});
describe('template search', () => {
    it('keeps support templates if the workout template source fails', async () => {
        mock.results.workout_templates = {data:null,error:{message:'offline'}};
        mock.results.support_session_templates = {data:[{id:'support',title:'Core stability',description:'Control',kind:'core',estimated_duration_minutes:10}],error:null};
        const result = await searchTemplates('core','owner');
        expect(result.items[0].href).toBe('/library/strength-mobility?template=support');
        expect(result.error).toContain('Workout templates');
    });
    it('searches canonical names, notation and descriptions as well as names', async () => {
        await searchTemplates('500m','owner');
        const filter = mock.calls.find(c=>c.table==='workout_templates' && c.method==='or')?.args[0] as string;
        expect(filter).toContain('rwn.ilike.');
        expect(filter).toContain('canonical_name.ilike.');
        expect(filter).toContain('description.ilike.');
    });
});
describe('training block search', () => {
    it('builds a direct enrollment/day/session link with week context', async () => {
        mock.results.training_block_enrollments = {data:[{id:'enroll',template_id:'plan',template_key:'winter',start_date:'2026-11-02',status:'active',is_active:true}],error:null};
        mock.results.training_block_templates = {data:[{id:'plan',template_key:'winter',name:'Winter block',description:'Base training'}],error:null};
        mock.results.training_block_template_days = {data:[{id:'day',template_id:'plan',week_number:2,day_slot:1}],error:null};
        mock.results.training_block_template_sessions = {data:[{id:'session-row',template_day_id:'day',session_key:'erg-primary',title:'Speed intervals',planned_rwn:'4x500m',source:'erg',instructions:[]}],error:null};
        const result = await searchBlocks('500m','owner');
        expect(result.items[0]).toMatchObject({title:'Speed intervals', href:'/training-block?enrollment=enroll&date=2026-11-10&session=erg-primary'});
        expect(result.items[0].subtitle).toContain('Week 2');
        expect(mock.calls).toContainEqual({table:'training_block_enrollments',method:'eq',args:['user_id','owner']});
        expect(mock.calls).toContainEqual({table:'training_block_enrollments',method:'is',args:['team_id',null]});
    });
});

describe('matching across content fields', () => {
    it('allows words in different template fields regardless of their order', async () => {
        mock.results.workout_templates = {data:[{id:'template',name:'Steady row',description:'Recovery work',rwn:'30:00',canonical_name:null,training_zone:'UT2'}],error:null};
        const result = await searchTemplates('recovery row','owner');
        expect(result.items[0].title).toBe('Steady row');
        const filters = mock.calls.filter(c=>c.table==='workout_templates' && c.method==='or').map(c=>String(c.args[0]));
        expect(filters).toHaveLength(2);
        expect(filters[0]).toContain('description.ilike."%recovery%"');
        expect(filters[1]).toContain('name.ilike."%row%"');
    });
    it('retains sessions found by activity source even when they have notation', async () => {
        mock.results.training_block_enrollments = {data:[{id:'enroll',template_id:'plan',template_key:'winter',start_date:'2026-11-02',status:'active',is_active:true}],error:null};
        mock.results.training_block_templates = {data:[{id:'plan',template_key:'winter',name:'Winter',description:''}],error:null};
        mock.results.training_block_template_days = {data:[{id:'day',template_id:'plan',week_number:1,day_slot:0}],error:null};
        mock.results.training_block_template_sessions = {data:[{id:'session',template_day_id:'day',session_key:'primary',title:'Intervals',planned_rwn:'4x500m',source:'erg',instructions:[]}],error:null};
        expect((await searchBlocks('erg','owner')).items[0].title).toBe('Intervals');
    });
});
