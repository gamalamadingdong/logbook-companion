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

// Steady state: Just Row / Single Distance / Single Time / Single Calories
export interface SteadyStateStructure {
    type: 'steady_state';
    value: number;
    unit: 'meters' | 'seconds' | 'calories';
    target_rate?: number;  // Optional SPM guidance
    target_pace?: string;  // Optional pace guidance
}

// Fixed intervals: Repeating distance/time/calories with time-based rest
export interface IntervalStructure {
    type: 'interval';
    repeats: number;
    work: IntervalStep;
    rest: RestStep; // Rest is always time on PM5
}

// Variable intervals: Complex/mixed patterns (pyramids, ladders, etc.)
export interface VariableStructure {
    type: 'variable';
    steps: WorkoutStep[];
}

// Step within a fixed interval (work duration)
export interface IntervalStep {
    type: 'distance' | 'time' | 'calories'; // PM5 supports all three for work
    value: number; // meters for distance, seconds for time, cals for calories
    target_rate?: number;  // Optional SPM guidance (e.g., 24)
    target_pace?: string;  // Optional pace guidance (e.g., "2:00" or "sub-2:00")
}

// Rest step (PM5 only supports time-based rest)
export interface RestStep {
    type: 'time'; // Rest is always time on PM5
    value: number; // seconds
}

// Individual step in a variable workout
export interface WorkoutStep {
    type: 'work' | 'rest';
    duration_type: 'distance' | 'time' | 'calories'; // Work can be any; rest should be 'time'
    value: number; // meters for distance, seconds for time, cals for calories
    target_rate?: number;  // Optional SPM guidance
    target_pace?: string;  // Optional pace guidance
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
    status: string;
    validated: boolean;
    signature_workout: string | null;
    tags: string[];
    created_at: string;
    updated_at: string;
}

// Subset of fields for list view
export type WorkoutTemplateListItem = Pick<WorkoutTemplate,
    'id' | 'name' | 'workout_type' | 'training_zone' | 'workout_structure' |
    'difficulty_level' | 'validated' | 'status' | 'usage_count'
>;
