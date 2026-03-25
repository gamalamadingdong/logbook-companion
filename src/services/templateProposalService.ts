import { supabase } from './supabase';
import type {
    WorkoutTemplate,
    WorkoutTemplateProposal,
    WorkoutTemplateProposalStatus,
    WorkoutTemplateTier,
    WorkoutStructure,
} from '../types/workoutStructure.types';
import { deriveCanonicalNameFromStructure } from '../utils/workoutCanonical';

export interface CreateTemplateProposalInput {
    name: string;
    description: string;
    workout_type: string;
    training_zone?: WorkoutTemplate['training_zone'];
    difficulty_level?: string;
    rwn: string;
    workout_structure: WorkoutStructure;
    notes?: string;
    attribution_name?: string;
    attribution_contact?: string;
}

export async function createTemplateProposal(input: CreateTemplateProposalInput): Promise<WorkoutTemplateProposal> {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
        .from('workout_template_proposals')
        .insert({
            ...input,
            submitted_by_user_id: user?.id ?? null,
            status: 'pending',
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating template proposal:', error);
        throw error;
    }

    return data as WorkoutTemplateProposal;
}

export async function fetchTemplateProposals(status?: WorkoutTemplateProposalStatus): Promise<WorkoutTemplateProposal[]> {
    let query = supabase
        .from('workout_template_proposals')
        .select('*')
        .order('created_at', { ascending: false });

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching template proposals:', error);
        throw error;
    }

    return (data ?? []) as WorkoutTemplateProposal[];
}

export async function updateTemplateProposalStatus(
    id: string,
    updates: Partial<Pick<WorkoutTemplateProposal, 'status' | 'review_notes' | 'duplicate_template_id' | 'promoted_template_id'>> & {
        reviewed?: boolean;
    }
): Promise<WorkoutTemplateProposal> {
    const { data: { user } } = await supabase.auth.getUser();

    const payload: Record<string, unknown> = {
        ...updates,
        updated_at: new Date().toISOString(),
    };

    if (updates.reviewed) {
        payload.reviewed_by = user?.id ?? null;
        payload.reviewed_at = new Date().toISOString();
    }

    delete payload.reviewed;

    const { data, error } = await supabase
        .from('workout_template_proposals')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating template proposal:', error);
        throw error;
    }

    return data as WorkoutTemplateProposal;
}

export async function promoteTemplateProposal(
    proposal: WorkoutTemplateProposal,
    tier: Exclude<WorkoutTemplateTier, 'draft'>,
    reviewNotes?: string
): Promise<{ proposal: WorkoutTemplateProposal; template: WorkoutTemplate }> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('You must be signed in to review proposals');
    }

    const canonicalName = proposal.workout_structure
        ? deriveCanonicalNameFromStructure(proposal.workout_structure)
        : null;

    const { data: templateData, error: templateError } = await supabase
        .from('workout_templates')
        .insert({
            name: proposal.name,
            description: proposal.description,
            workout_type: proposal.workout_type,
            training_zone: proposal.training_zone,
            difficulty_level: proposal.difficulty_level,
            workout_structure: proposal.workout_structure,
            rwn: proposal.rwn,
            canonical_name: canonicalName,
            status: 'published',
            validated: tier === 'standard',
            created_by: user.id,
        })
        .select()
        .single();

    if (templateError) {
        console.error('Error promoting template proposal:', templateError);
        throw templateError;
    }

    const promotedStatus: WorkoutTemplateProposalStatus =
        tier === 'standard' ? 'promoted_standard' : 'promoted_community';

    const updatedProposal = await updateTemplateProposalStatus(proposal.id, {
        status: promotedStatus,
        review_notes: reviewNotes ?? null,
        promoted_template_id: (templateData as WorkoutTemplate).id,
        reviewed: true,
    });

    return {
        proposal: updatedProposal,
        template: templateData as WorkoutTemplate,
    };
}
