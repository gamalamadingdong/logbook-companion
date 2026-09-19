import type { WorkoutStep, WorkoutStructure } from './types';

export type Pm5TranslationMode = 'exact' | 'prompt_only' | 'unsupported';
/** @deprecated Use Pm5TranslationMode. */
export type Pm5LoweringMode = Pm5TranslationMode;

export interface Pm5WorkoutInterval {
    type: 'distance' | 'time' | 'rest';
    value: number;
    rest?: number;
}

export interface Pm5WorkoutSpec {
    _v: 1;
    type: 'just_row' | 'fixed_distance' | 'fixed_time' | 'interval_distance' | 'interval_time' | 'variable_interval';
    value?: number;
    split_value?: number;
    rest?: number;
    repeats?: number;
    intervals?: Pm5WorkoutInterval[];
}

export interface Pm5TranslationResult {
    mode: Pm5TranslationMode;
    workout: Pm5WorkoutSpec | null;
    notes: string[];
}

/** @deprecated Use Pm5TranslationResult. */
export type Pm5LoweringResult = Pm5TranslationResult;

const unsupported = (...notes: string[]): Pm5TranslationResult => ({
    mode: 'unsupported',
    workout: null,
    notes,
});

const toVariableIntervalStep = (step: WorkoutStep): Pm5WorkoutInterval | null => {
    if (step.type === 'rest') {
        return step.duration_type === 'time' ? { type: 'rest', value: step.value } : null;
    }
    if (step.duration_type === 'distance' || step.duration_type === 'time') {
        return { type: step.duration_type, value: step.value };
    }
    return null;
};

const buildBaseWorkout = (structure: WorkoutStructure): Pm5TranslationResult => {
    if (structure.type === 'steady_state') {
        if (structure.unit === 'meters') {
            return { mode: 'exact', workout: { _v: 1, type: 'fixed_distance', value: structure.value }, notes: [] };
        }
        if (structure.unit === 'seconds') {
            return { mode: 'exact', workout: { _v: 1, type: 'fixed_time', value: structure.value }, notes: [] };
        }
        return unsupported('PM5 translation does not currently support calorie-based steady-state workouts.');
    }

    if (structure.type === 'interval') {
        if (structure.work.type === 'distance') {
            return {
                mode: 'exact',
                workout: {
                    _v: 1,
                    type: 'interval_distance',
                    split_value: structure.work.value,
                    rest: structure.rest.value,
                    repeats: structure.repeats,
                },
                notes: [],
            };
        }
        if (structure.work.type === 'time') {
            return {
                mode: 'exact',
                workout: {
                    _v: 1,
                    type: 'interval_time',
                    split_value: structure.work.value,
                    rest: structure.rest.value,
                    repeats: structure.repeats,
                },
                notes: [],
            };
        }
        return unsupported('PM5 translation does not currently support calorie-based interval work steps.');
    }

    const intervals = structure.steps.map(toVariableIntervalStep);
    if (intervals.some((step) => step === null)) {
        return unsupported('PM5 translation does not currently support calorie-based steps in variable workouts.');
    }
    return {
        mode: 'exact',
        workout: { _v: 1, type: 'variable_interval', intervals: intervals as Pm5WorkoutInterval[] },
        notes: [],
    };
};

export const translateWorkoutToPm5 = (structure: WorkoutStructure): Pm5TranslationResult => {
    const base = buildBaseWorkout(structure);
    if (base.mode === 'unsupported') return base;
    const notes: string[] = [];
    if (structure.type === 'interval') {
        notes.push(`PM5 fixed-interval mode repeats until stopped; complete ${structure.repeats} reps.`);
        if (structure.work.target_rate || structure.work.target_rate_max || structure.work.target_pace || structure.work.target_pace_max) {
            notes.push('PM5 programming does not yet apply the RWN rate/pace guidance.');
        }
    } else if (structure.type === 'steady_state') {
        if (structure.target_rate || structure.target_rate_max || structure.target_pace || structure.target_pace_max) {
            notes.push('PM5 programming does not yet apply the RWN rate/pace guidance.');
        }
    } else if (structure.steps.some((step) => step.target_rate || step.target_rate_max || step.target_pace || step.target_pace_max)) {
        notes.push('PM5 programming does not yet apply the RWN rate/pace guidance.');
    }
    if (structure.sessionExtension) {
        notes.push(`Session extension '${structure.sessionExtension.kind}' requires coach/athlete prompts and is not PM5-native.`);
    }
    if (notes.length === 0) return base;
    return {
        mode: 'prompt_only',
        workout: base.workout,
        notes,
    };
};

/** @deprecated Use translateWorkoutToPm5. */
export const lowerWorkoutStructureToPm5 = translateWorkoutToPm5;