import type { WorkoutStructure } from '../types/workoutStructure.types';

export interface ErgLinkWorkoutOptions {
    type: 'fixed_distance' | 'fixed_time' | 'interval_distance' | 'interval_time' | 'variable_interval';
    value?: number;
    split?: number;
    rest?: number;
    repeats?: number;
    intervals?: Array<{
        type: 'distance' | 'time';
        value: number;
        rest?: number;
    }>;
}

/**
 * Adapter: WorkoutStructure -> ErgLink Options
 */
export function adaptForErgLink(structure: WorkoutStructure): ErgLinkWorkoutOptions | null {
    if (!structure) return null;

    // 1. Steady State
    if (structure.type === 'steady_state') {
        if (structure.unit === 'meters') {
            return {
                type: 'fixed_distance',
                value: structure.value,
                split: 500 // Default split
            };
        } else if (structure.unit === 'seconds') {
            return {
                type: 'fixed_time',
                value: structure.value, // seconds
                split: 300 // Default 5min split
            };
        }
        // Calories not typically supported as primary workout type in standard simple set?
        // Actually C2 supports Fixed Calories. erg-link might not support it in 'programWorkout' types yet?
        // Let's fallback or ignoring calories for now.
        return null;
    }

    // 2. Fixed Interval
    if (structure.type === 'interval') {
        const isDist = structure.work.type === 'distance';
        const isTime = structure.work.type === 'time';

        if (isDist) {
            return {
                type: 'interval_distance',
                value: structure.work.value,
                rest: structure.rest.value,
                repeats: structure.repeats
            };
        }
        if (isTime) {
            return {
                type: 'interval_time',
                value: structure.work.value,
                rest: structure.rest.value,
                repeats: structure.repeats
            };
        }
        return null;
    }

    // 3. Variable Interval
    if (structure.type === 'variable') {
        const intervals: ErgLinkWorkoutOptions['intervals'] = [];

        for (let i = 0; i < structure.steps.length; i++) {
            const step = structure.steps[i];

            if (step.type === 'work') {
                const interval = {
                    type: step.duration_type === 'distance' ? 'distance' : 'time' as any,
                    value: step.value,
                    rest: 0
                };

                // Peek ahead for rest
                if (i + 1 < structure.steps.length) {
                    const next = structure.steps[i + 1];
                    if (next.type === 'rest') {
                        interval.rest = next.value;
                        i++; // Skip rest step
                    }
                }

                intervals.push(interval);
            }
        }

        return {
            type: 'variable_interval',
            intervals
        };
    }

    return null;
}
