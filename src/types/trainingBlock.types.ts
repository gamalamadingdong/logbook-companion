/**
 * Shared types for a local Training Block concept (not written to backend yet).
 * These types are intentionally scoped to phase 1 and are designed to be
 * persisted later when we add DB schemas.
 */

export type TrainingBlockTemplateKey = 'rowing_12_week_2026_v1';

export type TrainingBlockDayCategory = 'erg' | 'cross_training' | 'rest';

export type TrainingBlockSessionSource = 'erg' | 'cross_training' | 'strength' | 'rest';

export type TrainingBlockSessionRole = 'primary' | 'supplemental' | 'warmup' | 'cooldown' | 'strength';

export type TrainingBlockWorkoutFamily =
    | 'mon_8x500'
    | 'mon_pyramid_250_500_750_1000_750_500_250'
    | 'mon_4x1000'
    | 'thu_5x1500'
    | 'mon_hour_of_power'
    | 'mon_30r20'
    | 'mon_cascading_pyramid_3000_2000_1000'
    | 'mon_2x5000'
    | 'mon_final_5000_or_6000'
    | 'thu_4x2000'
    | 'thu_4x1000'
    | 'thu_3000_2500_2000'
    | 'thu_3x2000_controlled'
    | 'thu_hour_of_power'
    | 'thu_cascading_pyramid_3000_2000_1000'
    | 'thu_2x5000'
    | 'thu_final_5000_or_6000'
    | 'steady_45_75min'
    | 'flush_min_3k'
    | 'flush_standard_4to5k'
    | 'flush_full_6k'
    | 'cross_training'
    | 'strength_pull'
    | 'strength_push'
    | 'rest'
    | 'cross_with_optional_row';

export type TrainingBlockWorkoutStatus = 'as_written' | 'modified' | 'swapped' | 'partial' | 'skipped';

export type TrainingBlockKeySessionCredit = 'yes' | 'partial' | 'no' | 'n_a';

export type TrainingBlockStrengthStatus =
    | 'completed'
    | 'modified'
    | 'partial'
    | 'skipped'
    | 'not_scheduled'
    | 'not_started';

export type TrainingBlockWorkoutLogSource = 'concept2' | 'manual';

export interface TrainingBlockIntervalSpec {
    distance_meters?: number;
    duration_seconds?: number;
    repeats?: number;
    rest_seconds?: number;
    split_seconds_per_500m?: number;
}

export interface TrainingBlockPlannedSession {
    id: string;
    title: string;
    planned_rwn: string;
    family: TrainingBlockWorkoutFamily;
    role: TrainingBlockSessionRole;
    source: TrainingBlockSessionSource;
    expected_distance_meters?: number;
    expected_duration_minutes?: number;
    target_split_seconds_per_500m?: number;
    intervals?: readonly TrainingBlockIntervalSpec[];
    instructions?: readonly string[];
    counts_toward_weekly_volume?: boolean;
    is_key_session?: boolean;
}

export interface TrainingBlockReferenceExercise {
    name: string;
    sets: number;
    reps: string;
    notes?: string;
}

export interface TrainingBlockReferenceRoutine {
    kind: 'pull' | 'push';
    focus: string[];
    exercises?: readonly TrainingBlockReferenceExercise[];
    notes?: string[];
}

export interface TrainingBlockReferenceContent {
    warmup: readonly string[];
    core: readonly string[];
    stretching: readonly string[];
    routines: readonly TrainingBlockReferenceRoutine[];
}

export interface TrainingBlockPlannedDay {
    date: string;
    week_number: number;
    day_of_week: string;
    weekday_index: number;
    day_slot: number;
    category: TrainingBlockDayCategory;
    sessions: readonly TrainingBlockPlannedSession[];
    planned_distance_meters: number;
    target_distance_meters: number;
    reference?: TrainingBlockReferenceContent;
}

export interface TrainingBlockPlan {
    template_id: TrainingBlockTemplateKey;
    start_date: string;
    end_date: string;
    duration_weeks: number;
    days: readonly TrainingBlockPlannedDay[];
}

export interface TrainingBlockWeekTarget {
    week_number: number;
    target_distance_meters: number;
}

export interface TrainingBlockActualLogEvent {
    workout_id: string;
    date: string;
    source: TrainingBlockWorkoutLogSource;
    planned_week_number?: number;
    planned_day_slot?: number;
    planned_day_key?: string;
    distance_meters?: number | null;
    duration_seconds?: number | null;
    perceived_exertion?: number | null;
    workout_name?: string | null;
    workout_type?: string | null;
    status?: TrainingBlockWorkoutStatus;
    key_session_credit?: TrainingBlockKeySessionCredit;
    strength_status?: TrainingBlockStrengthStatus;
    notes?: string | null;
}

export interface TrainingBlockDaySummary {
    planned_day_slot?: number;
    date: string;
    week_number: number;
    category: TrainingBlockDayCategory;
    planned_distance_meters: number;
    actual_distance_meters: number;
    status: TrainingBlockWorkoutStatus;
    key_session_credit: TrainingBlockKeySessionCredit;
    strength_status: TrainingBlockStrengthStatus;
    training_load: number | null;
    logged_session_count: number;
}

export interface TrainingBlockWeekSummary {
    week_number: number;
    planned_distance_meters: number;
    target_distance_meters: number;
    actual_distance_meters: number;
    target_coverage_ratio: number;
    delta_to_target_meters: number;
    key_session_credits: {
        possible: number;
        earned: number;
        partial: number;
    };
    key_session_complete: boolean;
    day_summaries: readonly TrainingBlockDaySummary[];
}
