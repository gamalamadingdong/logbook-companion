import { addDays, format, parseISO } from 'date-fns';
import { supabase } from '../services/supabase';
import { formatWorkoutDurationSeconds, workoutService } from '../services/workoutService';
import { applySearchTerms, rankSearchItems, SEARCH_CANDIDATE_LIMIT } from './searchUtils';
import type { SearchGroupResult, SearchItem } from './types';

const empty = (): SearchGroupResult => ({items: [], hasMore: false});
const dateLabel = (date: string) => {
    const parsed = parseISO(date);
    return Number.isNaN(parsed.getTime()) ? date : format(parsed, 'MMM d, yyyy');
};
const text = (...values: Array<string | null | undefined>) => values.filter(Boolean).join(' · ');

export async function searchWorkouts(query: string, userId: string): Promise<SearchGroupResult> {
    if (!userId || !query.trim()) return empty();
    const {data, error} = await applySearchTerms(supabase.from('workout_logs')
        .select('id, workout_name, canonical_name, manual_rwn, completed_at, distance_meters, duration_seconds, duration_minutes')
        .eq('user_id', userId).in('source', [...workoutService.viewableSources]), ['workout_name', 'canonical_name', 'manual_rwn'], query)
        .order('completed_at', {ascending: false}).limit(SEARCH_CANDIDATE_LIMIT + 1);
    if (error) throw error;
    const rows = data ?? [];
    const result = rankSearchItems(rows.map(row => ({
        id: `workout:${row.id}`, group: 'workouts', title: row.canonical_name || row.workout_name || 'Completed workout',
        keywords: text(row.workout_name, row.canonical_name, row.manual_rwn),
        subtitle: text(dateLabel(row.completed_at), row.distance_meters == null ? null : `${row.distance_meters.toLocaleString('en-US')} m`, formatWorkoutDurationSeconds(row.duration_seconds, row.duration_minutes)),
        date: row.completed_at, href: `/workout/${row.id}`,
    })), query);
    return {...result, hasMore: result.hasMore || rows.length > SEARCH_CANDIDATE_LIMIT};
}

export async function searchTemplates(query: string, userId: string): Promise<SearchGroupResult> {
    if (!userId || !query.trim()) return empty();
    const results = await Promise.allSettled([
        applySearchTerms(supabase.from('workout_templates').select('id, name, canonical_name, rwn, description, training_zone, workout_type')
            .neq('status', 'archived'), ['name', 'canonical_name', 'rwn', 'description'], query)
            .order('name').limit(SEARCH_CANDIDATE_LIMIT + 1).then(({data,error}) => {
                if (error) throw error;
                return data ?? [];
            }),
        applySearchTerms(supabase.from('support_session_templates').select('id, title, description, kind, estimated_duration_minutes')
            .neq('status', 'archived'), ['title', 'description', 'kind'], query)
            .order('title').limit(SEARCH_CANDIDATE_LIMIT + 1).then(({data,error}) => {
                if (error) throw error;
                return data ?? [];
            }),
    ]);
    const items: SearchItem[] = [];
    const errors: string[] = [];
    const workoutResult = results[0];
    const supportResult = results[1];
    if (workoutResult.status === 'fulfilled') {
        items.push(...workoutResult.value.map(row => ({id: `template:${row.id}`, group: 'templates' as const,
            title: row.name, keywords: text(row.canonical_name, row.rwn, row.description),
            subtitle: text('Workout template', row.rwn || row.canonical_name, row.training_zone), href: `/library/${row.id}`})));
    } else errors.push('Workout templates could not be searched.');
    if (supportResult.status === 'fulfilled') {
        items.push(...supportResult.value.map(row => ({id: `support:${row.id}`, group: 'templates' as const,
            title: row.title, keywords: text(row.description, row.kind),
            subtitle: text('Support template', row.kind, row.estimated_duration_minutes == null ? null : `${row.estimated_duration_minutes} min`),
            href: `/library/strength-mobility?template=${encodeURIComponent(row.id)}`})));
    } else errors.push('Support templates could not be searched.');
    const ranked = rankSearchItems(items, query);
    return {...ranked, hasMore: ranked.hasMore || results.some(result => result.status === 'fulfilled' && result.value.length > SEARCH_CANDIDATE_LIMIT), error: errors.length ? errors.join(' ') : undefined};
}

export async function searchBlocks(query: string, userId: string): Promise<SearchGroupResult> {
    if (!userId || !query.trim()) return empty();
    // Enrollment rows are lightweight; fetch only personal blocks, never another athlete's plan.
    const {data: enrollments, error: enrollmentError} = await supabase.from('training_block_enrollments')
        .select('id, template_id, template_key, start_date, status, is_active')
        .eq('user_id', userId).is('team_id', null).is('org_id', null).neq('status', 'archived')
        .order('is_active', {ascending: false}).order('start_date', {ascending: false}).limit(SEARCH_CANDIDATE_LIMIT + 1);
    if (enrollmentError) throw enrollmentError;
    if (!enrollments?.length) return empty();
    const {data: templates, error: templateError} = await supabase.from('training_block_templates')
        .select('id, template_key, name, description').in('template_key', [...new Set(enrollments.map(row => row.template_key))]);
    if (templateError) throw templateError;
    if (!templates?.length) return empty();
    const {data: days, error: dayError} = await supabase.from('training_block_template_days')
        .select('id, template_id, week_number, day_slot').in('template_id', templates.map(row => row.id));
    if (dayError) throw dayError;
    const items: SearchItem[] = [];
    for (const enrollment of enrollments) {
        const template = templates.find(row => row.template_key === enrollment.template_key);
        if (!template) continue;
        items.push({id: `block:${enrollment.id}`, group:'blocks', title:template.name,
            keywords: text(template.description, enrollment.status), subtitle:text('Training block', enrollment.status, `Starts ${dateLabel(enrollment.start_date)}`),
            date:enrollment.start_date, href:`/training-block?enrollment=${encodeURIComponent(enrollment.id)}`});
    }
    let sessionCount = 0;
    let sessionErrorMessage: string | undefined;
    if (days?.length) {
        const {data: sessions, error: sessionError} = await applySearchTerms(supabase.from('training_block_template_sessions')
            .select('id, template_day_id, session_key, title, planned_rwn, source, instructions')
            .in('template_day_id', days.map(row => row.id)), ['title', 'planned_rwn', 'source'], query)
            .order('sort_order').limit(SEARCH_CANDIDATE_LIMIT + 1);
        if (sessionError) sessionErrorMessage = 'Planned sessions could not be searched.';
        else {
            sessionCount = sessions?.length ?? 0;
            for (const session of sessions ?? []) {
                const day = days.find(row => row.id === session.template_day_id);
                const template = templates.find(row => row.id === day?.template_id);
                if (!day || !template) continue;
                for (const enrollment of enrollments.filter(row => row.template_key === template.template_key)) {
                    const date = format(addDays(parseISO(enrollment.start_date), (day.week_number - 1) * 7 + day.day_slot), 'yyyy-MM-dd');
                    const params = new URLSearchParams({enrollment:enrollment.id, date, session:session.session_key});
                    items.push({id:`session:${enrollment.id}:${session.id}`, group:'blocks', title:session.title,
                        keywords: text(session.planned_rwn, session.source, template.name, ...(session.instructions ?? [])),
                        subtitle:text(template.name, `Week ${day.week_number}`, dateLabel(date), session.planned_rwn || session.source),
                        date, href:`/training-block?${params}`});
                }
            }
        }
    }
    const ranked = rankSearchItems(items, query);
    return {...ranked, hasMore:ranked.hasMore || sessionCount > SEARCH_CANDIDATE_LIMIT || enrollments.length > SEARCH_CANDIDATE_LIMIT, error:sessionErrorMessage};
}
