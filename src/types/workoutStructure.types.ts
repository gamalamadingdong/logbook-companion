/**
 * Workout Structure Types
 * 
 * These types define the machine-readable workout structure that can be
 * programmed into PM5 and used by erg-link.
 */

// Main discriminated union for workout structures
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

// Block type for semantic workout segments (moved before usage)
export type BlockType = 'warmup' | 'cooldown' | 'test' | 'main';

// Steady state: Just Row / Single Distance / Single Time / Single Calories
export interface SteadyStateStructure {
    type: 'steady_state';
    modality?: 'row' | 'bike' | 'ski' | 'run' | 'other';
    value: number;
    unit: 'meters' | 'seconds' | 'calories';
    target_rate?: number;      // Optional SPM guidance (min if range)
    target_rate_max?: number;  // If present, target_rate is min, this is max
    target_pace?: string;      // Optional pace guidance (min if range)
    target_pace_max?: string;  // If present, target_pace is min, this is max
    blockType?: BlockType;     // Semantic block type (warmup, cooldown, test, main)
    tags?: string[];           // Legacy inline tags (prefer blockType)
    sessionExtension?: SessionExtension;
    splitValue?: number;       // PM5 split resolution (meters or seconds)
    splitUnit?: 'meters' | 'seconds';
    subSegments?: WorkoutStep[]; // Sub-segment breakdown (e.g., 2000m[500m@r22 + 500m@r24 ...])
}

// Fixed intervals: Repeating distance/time/calories with time-based rest
export interface IntervalStructure {
    type: 'interval';
    modality?: 'row' | 'bike' | 'ski' | 'run' | 'other';
    repeats: number;
    work: IntervalStep;
    rest: RestStep; // Rest is always time on PM5
    tags?: string[];
    sessionExtension?: SessionExtension;
}

// Variable intervals: Complex/mixed patterns (pyramids, ladders, etc.)
export interface VariableStructure {
    type: 'variable';
    modality?: 'row' | 'bike' | 'ski' | 'run' | 'other';
    steps: WorkoutStep[];
    tags?: string[];
    sessionExtension?: SessionExtension;
}

// Step within a fixed interval (work duration)
export interface IntervalStep {
    type: 'distance' | 'time' | 'calories'; // PM5 supports all three for work
    value: number; // meters for distance, seconds for time, cals for calories
    target_rate?: number;      // Optional SPM guidance (min if range)
    target_rate_max?: number;  // If present, target_rate is min, this is max
    target_pace?: string;      // Optional pace guidance (min if range)
    target_pace_max?: string;  // If present, target_pace is min, this is max
    blockType?: BlockType;     // Semantic block type (warmup, cooldown, test, main)
    tags?: string[];           // Legacy inline tags (prefer blockType)
}

// Rest step (PM5 only supports time-based rest)
export interface RestStep {
    type: 'time'; // Rest is always time on PM5
    value: number; // seconds
}

// Individual step in a variable workout
export interface WorkoutStep {
    type: 'work' | 'rest';
    modality?: 'row' | 'bike' | 'ski' | 'run' | 'other';
    duration_type: 'distance' | 'time' | 'calories'; // Work can be any; rest should be 'time'
    value: number; // meters for distance, seconds for time, cals for calories
    target_rate?: number;      // Optional SPM guidance (min if range)
    target_rate_max?: number;  // If present, target_rate is min, this is max
    target_pace?: string;      // Optional pace guidance (min if range)
    target_pace_max?: string;  // If present, target_pace is min, this is max
    blockType?: BlockType;     // Semantic block type (warmup, cooldown, test, main)
    tags?: string[];           // Legacy inline tags (prefer blockType)
}

// Helper type for workout template from database
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
    'difficulty_level' | 'validated' | 'status' | 'usage_count' | 'canonical_name' | 'created_by'
>;
