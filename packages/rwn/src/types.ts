/**
 * RWN Workout Structure Types
 *
 * These types define the machine-readable workout structure produced by the
 * RWN parser and consumed by serializers, renderers, and erg programming tools.
 */

export type WorkoutModality = 'row' | 'bike' | 'ski' | 'run' | 'cross' | 'other';

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

// Block type for semantic workout segments
export type BlockType = 'warmup' | 'cooldown' | 'test' | 'main';

// Steady state: Just Row / Single Distance / Single Time / Single Calories
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

// Fixed intervals: Repeating distance/time/calories with time-based rest
export interface IntervalStructure {
    type: 'interval';
    modality?: WorkoutModality;
    repeats: number;
    work: IntervalStep;
    rest: RestStep;
    tags?: string[];
    sessionExtension?: SessionExtension;
}

// Variable intervals: Complex/mixed patterns (pyramids, ladders, etc.)
export interface VariableStructure {
    type: 'variable';
    modality?: WorkoutModality;
    steps: WorkoutStep[];
    tags?: string[];
    sessionExtension?: SessionExtension;
}

// Step within a fixed interval (work duration)
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

// Rest step (always time-based)
export interface RestStep {
    type: 'time';
    value: number;
}

// Individual step in a variable workout
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
