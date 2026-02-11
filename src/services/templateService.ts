import { supabase } from './supabase';
import type { WorkoutTemplate, WorkoutTemplateListItem, WorkoutStructure } from '../types/workoutStructure.types';
import { computeCanonicalName } from '../utils/structureAdapter';

export interface TemplateFilters {
    workoutType?: string;
    trainingZone?: string;
    hasStructure?: boolean;
    status?: string;
    search?: string;
    sortBy?: 'popular' | 'recent';
}

/**
 * Fetch workout templates with optional filters
 */
export async function fetchTemplates(filters: TemplateFilters = {}): Promise<WorkoutTemplateListItem[]> {
    let query = supabase
        .from('workout_templates')
        .select('id, name, canonical_name, workout_type, training_zone, workout_structure, difficulty_level, validated, status, usage_count, last_used_at');

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

/**
 * Update a template's structure and metadata
 */
export async function updateTemplate(
    id: string,
    updates: Partial<Pick<WorkoutTemplate, 'name' | 'description' | 'workout_type' | 'training_zone' | 'workout_structure' | 'is_test'>>
): Promise<WorkoutTemplate | null> {
    // Compute canonical_name from structure if provided
    const canonical_name = updates.workout_structure
        ? computeCanonicalName(updates.workout_structure) || null
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
        ? computeCanonicalName(template.workout_structure) || null
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
