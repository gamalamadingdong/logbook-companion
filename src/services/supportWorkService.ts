import { supabase } from './supabase';
import type { Database } from '../types/database.types';

export type SupportKind = 'strength' | 'core' | 'mobility' | 'stretching' | 'prehab' | 'recovery';
export type SupportDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type SupportStatus = 'draft' | 'published' | 'archived';

export type SupportExerciseRow = Database['public']['Tables']['support_exercises']['Row'];
export type SupportSessionTemplateRow = Database['public']['Tables']['support_session_templates']['Row'];
export type SupportSessionTemplateExerciseRow = Database['public']['Tables']['support_session_template_exercises']['Row'];

export type SupportTemplateExercise = SupportSessionTemplateExerciseRow & {
    exercise: SupportExerciseRow | null;
};

export type SupportSessionTemplateWithExercises = SupportSessionTemplateRow & {
    exercises: SupportTemplateExercise[];
};

export interface SupportLibrary {
    exercises: SupportExerciseRow[];
    sessionTemplates: SupportSessionTemplateWithExercises[];
}

export interface SaveSupportExerciseInput {
    id?: string;
    userId: string;
    name: string;
    category: SupportKind;
    movementPattern?: string | null;
    equipment?: string[];
    defaultSets?: number | null;
    defaultReps?: string | null;
    defaultDurationSeconds?: number | null;
    cues?: string[];
    contraindications?: string[];
    tags?: string[];
    status?: SupportStatus;
}

export interface SaveSupportTemplateExerciseInput {
    id?: string;
    exerciseId: string;
    sortOrder: number;
    sets?: number | null;
    reps?: string | null;
    durationSeconds?: number | null;
    restSeconds?: number | null;
    loadPrescription?: string | null;
    side?: 'both' | 'left' | 'right' | 'alternating' | 'per_side' | null;
    notes?: string[];
}

export interface SaveSupportSessionTemplateInput {
    id?: string;
    userId: string;
    title: string;
    kind: SupportKind;
    description?: string | null;
    estimatedDurationMinutes?: number | null;
    difficulty?: SupportDifficulty | null;
    focus?: string[];
    instructions?: string[];
    status?: SupportStatus;
    exercises: SaveSupportTemplateExerciseInput[];
}

function slugify(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40) || 'support';
}

function buildPersonalTemplateKey(userId: string, title: string): string {
    return `personal_${userId.replace(/-/g, '').slice(0, 12)}_${slugify(title)}_${Date.now()}`;
}

export async function fetchSupportLibrary(): Promise<SupportLibrary> {
    const [exerciseResult, templateResult] = await Promise.all([
        supabase
            .from('support_exercises')
            .select('*')
            .neq('status', 'archived')
            .order('name', { ascending: true }),
        supabase
            .from('support_session_templates')
            .select('*')
            .neq('status', 'archived')
            .order('title', { ascending: true }),
    ]);

    if (exerciseResult.error) throw exerciseResult.error;
    if (templateResult.error) throw templateResult.error;

    const exercises = exerciseResult.data ?? [];
    const sessionTemplates = templateResult.data ?? [];
    const templateIds = sessionTemplates.map((template) => template.id);

    if (templateIds.length === 0) {
        return { exercises, sessionTemplates: [] };
    }

    const { data: templateExercises, error: templateExercisesError } = await supabase
        .from('support_session_template_exercises')
        .select('*')
        .in('support_session_template_id', templateIds)
        .order('sort_order', { ascending: true });

    if (templateExercisesError) throw templateExercisesError;

    const exercisesById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
    const rowsByTemplateId = new Map<string, SupportTemplateExercise[]>();

    (templateExercises ?? []).forEach((row) => {
        const rows = rowsByTemplateId.get(row.support_session_template_id) ?? [];
        rows.push({
            ...row,
            exercise: exercisesById.get(row.exercise_id) ?? null,
        });
        rowsByTemplateId.set(row.support_session_template_id, rows);
    });

    return {
        exercises,
        sessionTemplates: sessionTemplates.map((template) => ({
            ...template,
            exercises: rowsByTemplateId.get(template.id) ?? [],
        })),
    };
}

export async function saveSupportExercise(input: SaveSupportExerciseInput): Promise<SupportExerciseRow> {
    const payload = {
        user_id: input.userId,
        visibility: 'personal',
        name: input.name.trim(),
        category: input.category,
        movement_pattern: input.movementPattern?.trim() || null,
        equipment: input.equipment ?? [],
        default_sets: input.defaultSets ?? null,
        default_reps: input.defaultReps?.trim() || null,
        default_duration_seconds: input.defaultDurationSeconds ?? null,
        cues: input.cues ?? [],
        contraindications: input.contraindications ?? [],
        tags: input.tags ?? [],
        status: input.status ?? 'published',
        metadata: { source: 'support_work_library_ui' },
    };

    const query = input.id
        ? supabase.from('support_exercises').update(payload).eq('id', input.id).select('*').single()
        : supabase.from('support_exercises').insert(payload).select('*').single();

    const { data, error } = await query;
    if (error) throw error;
    return data;
}

export async function deleteSupportExercise(id: string): Promise<void> {
    const { error } = await supabase.from('support_exercises').delete().eq('id', id);
    if (error) throw error;
}

export async function saveSupportSessionTemplate(
    input: SaveSupportSessionTemplateInput,
): Promise<SupportSessionTemplateWithExercises> {
    const payload = {
        user_id: input.userId,
        visibility: 'personal',
        template_key: input.id ? undefined : buildPersonalTemplateKey(input.userId, input.title),
        title: input.title.trim(),
        kind: input.kind,
        description: input.description?.trim() || null,
        estimated_duration_minutes: input.estimatedDurationMinutes ?? null,
        difficulty: input.difficulty ?? null,
        focus: input.focus ?? [],
        instructions: input.instructions ?? [],
        status: input.status ?? 'published',
        metadata: { source: 'support_work_library_ui' },
    };

    const templateQuery = input.id
        ? supabase
            .from('support_session_templates')
            .update({
                user_id: payload.user_id,
                visibility: payload.visibility,
                title: payload.title,
                kind: payload.kind,
                description: payload.description,
                estimated_duration_minutes: payload.estimated_duration_minutes,
                difficulty: payload.difficulty,
                focus: payload.focus,
                instructions: payload.instructions,
                status: payload.status,
                metadata: payload.metadata,
            })
            .eq('id', input.id)
            .select('*')
            .single()
        : supabase
            .from('support_session_templates')
            .insert({
                user_id: payload.user_id,
                visibility: payload.visibility,
                template_key: payload.template_key ?? buildPersonalTemplateKey(input.userId, input.title),
                title: payload.title,
                kind: payload.kind,
                description: payload.description,
                estimated_duration_minutes: payload.estimated_duration_minutes,
                difficulty: payload.difficulty,
                focus: payload.focus,
                instructions: payload.instructions,
                status: payload.status,
                metadata: payload.metadata,
            })
            .select('*')
            .single();

    const { data: template, error: templateError } = await templateQuery;
    if (templateError) throw templateError;

    const { error: deleteRowsError } = await supabase
        .from('support_session_template_exercises')
        .delete()
        .eq('support_session_template_id', template.id);

    if (deleteRowsError) throw deleteRowsError;

    const exerciseRows = input.exercises
        .filter((exercise) => exercise.exerciseId)
        .map((exercise, index) => ({
            support_session_template_id: template.id,
            exercise_id: exercise.exerciseId,
            sort_order: index + 1,
            sets: exercise.sets ?? null,
            reps: exercise.reps?.trim() || null,
            duration_seconds: exercise.durationSeconds ?? null,
            rest_seconds: exercise.restSeconds ?? null,
            load_prescription: exercise.loadPrescription?.trim() || null,
            side: exercise.side ?? null,
            notes: exercise.notes ?? [],
            metadata: { source: 'support_work_library_ui' },
        }));

    if (exerciseRows.length > 0) {
        const { error: insertRowsError } = await supabase
            .from('support_session_template_exercises')
            .insert(exerciseRows);

        if (insertRowsError) throw insertRowsError;
    }

    const refreshed = await fetchSupportLibrary();
    return refreshed.sessionTemplates.find((candidate) => candidate.id === template.id) ?? {
        ...template,
        exercises: [],
    };
}

export async function deleteSupportSessionTemplate(id: string): Promise<void> {
    const { error } = await supabase.from('support_session_templates').delete().eq('id', id);
    if (error) throw error;
}
