import { supabase } from './supabase';
import type {
    LibraryAiSearchParams,
    LibraryAiSearchResponse,
    PublicWorkoutTemplateDetail,
    TemplateReferenceStats,
    WorkoutTemplate,
    WorkoutTemplateListItem,
    WorkoutStructure,
} from '../types/workoutStructure.types';
import {
    buildLibraryAiTemplateSummary,
    buildPublicWorkoutTemplateDetail,
    getLibraryTemplateTier,
    type LibraryTemplateSourceRecord,
} from '../lib/libraryTemplateDto';
import { deriveCanonicalNameFromStructure } from '../utils/workoutCanonical';

export interface TemplateFilters {
    workoutType?: string;
    trainingZone?: string;
    hasStructure?: boolean;
    status?: string;
    search?: string;
    sortBy?: 'popular' | 'recent';
}

const PUBLIC_TEMPLATE_LIST_COLUMNS = 'id, name, canonical_name, workout_type, training_zone, workout_structure, difficulty_level, validated, status, usage_count, last_used_at';
const PUBLIC_TEMPLATE_DETAIL_COLUMNS = 'id, name, description, workout_type, training_zone, workout_category, workout_structure, technique_focus, coaching_points, pacing_guidance, estimated_duration, difficulty_level, usage_count, completion_rate, average_rating, rating_count, last_used_at, status, validated, rwn, canonical_name, tags, created_at, updated_at';
const AI_TEMPLATE_SEARCH_COLUMNS = 'id, name, description, workout_type, training_zone, workout_category, workout_structure, technique_focus, coaching_points, pacing_guidance, estimated_duration, difficulty_level, usage_count, completion_rate, average_rating, rating_count, last_used_at, status, validated, rwn, canonical_name, tags, created_at, updated_at';

function clampLimit(limit?: number): number {
    if (!Number.isFinite(limit)) return 25;
    return Math.min(Math.max(Math.trunc(limit ?? 25), 1), 50);
}

function normalizeOffset(offset?: number): number {
    if (!Number.isFinite(offset)) return 0;
    return Math.max(Math.trunc(offset ?? 0), 0);
}

/**
 * Fetch workout templates with optional filters
 */
export async function fetchTemplates(filters: TemplateFilters = {}): Promise<WorkoutTemplateListItem[]> {
    let query = supabase
        .from('workout_templates')
        .select(PUBLIC_TEMPLATE_LIST_COLUMNS);

    // Apply sorting based on sortBy parameter
    if (filters.sortBy === 'recent') {
        query = query.order('last_used_at', { ascending: false, nullsFirst: false })
            .order('name', { ascending: true });
    } else {
        // Default to 'popular' sorting
        query = query.order('usage_count', { ascending: false })
            .order('name', { ascending: true });
    }

    // Default to 'erg' type (rowing workouts)
    if (filters.workoutType) {
        query = query.eq('workout_type', filters.workoutType);
    }

    if (filters.trainingZone) {
        query = query.eq('training_zone', filters.trainingZone);
    }

    if (filters.status) {
        query = query.eq('status', filters.status);
    }

    if (filters.search) {
        query = query.ilike('name', `%${filters.search}%`);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching templates:', error);
        throw error;
    }

    // Post-filter for hasStructure (can't do IS NULL / IS NOT NULL easily with .eq)
    let results = data as WorkoutTemplateListItem[];
    if (filters.hasStructure !== undefined) {
        results = results.filter(t =>
            filters.hasStructure ? t.workout_structure !== null : t.workout_structure === null
        );
    }

    return results;
}

/**
 * Fetch a single template by ID
 */
export async function fetchTemplateById(id: string): Promise<WorkoutTemplate | null> {
    const { data, error } = await supabase
        .from('workout_templates')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching template:', error);
        return null;
    }

    return data as WorkoutTemplate;
}

export async function fetchPublicTemplateById(id: string): Promise<LibraryTemplateSourceRecord | null> {
    const { data, error } = await supabase
        .from('workout_templates')
        .select(PUBLIC_TEMPLATE_DETAIL_COLUMNS)
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching public template:', error);
        return null;
    }

    return data as LibraryTemplateSourceRecord;
}

export async function fetchOwnedTemplateIds(templateIds: string[], userId: string): Promise<string[]> {
    if (templateIds.length === 0 || !userId) {
        return [];
    }

    const { data, error } = await supabase
        .from('workout_templates')
        .select('id')
        .in('id', templateIds)
        .eq('created_by', userId);

    if (error) {
        console.error('Error fetching owned templates:', error);
        return [];
    }

    return (data ?? []).map(template => template.id);
}

export function getWorkoutTemplateTier(template: Pick<WorkoutTemplate, 'status' | 'validated'>): 'draft' | 'community' | 'standard' {
    return getLibraryTemplateTier(template as Pick<LibraryTemplateSourceRecord, 'status' | 'validated'>);
}

export async function fetchPublicTemplateDetail(id: string): Promise<PublicWorkoutTemplateDetail | null> {
    const [template, referenceStats] = await Promise.all([
        fetchPublicTemplateById(id),
        getTemplateReferenceStats(id).catch(error => {
            console.error('Failed to load template reference stats:', error);
            return {
                groupAssignmentCount: 0,
                planWorkoutCount: 0,
                dailyAssignmentCount: 0,
            } satisfies TemplateReferenceStats;
        }),
    ]);

    if (!template) {
        return null;
    }

    return {
        ...buildPublicWorkoutTemplateDetail(template as LibraryTemplateSourceRecord, referenceStats),
    };
}

export async function fetchLibraryAiTemplateSearch(
    filters: LibraryAiSearchParams = {},
): Promise<LibraryAiSearchResponse> {
    const limit = clampLimit(filters.limit);
    const offset = normalizeOffset(filters.offset);

    let query = supabase
        .from('workout_templates')
        .select(AI_TEMPLATE_SEARCH_COLUMNS, { count: 'exact' })
        .eq('status', 'published');

    if (filters.workout_type) {
        query = query.eq('workout_type', filters.workout_type);
    }

    if (filters.training_zone) {
        query = query.eq('training_zone', filters.training_zone);
    }

    if (filters.difficulty_level) {
        query = query.eq('difficulty_level', filters.difficulty_level);
    }

    if (filters.tier === 'standard') {
        query = query.eq('validated', true);
    } else if (filters.tier === 'community') {
        query = query.eq('validated', false);
    }

    if (Number.isFinite(filters.duration_min)) {
        query = query.gte('estimated_duration', filters.duration_min ?? 0);
    }

    if (Number.isFinite(filters.duration_max)) {
        query = query.lte('estimated_duration', filters.duration_max ?? 0);
    }

    if (filters.search?.trim()) {
        const escaped = filters.search.trim().replaceAll(',', '\\,');
        query = query.or(`name.ilike.%${escaped}%,description.ilike.%${escaped}%,canonical_name.ilike.%${escaped}%`);
    }

    query = filters.sort === 'recent'
        ? query.order('last_used_at', { ascending: false, nullsFirst: false }).order('name', { ascending: true })
        : query.order('usage_count', { ascending: false }).order('name', { ascending: true });

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
        console.error('Error fetching AI template search results:', error);
        throw error;
    }

    const templates = (data ?? []) as LibraryTemplateSourceRecord[];
    const items = await Promise.all(
        templates.map(async (template) => {
            const referenceStats = await getTemplateReferenceStats(template.id).catch(searchError => {
                console.error('Failed to load AI template reference stats:', searchError);
                return {
                    groupAssignmentCount: 0,
                    planWorkoutCount: 0,
                    dailyAssignmentCount: 0,
                } satisfies TemplateReferenceStats;
            });

            return buildLibraryAiTemplateSummary(template, referenceStats);
        }),
    );

    return {
        items,
        total: count ?? 0,
        limit,
        offset,
    };
}

/**
 * Update a template's structure and metadata
 */
export async function updateTemplate(
    id: string,
    updates: Partial<Pick<WorkoutTemplate, 'name' | 'description' | 'workout_type' | 'training_zone' | 'workout_structure' | 'is_test' | 'validated' | 'status'>>
): Promise<WorkoutTemplate | null> {
    // Compute canonical_name from structure if provided
    const canonical_name = updates.workout_structure
        ? deriveCanonicalNameFromStructure(updates.workout_structure)
        : undefined;

    const { data, error } = await supabase
        .from('workout_templates')
        .update({
            ...updates,
            ...(canonical_name !== undefined && { canonical_name }),
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating template:', error);
        throw error;
    }

    return data as WorkoutTemplate;
}

export async function promoteTemplateToStandard(id: string): Promise<WorkoutTemplate | null> {
    return updateTemplate(id, {
        status: 'published',
        validated: true,
    });
}

/**
 * Create a new template
 */
export async function createTemplate(
    template: Pick<WorkoutTemplate, 'name' | 'description' | 'workout_type'> &
        Partial<Pick<WorkoutTemplate, 'training_zone' | 'workout_structure' | 'difficulty_level' | 'is_test'>>
): Promise<WorkoutTemplate> {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('You must be logged in to create templates');
    }

    // Compute canonical_name from structure
    const canonical_name = template.workout_structure
        ? deriveCanonicalNameFromStructure(template.workout_structure)
        : null;

    const { data, error } = await supabase
        .from('workout_templates')
        .insert({
            ...template,
            canonical_name,
            created_by: user.id,
            status: 'draft',
            validated: false
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating template:', error);
        throw error;
    }

    return data as WorkoutTemplate;
}

/**
 * Delete a template
 */
export async function deleteTemplate(id: string): Promise<void> {
    const { error } = await supabase
        .from('workout_templates')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting template:', error);
        throw error;
    }
}

/**
 * Check if a template with identical workout_structure already exists
 */
export async function findDuplicateTemplate(
    workoutStructure: WorkoutStructure,
    excludeId?: string
): Promise<WorkoutTemplate | null> {
    if (!workoutStructure) return null;

    let query = supabase
        .from('workout_templates')
        .select('*');

    // Exclude current template if editing
    if (excludeId) {
        query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error checking for duplicates:', error);
        return null;
    }

    if (!data || data.length === 0) return null;

    // Find exact JSON match
    const structureStr = JSON.stringify(workoutStructure);
    const duplicate = data.find(t =>
        t.workout_structure && JSON.stringify(t.workout_structure) === structureStr
    );

    return duplicate || null;
}

export interface TemplateHistoryItem {
    id: string;
    completed_at: string;
    distance_meters: number;
    duration_seconds: number;
    average_stroke_rate: number;
    watts: number | null;
}

/**
 * Fetch workout history for a specific template
 */
export async function getTemplateHistory(templateId: string, userId: string): Promise<TemplateHistoryItem[]> {
    if (!templateId || !userId) return [];

    // Query workout logs linked to this template
    // Note: workout_logs stores time in deciseconds
    // We want the most recent ones first
    const { data, error } = await supabase
        .from('workout_logs')
        .select('id, completed_at, distance_meters, duration_seconds, average_stroke_rate, watts')
        .eq('template_id', templateId)
        .eq('user_id', userId)
        .order('completed_at', { ascending: true }); // Ascending for chart

    if (error) {
        console.error('Error fetching template history:', error);
        return [];
    }

    return data || [];
}

export type PersonalBest = TemplateHistoryItem & {
    // Additional fields if needed, but TemplateHistoryItem has what we need
};

/**
 * Fetch the personal best (highest watts) for a template
 */
export async function getTemplatePersonalBest(templateId: string, userId: string): Promise<PersonalBest | null> {
    if (!templateId || !userId) return null;

    const { data, error } = await supabase
        .from('workout_logs')
        .select('id, completed_at, distance_meters, duration_seconds, average_stroke_rate, watts')
        .eq('template_id', templateId)
        .eq('user_id', userId)
        .order('watts', { ascending: false })
        .order('completed_at', { ascending: true }) // First time achieved is the tie-breaker
        .limit(1)
        .single();

    if (error) {
        // PGRST116 is "JSON object returned null" (no rows found for .single())
        if (error.code !== 'PGRST116') {
            console.error('Error fetching personal best:', error);
        }
        return null;
    }

    return data as PersonalBest;
}

export async function getTemplateReferenceStats(templateId: string): Promise<TemplateReferenceStats> {
    const [
        groupAssignmentsResult,
        planWorkoutsResult,
        originalAssignmentsResult,
        substitutedAssignmentsResult,
    ] = await Promise.all([
        supabase
            .from('group_assignments')
            .select('id', { count: 'exact', head: true })
            .eq('template_id', templateId),
        supabase
            .from('plan_workouts')
            .select('id', { count: 'exact', head: true })
            .eq('workout_template_id', templateId),
        supabase
            .from('daily_workout_assignments')
            .select('id', { count: 'exact', head: true })
            .eq('original_template_id', templateId),
        supabase
            .from('daily_workout_assignments')
            .select('id', { count: 'exact', head: true })
            .eq('substituted_template_id', templateId),
    ]);

    const errors = [
        groupAssignmentsResult.error,
        planWorkoutsResult.error,
        originalAssignmentsResult.error,
        substitutedAssignmentsResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
        console.error('Error fetching template reference stats:', errors);
        throw errors[0];
    }

    return {
        groupAssignmentCount: groupAssignmentsResult.count ?? 0,
        planWorkoutCount: planWorkoutsResult.count ?? 0,
        dailyAssignmentCount: (originalAssignmentsResult.count ?? 0) + (substitutedAssignmentsResult.count ?? 0),
    };
}
