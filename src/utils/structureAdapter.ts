/**
 * Structure to Intervals Adapter
 * 
 * Converts the new workout_structure JSON into C2-style intervals array
 * for use with calculateCanonicalName().
 */

import type { WorkoutStructure } from '../types/workoutStructure.types';
import type { C2Interval } from '../api/concept2.types';

/**
 * Convert a WorkoutStructure to an array of C2Interval objects.
 * This allows us to reuse calculateCanonicalName() for templates.
 */
export function structureToIntervals(structure: WorkoutStructure): C2Interval[] {
    if (!structure) return [];

    if (structure.type === 'steady_state') {
        // Single interval based on unit
        const interval: C2Interval = {
            type: structure.unit === 'seconds' ? 'time' : 'distance',
            distance: structure.unit === 'meters' ? structure.value : 0,
            time: structure.unit === 'seconds' ? structure.value * 10 : 0, // C2 uses deciseconds
            stroke_rate: 0,
            rest_time: 0,
            calories_total: structure.unit === 'calories' ? structure.value : 0
        };
        return [interval];
    }

    if (structure.type === 'interval') {
        // Fixed repeating intervals
        const intervals: C2Interval[] = [];
        const restDeciSeconds = structure.rest.value * 10; // Convert seconds to deciseconds

        for (let i = 0; i < structure.repeats; i++) {
            // Work interval
            intervals.push({
                type: structure.work.type,
                distance: structure.work.type === 'distance' ? structure.work.value : 0,
                time: structure.work.type === 'time' ? structure.work.value * 10 : 0,
                stroke_rate: 0,
                rest_time: restDeciSeconds,
                calories_total: structure.work.type === 'calories' ? structure.work.value : 0
            });
        }
        return intervals;
    }

    if (structure.type === 'variable') {
        // Variable/mixed intervals
        const intervals: C2Interval[] = [];
        let lastRestTime = 0;

        for (const step of structure.steps) {
            if (step.type === 'rest') {
                // Attach rest to previous work interval
                lastRestTime = step.value * 10; // deciseconds
                if (intervals.length > 0) {
                    intervals[intervals.length - 1].rest_time = lastRestTime;
                }
            } else {
                // Work interval
                intervals.push({
                    type: step.duration_type,
                    distance: step.duration_type === 'distance' ? step.value : 0,
                    time: step.duration_type === 'time' ? step.value * 10 : 0,
                    stroke_rate: 0,
                    rest_time: 0,
                    calories_total: step.duration_type === 'calories' ? step.value : 0
                });
            }
        }
        return intervals;
    }

    return [];
}
