import { supabase } from './supabase';
import type { WorkoutTemplate, WorkoutTemplateListItem } from '../types/workoutStructure.types';

export interface TemplateFilters {
    workoutType?: string;
    trainingZone?: string;
    hasStructure?: boolean;
    status?: string;
    search?: string;
}

/**
 * Fetch workout templates with optional filters
 */
export async function fetchTemplates(filters: TemplateFilters = {}): Promise<WorkoutTemplateListItem[]> {
    let query = supabase
        .from('workout_templates')
        .select('id, name, workout_type, training_zone, workout_structure, difficulty_level, validated, status, usage_count')
        .order('name', { ascending: true });

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
    updates: Partial<Pick<WorkoutTemplate, 'name' | 'description' | 'workout_type' | 'training_zone' | 'workout_structure' | 'validated'>>
): Promise<WorkoutTemplate | null> {
    const { data, error } = await supabase
        .from('workout_templates')
        .update({
            ...updates,
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
        Partial<Pick<WorkoutTemplate, 'training_zone' | 'workout_structure' | 'difficulty_level'>>
): Promise<WorkoutTemplate> {
    const { data, error } = await supabase
        .from('workout_templates')
        .insert({
            ...template,
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
