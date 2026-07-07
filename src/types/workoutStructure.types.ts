/**
 * Workout Structure Types
 *
 * These are the app-facing RWN types. Keep them aligned with packages/rwn until
 * the local package is wired as a workspace dependency.
 */

export type WorkoutModality = 'row' | 'bike' | 'ski' | 'run' | 'cross' | 'other';

export type WorkoutStructure =
    | SteadyStateStructure
    | IntervalStructure
    | VariableStructure;

export interface SessionExtension {
    kind: 'partner' | 'relay' | 'rotate' | 'circuit';
    switch?: string;
    on?: string;
    off?: string;
    leg?: number;
    total?: number;
    team_size?: number;
    order?: string;
    off_task?: string;
    stations?: number;
    rounds?: number;
    plan?: string[];
    items?: string[];
}

export type BlockType = 'warmup' | 'cooldown' | 'test' | 'main';

export interface SteadyStateStructure {
    type: 'steady_state';
    modality?: WorkoutModality;
    value: number;
    unit: 'meters' | 'seconds' | 'calories';
    target_rate?: number;
    target_rate_max?: number;
    target_pace?: string;
    target_pace_max?: string;
    blockType?: BlockType;
    tags?: string[];
    sessionExtension?: SessionExtension;
    splitValue?: number;
    splitUnit?: 'meters' | 'seconds';
    subSegments?: WorkoutStep[];
    description?: string;
}

export interface IntervalStructure {
    type: 'interval';
    modality?: WorkoutModality;
    repeats: number;
    work: IntervalStep;
    rest: RestStep;
    tags?: string[];
    sessionExtension?: SessionExtension;
}

export interface VariableStructure {
    type: 'variable';
    modality?: WorkoutModality;
    steps: WorkoutStep[];
    tags?: string[];
    sessionExtension?: SessionExtension;
    description?: string;
}

export interface IntervalStep {
    type: 'distance' | 'time' | 'calories';
    value: number;
    target_rate?: number;
    target_rate_max?: number;
    target_pace?: string;
    target_pace_max?: string;
    blockType?: BlockType;
    tags?: string[];
    description?: string;
}

export interface RestStep {
    type: 'time';
    value: number;
}

export interface WorkoutStep {
    type: 'work' | 'rest';
    modality?: WorkoutModality;
    duration_type: 'distance' | 'time' | 'calories';
    value: number;
    target_rate?: number;
    target_rate_max?: number;
    target_pace?: string;
    target_pace_max?: string;
    blockType?: BlockType;
    tags?: string[];
    description?: string;
}

// ── App-Specific Types (not part of the RWN package) ──────────────────────
export interface WorkoutTemplate {
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
    distance: number | null;
    difficulty_level: string;
    is_steady_state: boolean;
    is_test: boolean;
    is_interval: boolean;
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
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export type WorkoutTemplateTier = 'draft' | 'community' | 'standard';

export interface TemplateReferenceStats {
    groupAssignmentCount: number;
    planWorkoutCount: number;
    dailyAssignmentCount: number;
}

export interface PublicWorkoutTemplateDetail {
    id: string;
    name: string;
    description: string;
    workout_type: string;
    training_zone: 'UT2' | 'UT1' | 'AT' | 'TR' | 'AN' | null;
    workout_category: string | null;
    workout_structure: WorkoutStructure | null;
    whiteboard_lines: string[];
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
    tier: WorkoutTemplateTier;
    rwn: string | null;
    canonical_name: string | null;
    tags: string[];
    created_at: string;
    updated_at: string;
    reference_stats: TemplateReferenceStats;
}

export interface LibraryAiTemplateSummary {
    id: string;
    name: string;
    description: string;
    workout_type: string;
    training_zone: 'UT2' | 'UT1' | 'AT' | 'TR' | 'AN' | null;
    difficulty_level: string;
    estimated_duration: number | null;
    validated: boolean;
    tier: Exclude<WorkoutTemplateTier, 'draft'>;
    rwn: string | null;
    canonical_name: string | null;
    whiteboard_preview: string[];
    usage_count: number;
    last_used_at: string | null;
    reference_stats: TemplateReferenceStats;
    tags: string[];
}

/**
 * Internal authenticated retrieval contract for AI and plan-building surfaces.
 * This stays intentionally narrower than raw `workout_templates` rows.
 */
export interface LibraryAiSearchParams {
    search?: string;
    workout_type?: string;
    training_zone?: 'UT2' | 'UT1' | 'AT' | 'TR' | 'AN';
    difficulty_level?: string;
    tier?: Exclude<WorkoutTemplateTier, 'draft'>;
    duration_min?: number;
    duration_max?: number;
    sort?: 'popular' | 'recent';
    limit?: number;
    offset?: number;
}

/**
 * Search payload returned by the authenticated library-search edge function.
 */
export interface LibraryAiSearchResponse {
    items: LibraryAiTemplateSummary[];
    total: number;
    limit: number;
    offset: number;
}

export type WorkoutTemplateProposalStatus =
    | 'pending'
    | 'under_review'
    | 'promoted_standard'
    | 'promoted_community'
    | 'rejected'
    | 'duplicate';

export interface WorkoutTemplateProposal {
    id: string;
    name: string;
    description: string;
    workout_type: string;
    training_zone: 'UT2' | 'UT1' | 'AT' | 'TR' | 'AN' | null;
    difficulty_level: string;
    rwn: string;
    workout_structure: WorkoutStructure | null;
    notes: string | null;
    attribution_name: string | null;
    attribution_contact: string | null;
    submitted_by_user_id: string | null;
    status: WorkoutTemplateProposalStatus;
    admin_notified_at: string | null;
    review_notes: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    promoted_template_id: string | null;
    duplicate_template_id: string | null;
    created_at: string;
    updated_at: string;
}

// Subset of fields for list view
export type WorkoutTemplateListItem = Pick<WorkoutTemplate,
    'id' | 'name' | 'workout_type' | 'training_zone' | 'workout_structure' |
    'difficulty_level' | 'validated' | 'status' | 'usage_count' | 'canonical_name'
>;
