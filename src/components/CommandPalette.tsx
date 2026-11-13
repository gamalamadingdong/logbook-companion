// Sidebar content search, also available with Cmd+K / Ctrl+K.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { Activity, Blocks, Library, Loader2, Search, Users } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useCoachingContext } from '../hooks/useCoachingContext';
import { Button, EmptyState, Modal } from './ui';
import { searchBlocks, searchTemplates, searchWorkouts } from '../search/contentSearch';
import { searchTeam } from '../search/teamSearch';
import { normalizeSearchText } from '../search/searchUtils';
import { searchScopeKey, startContentSearch, type Searchers, type SearchSnapshot } from '../search/searchRunner';
import type { SearchGroup, SearchItem, SearchTeamScope } from '../search/types';

interface CommandPaletteProps { open: boolean; onClose: () => void; }
const searchers: Searchers = {
    workouts: scope => searchWorkouts(scope.query, scope.userId),
    blocks: scope => searchBlocks(scope.query, scope.userId),
    templates: scope => searchTemplates(scope.query, scope.userId),
    team: scope => searchTeam(scope.query, scope.userId, scope.team),
};
const groupLabels: Record<SearchGroup, string> = {workouts:'Workouts',blocks:'Training blocks',templates:'Templates',team:'Active team'};
const groupIcons = {workouts:Activity, blocks:Blocks, templates:Library, team:Users};
const headingClass = '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-content-muted';

export const CommandPalette: React.FC<CommandPaletteProps> = ({open, onClose}) => open ? <ContentSearch onClose={onClose} /> : null;

function ContentSearch({onClose}: {onClose: () => void}) {
    const navigate = useNavigate();
    const {user, isCoach} = useAuth();
    const {activeTeam, isLoadingTeam} = useCoachingContext();
    const [query, setQuery] = useState('');
    const [retry, setRetry] = useState(0);
    const [snapshot, setSnapshot] = useState<SearchSnapshot>({key:'', groups:{}});
    const input = useRef<HTMLInputElement>(null);
    const team = useMemo<SearchTeamScope | null>(() => activeTeam && !isLoadingTeam ? {
        id:activeTeam.team_id, name:activeTeam.team_name, role:activeTeam.role, orgId:activeTeam.org_id,
        canManage:isCoach && activeTeam.role === 'coach',
    } : null, [activeTeam, isLoadingTeam, isCoach]);
    const scope = useMemo(() => ({query:query.trim(), userId:user?.id ?? '', team}), [query, user?.id, team]);
    const scopeKey = searchScopeKey(scope);
    useEffect(() => startContentSearch(scope, setSnapshot, searchers), [scope, retry]);
    useEffect(() => {
        const frame = requestAnimationFrame(() => input.current?.focus());
        return () => cancelAnimationFrame(frame);
    }, []);
    const hasQuery = Boolean(scope.query);
    // A changed query/identity/team hides every old row before the next effect runs.
    const groups = snapshot.key === scopeKey ? snapshot.groups : {};
    const visibleGroups: SearchGroup[] = team ? ['workouts','blocks','templates','team'] : ['workouts','blocks','templates'];
    const loading = hasQuery && Boolean(scope.userId) && visibleGroups.some(group => groups[group]?.loading !== false);
    const results = visibleGroups.flatMap(group => groups[group]?.result?.items ?? []);
    const hasErrors = visibleGroups.some(group => groups[group]?.result?.error);
    const go = (href: string) => {onClose(); navigate(href);};
    const shortcuts = [
        {label:'Log dashboard', href:'/'}, {label:'Training block', href:'/training-block'},
        {label:'Training library', href:'/library'}, {label:'Strength & mobility', href:'/library/strength-mobility'},
        {label:'Analytics', href:'/analytics'}, {label:'Sync & Concept2 connection', href:'/sync'},
        {label:'Preferences', href:'/preferences'}, {label:'Documentation', href:'/docs'},
        ...(isCoach ? [{label:'Team management',href:'/team-management'}] : []),
        ...(team ? [{label:'My team',href:'/team'}] : []),
    ].filter(item => !hasQuery || normalizeSearchText(item.label).includes(normalizeSearchText(scope.query)));
    return (
        <Modal open onClose={onClose} title="Search your training" size="xl" placement="mobile-sheet" className="!p-0">
            <Command shouldFilter={false} loop label="Search your training" className="overflow-hidden">
                <div className="flex items-center gap-3 px-4 border-b border-border">
                    <Search size={20} className="shrink-0 text-content-muted" aria-hidden="true" />
                    <Command.Input maxLength={200} ref={input} value={query} onValueChange={setQuery} aria-label="Search workouts, training blocks, templates and your active team"
                        placeholder="Search workouts, plans, templates…" className="w-full min-h-12 py-3 bg-transparent text-base text-content-primary placeholder:text-content-muted outline-none" />
                    {query && <Button variant="ghost" size="sm" onClick={() => setQuery('')} aria-label="Clear search" className="min-h-11">Clear</Button>}
                </div>
                <p className="px-4 py-2 text-xs text-content-muted border-b border-border">
                    Your workouts, enrolled blocks and accessible templates{team ? ` · Team: ${team.name}` : isLoadingTeam ? ' · Loading team…' : ''}
                </p>
                <Command.List aria-label="Search results" className="max-h-[55dvh] sm:max-h-[60dvh] overflow-y-auto p-2">
                    {!hasQuery && <p className="px-3 py-4 text-sm text-content-muted">Search by workout name or notation, block session, template, or team item.</p>}
                    {hasQuery && !scope.userId && <EmptyState title="Sign in to search your training" />}
                    {hasQuery && scope.userId && visibleGroups.map(group => {
                        const state = groups[group];
                        const Icon = groupIcons[group];
                        return <Command.Group key={group} heading={groupLabels[group]} className={headingClass}>
                            {(!state || state.loading) && <p className="flex gap-2 items-center px-3 py-3 text-sm text-content-muted" role="status"><Loader2 size={16} className="animate-spin" />Searching…</p>}
                            {state?.result?.error && <p className="px-3 py-2 text-sm text-content-muted" role="status">{state.result.error}</p>}
                            {state?.result?.items.map(item => <SearchResultRow key={item.id} item={item} icon={Icon} onSelect={() => go(item.href)} />)}
                            {state?.result && !state.loading && !state.result.error && !state.result.items.length && <p className="px-3 py-2 text-xs text-content-muted">No matches in {groupLabels[group].toLowerCase()}.</p>}
                            {state?.result?.hasMore && <p className="px-3 py-2 text-xs text-content-muted">More matches available. Add detail to narrow your search.</p>}
                        </Command.Group>;
                    })}
                    {hasQuery && scope.userId && !loading && !results.length && !hasErrors && <EmptyState title="No matching training content" description="Try a shorter name, workout notation, or a different keyword." className="py-5" />}
                    {hasErrors && <div className="px-3 py-2"><Button variant="secondary" size="sm" onClick={() => setRetry(value => value + 1)} className="min-h-11">Retry search</Button></div>}
                    {shortcuts.length > 0 && <Command.Group heading={hasQuery ? 'Pages' : 'Quick links'} className={headingClass}>
                        {shortcuts.map(item => <Command.Item key={item.href} value={`page:${item.href}`} onSelect={() => go(item.href)} className="px-3 min-h-11 flex items-center rounded-lg text-sm text-content-secondary cursor-pointer data-[selected=true]:bg-surface-secondary data-[selected=true]:text-content-primary">{item.label}</Command.Item>)}
                    </Command.Group>}
                </Command.List>
                <div className="px-4 py-2 border-t border-border text-xs text-content-muted" role="status" aria-live="polite">
                    {loading ? 'Searching your training…' : hasQuery ? `${results.length} content results` : '↑ ↓ to move · Enter to open · Esc to close'}
                </div>
            </Command>
        </Modal>
    );
}

export function SearchResultRow({item, icon:Icon, onSelect}: {item:SearchItem; icon: typeof Search; onSelect:()=>void}) {
    return <Command.Item value={item.id} onSelect={onSelect} className="flex items-start gap-3 px-3 py-3 min-h-11 rounded-lg text-content-secondary cursor-pointer select-none data-[selected=true]:bg-surface-secondary data-[selected=true]:text-content-primary transition-colors">
        <Icon size={18} className="mt-0.5 shrink-0 text-content-muted" aria-hidden="true" />
        <span className="min-w-0 flex-1"><span className="block text-sm font-medium break-words">{item.title}</span><span className="block text-xs text-content-muted mt-1 break-words">{item.subtitle}</span></span>
    </Command.Item>;
}
