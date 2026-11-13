export type SearchGroup = 'workouts' | 'blocks' | 'templates' | 'team';
export interface SearchItem {
    id: string;
    group: SearchGroup;
    title: string;
    subtitle: string;
    href: string;
    keywords?: string;
    date?: string;
}
export interface SearchGroupResult {
    items: SearchItem[];
    hasMore: boolean;
    error?: string;
}
export interface SearchTeamScope {
    orgId?: string | null;
    id: string;
    name: string;
    role: 'coach' | 'coxswain' | 'member';
    canManage: boolean;
}
