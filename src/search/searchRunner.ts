import type { SearchGroup, SearchGroupResult, SearchTeamScope } from './types';
export interface SearchScope { query: string; userId: string; team: SearchTeamScope | null; }
export type GroupState = {loading: boolean; result?: SearchGroupResult};
export interface SearchSnapshot {key: string; groups: Partial<Record<SearchGroup, GroupState>>;}
export type Searchers = Record<SearchGroup, (scope: SearchScope) => Promise<SearchGroupResult>>;
export function searchScopeKey(scope: SearchScope) { return JSON.stringify([scope.query.trim(),scope.userId,scope.team]); }

export function startContentSearch(scope: SearchScope, publish: (snapshot: SearchSnapshot)=>void, searchers: Searchers): () => void {
    if (!scope.userId || !scope.query.trim()) return () => {};
    let cancelled = false;
    const key = searchScopeKey(scope);
    const groups: SearchGroup[] = scope.team ? ['workouts','blocks','templates','team'] : ['workouts','blocks','templates'];
    let states: SearchSnapshot['groups'] = Object.fromEntries(groups.map(group => [group, {loading:true}]));
    const timer = setTimeout(() => {
        publish({key, groups:states});
        for (const group of groups) {
            void Promise.resolve().then(() => searchers[group](scope)).then(result => {
                if (cancelled) return;
                states = {...states, [group]:{loading:false, result}};
                publish({key, groups:states});
            }).catch(() => {
                if (cancelled) return;
                states = {...states, [group]:{loading:false, result:{items:[],hasMore:false,error:'Could not search this content. Try again.'}}};
                publish({key, groups:states});
            });
        }
    }, 250);
    return () => {cancelled = true; clearTimeout(timer);};
}
