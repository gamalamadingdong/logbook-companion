import type {
    LibraryAiTemplateSummary,
    PublicWorkoutTemplateDetail,
    TemplateReferenceStats,
    WorkoutStructure,
    WorkoutTemplateTier,
} from '../types/workoutStructure.types';
import { structureToWhiteboard } from '../utils/structureToWhiteboard';

export interface LibraryTemplateSourceRecord {
    id: string;
    name: string;
    description: string;
    workout_type: string;
    training_zone: 'UT2' | 'UT1' | 'AT' | 'TR' | 'AN' | null;
    workout_category: string | null;
    workout_structure: WorkoutStructure | null;
    technique_focus: string[] | null;
    coaching_points: string[] | null;
    pacing_guidance: string | null;
    estimated_duration: number | null;
    difficulty_level: string;
    usage_count: number;
    completion_rate: number;
    average_rating: number;
    rating_count: number;
    last_used_at: string | null;
    status: string;
    validated: boolean;
    rwn: string | null;
    canonical_name: string | null;
    tags: string[];
    created_at: string;
    updated_at: string;
}

export function getLibraryTemplateTier(template: Pick<LibraryTemplateSourceRecord, 'status' | 'validated'>): WorkoutTemplateTier {
    if (template.status !== 'published') {
        return 'draft';
    }

    return template.validated ? 'standard' : 'community';
}

export function getPublishedLibraryTemplateTier(
    template: Pick<LibraryTemplateSourceRecord, 'status' | 'validated'>,
): Exclude<WorkoutTemplateTier, 'draft'> {
    return template.validated ? 'standard' : 'community';
}

export function buildWhiteboardLines(workoutStructure: WorkoutStructure | null, rwn: string | null): string[] {
    if (workoutStructure) {
        return structureToWhiteboard(workoutStructure);
    }

    return rwn ? [rwn] : [];
}

export function buildPublicWorkoutTemplateDetail(
    template: LibraryTemplateSourceRecord,
    referenceStats: TemplateReferenceStats,
): PublicWorkoutTemplateDetail {
    return {
        ...template,
        tier: getLibraryTemplateTier(template),
        whiteboard_lines: buildWhiteboardLines(template.workout_structure, template.rwn),
        reference_stats: referenceStats,
    };
}

export function buildLibraryAiTemplateSummary(
    template: LibraryTemplateSourceRecord,
    referenceStats: TemplateReferenceStats,
): LibraryAiTemplateSummary {
    const whiteboardLines = buildWhiteboardLines(template.workout_structure, template.rwn);

    return {
        id: template.id,
        name: template.name,
        description: template.description,
        workout_type: template.workout_type,
        training_zone: template.training_zone,
        difficulty_level: template.difficulty_level,
        estimated_duration: template.estimated_duration,
        validated: template.validated,
        tier: getPublishedLibraryTemplateTier(template),
        rwn: template.rwn,
        canonical_name: template.canonical_name,
        whiteboard_preview: whiteboardLines.slice(0, 3),
        usage_count: template.usage_count,
        last_used_at: template.last_used_at,
        reference_stats: referenceStats,
        tags: template.tags,
    };
}
