import { afterEach, describe, expect, it, vi } from 'vitest';
import { startContentSearch } from './searchRunner';
import type { SearchGroupResult } from './types';
const empty = (): Promise<SearchGroupResult> => Promise.resolve({items:[],hasMore:false});
afterEach(() => vi.useRealTimers());
describe('async search lifecycle', () => {
    it('debounces typing and never publishes a superseded request', async () => {
        vi.useFakeTimers();
        let resolve!: (value: SearchGroupResult) => void;
        const delayed = new Promise<SearchGroupResult>(done => {resolve = done;});
        const publish = vi.fn();
        const stop = startContentSearch({query:'row',userId:'owner',team:null}, publish, {workouts:()=>delayed,blocks:empty,templates:empty,team:empty});
        expect(publish).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(250);
        expect(publish).toHaveBeenCalled();
        expect(publish.mock.lastCall?.[0].groups.workouts.loading).toBe(true);
        stop();
        publish.mockClear();
        resolve({items:[{id:'stale',group:'workouts',title:'Old result',subtitle:'',href:'/workout/stale'}],hasMore:false});
        await Promise.resolve();
        expect(publish).not.toHaveBeenCalled();
    });
    it('keeps successful groups visible when another group fails', async () => {
        vi.useFakeTimers();
        const publish = vi.fn();
        startContentSearch({query:'row',userId:'owner',team:null}, publish, {workouts:empty,blocks:()=>Promise.reject(new Error('offline')),templates:empty,team:empty});
        await vi.advanceTimersByTimeAsync(250);
        const last = publish.mock.lastCall?.[0];
        expect(last.groups.workouts.result.items).toEqual([]);
        expect(last.groups.blocks.result.error).toContain('Could not');
        expect(last.groups.templates.loading).toBe(false);
    });
    it('cancels before the debounce starts and does not search without an owner', async () => {
        vi.useFakeTimers();
        const search = vi.fn(empty);
        const deps = {workouts:search,blocks:search,templates:search,team:search};
        const stop = startContentSearch({query:'row',userId:'owner',team:null}, vi.fn(), deps);
        stop();
        startContentSearch({query:'row',userId:'',team:null}, vi.fn(), deps);
        await vi.advanceTimersByTimeAsync(500);
        expect(search).not.toHaveBeenCalled();
    });
});
