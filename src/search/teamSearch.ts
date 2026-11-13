import { supabase } from '../services/supabase';
import { applySearchTerms, literalSearchPattern, normalizeSearchText, rankSearchItems } from './searchUtils';
import type { SearchGroupResult, SearchItem, SearchTeamScope } from './types';

const CANDIDATE_LIMIT = 40;
const TEMPLATE_COLUMNS = 'name, canonical_name, rwn';
const ASSIGNMENT_COLUMNS = `id, title, instructions, workout_templates (${TEMPLATE_COLUMNS})`;
interface TemplateSummary { name: string; canonical_name: string | null; rwn: string | null }
interface AssignmentSummary {
    id: string;
    title: string | null;
    instructions: string | null;
    workout_templates: TemplateSummary | null;
}
interface MemberAssignment {
    id: string;
    workout_date: string;
    completed: boolean | null;
    group_assignments: AssignmentSummary | null;
}
interface GroupAssignment extends AssignmentSummary { scheduled_date: string }
interface SessionSummary { id: string; date: string; type: string; focus: string | null }
interface AthleteSummary {
    id: string;
    first_name: string;
    last_name: string;
    team_athletes: Array<{ squad: string | null }>;
}

function assignmentTitle(assignment: AssignmentSummary | null): string {
    return assignment?.title || assignment?.workout_templates?.name || assignment?.workout_templates?.canonical_name || 'Team workout';
}
function assignmentKeywords(assignment: AssignmentSummary | null): string {
    return [assignment?.instructions, assignment?.workout_templates?.name, assignment?.workout_templates?.canonical_name, assignment?.workout_templates?.rwn].filter(Boolean).join(' ');
}
function assignmentFilter(query: string, templateIds: string[]): string {
    const pattern = JSON.stringify(literalSearchPattern(query));
    return [`title.ilike.${pattern}`, `instructions.ilike.${pattern}`, ...(templateIds.length ? [`template_id.in.(${templateIds.join(',')})`] : [])].join(',');
}

/** Authenticated, selected-team reads only; every source has its own bounded query. */
export async function searchTeam(query: string, userId: string, team: SearchTeamScope | null): Promise<SearchGroupResult> {
    if (!userId || !team?.id || !query.trim()) return { items: [], hasMore: false };
    const canManage = team.canManage && team.role === 'coach';
    const terms = normalizeSearchText(query).split(' ').filter(Boolean).slice(0, 12);
    const templateIdsByTerm = new Map<string, string[]>();
    let templateLookupTruncated = false;
    const templateLookups = await Promise.allSettled(terms.map(async (term) => {
        const request = applySearchTerms(supabase.from('workout_templates').select('id'), ['name', 'canonical_name', 'rwn'], term);
        const { data, error } = await request.order('id').limit(CANDIDATE_LIMIT);
        if (error) throw error;
        const ids = (data ?? []).map((row) => row.id);
        templateIdsByTerm.set(term, ids);
        templateLookupTruncated ||= ids.length === CANDIDATE_LIMIT;
    }));
    const templateLookupFailed = templateLookups.some((result) => result.status === 'rejected');
    const ownedGroupIds = new Set<string>();
    const sources: Array<{ label: string; load: () => Promise<SearchItem[]> }> = [
        {
            label: 'team workouts',
            load: async () => {
                let request = supabase.from('group_assignments').select(`${ASSIGNMENT_COLUMNS}, scheduled_date`);
                request = team.orgId
                    ? request.or(`team_id.eq.${team.id},and(team_id.is.null,org_id.eq.${team.orgId})`)
                    : request.eq('team_id', team.id);
                for (const term of terms) request = request.or(assignmentFilter(term, templateIdsByTerm.get(term) ?? []));
                const { data, error } = await request.order('scheduled_date', { ascending: false }).limit(CANDIDATE_LIMIT);
                if (error) throw error;
                return ((data ?? []) as unknown as GroupAssignment[]).map((row) => ({
                    id: `group-assignment:${row.id}`, group: 'team', title: assignmentTitle(row),
                    subtitle: `${team.name} · Team workout · ${row.scheduled_date}`,
                    keywords: assignmentKeywords(row), date: row.scheduled_date,
                    href: canManage ? `/team-management/assignments/${row.id}/results` : `/team/search/group-assignment/${row.id}`,
                }));
            },
        },
        {
            label: 'sessions',
            load: async () => {
                const request = applySearchTerms(supabase.from('coaching_sessions')
                    .select('id, date, type, focus').eq('team_id', team.id), ['focus', 'type'], query);
                const { data, error } = await request.order('date', { ascending: false }).limit(CANDIDATE_LIMIT);
                if (error) throw error;
                return ((data ?? []) as SessionSummary[]).map((row) => ({
                    id: `session:${row.id}`, group: 'team', title: row.focus || `${row.type} session`,
                    subtitle: `${team.name} · ${row.type} session · ${row.date}`,
                    keywords: row.type, date: row.date,
                    href: canManage ? `/team-management/schedule?sessionId=${encodeURIComponent(row.id)}` : `/team/search/session/${row.id}`,
                }));
            },
        },
    ];
    if (!canManage) sources.push(
        {
            label: 'assignments',
            load: async () => {
                let request = supabase.from('daily_workout_assignments')
                    .select(`id, workout_date, completed, group_assignments!inner (${ASSIGNMENT_COLUMNS})`)
                    .eq('user_id', userId)
                    .eq('team_id', team.id);
                for (const term of terms) request = request.or(assignmentFilter(term, templateIdsByTerm.get(term) ?? []), { referencedTable: 'group_assignments' });
                const { data, error } = await request.order('workout_date', { ascending: false }).limit(CANDIDATE_LIMIT);
                if (error) throw error;
                return ((data ?? []) as unknown as MemberAssignment[]).map((row) => {
                    if (row.group_assignments?.id) ownedGroupIds.add(row.group_assignments.id);
                    return {
                        id: `assignment:${row.id}`, group: 'team', title: assignmentTitle(row.group_assignments),
                        subtitle: `${team.name} · ${row.completed ? 'Completed assignment' : 'Assigned workout'} · ${row.workout_date}`,
                        keywords: assignmentKeywords(row.group_assignments), date: row.workout_date,
                        href: `/team/search/assignment/${row.id}`,
                    };
                });
            },
        }
    );
    if (canManage) sources.push({
        label: 'athletes',
        load: async () => {
            const request = applySearchTerms(supabase.from('athletes')
                .select('id, first_name, last_name, team_athletes!inner (squad)')
                .eq('team_athletes.team_id', team.id), ['first_name', 'last_name'], query);
            const { data, error } = await request.order('last_name').limit(CANDIDATE_LIMIT);
            if (error) throw error;
            return ((data ?? []) as unknown as AthleteSummary[]).map((row) => ({
                id: `athlete:${row.id}`, group: 'team', title: `${row.first_name} ${row.last_name}`.trim(),
                subtitle: [team.name, 'Athlete', row.team_athletes[0]?.squad].filter(Boolean).join(' · '),
                href: `/team-management/roster/${row.id}`,
            }));
        },
    });
    const results = await Promise.allSettled(sources.map((source) => source.load()));
    const items: SearchItem[] = [];
    const failures: string[] = [];
    let truncated = templateLookupTruncated;
    results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            items.push(...result.value);
            truncated ||= result.value.length === CANDIDATE_LIMIT;
        } else failures.push(sources[index].label);
    });
    const ranked = rankSearchItems(items.filter((item) => !item.id.startsWith('group-assignment:') || !ownedGroupIds.has(item.id.slice('group-assignment:'.length))), query);
    const warnings = [
        ...(failures.length ? [`Could not search team ${failures.join(' and ')}. Try again.`] : []),
        ...(templateLookupFailed ? ['Some assignment template matches could not be searched. Try again.'] : []),
    ];
    return { ...ranked, hasMore: ranked.hasMore || truncated, ...(warnings.length ? { error: warnings.join(' ') } : {}) };
}

export interface TeamSearchDetail {
    title: string;
    date: string;
    type: string;
    description: string | null;
    notation: string | null;
    completed?: boolean;
}

/** Repeat ownership/team restrictions at the destination, never trust search UI state. */
export async function loadTeamSearchDetail(kind: string, id: string, userId: string, teamId: string, orgId?: string | null): Promise<TeamSearchDetail | null> {
    if (!userId || !teamId || !id) return null;
    if (kind === 'assignment') {
        const { data, error } = await supabase.from('daily_workout_assignments')
            .select(`id, workout_date, completed, group_assignments!inner (${ASSIGNMENT_COLUMNS})`)
            .eq('id', id)
            .eq('user_id', userId)
            .eq('team_id', teamId)
            .maybeSingle();
        if (error) throw error;
        if (!data) return null;
        const row = data as unknown as MemberAssignment;
        return { title: assignmentTitle(row.group_assignments), date: row.workout_date, type: 'Assigned workout',
            description: row.group_assignments?.instructions ?? null,
            notation: row.group_assignments?.workout_templates?.rwn ?? row.group_assignments?.workout_templates?.canonical_name ?? null,
            completed: row.completed ?? false };
    }
    if (kind === 'group-assignment') {
        let request = supabase.from('group_assignments').select(`${ASSIGNMENT_COLUMNS}, scheduled_date`).eq('id', id);
        request = orgId
            ? request.or(`team_id.eq.${teamId},and(team_id.is.null,org_id.eq.${orgId})`)
            : request.eq('team_id', teamId);
        const { data, error } = await request.maybeSingle();
        if (error) throw error;
        if (!data) return null;
        const row = data as unknown as GroupAssignment;
        return { title: assignmentTitle(row), date: row.scheduled_date, type: 'Team workout',
            description: row.instructions, notation: row.workout_templates?.rwn ?? row.workout_templates?.canonical_name ?? null };
    }
    if (kind === 'session') {
        const { data, error } = await supabase.from('coaching_sessions')
            .select('id, date, type, focus')
            .eq('id', id)
            .eq('team_id', teamId)
            .maybeSingle();
        if (error) throw error;
        if (!data) return null;
        return { title: data.focus || `${data.type} session`, date: data.date, type: `${data.type} session`, description: null, notation: null };
    }
    return null;
}
