/**
 * Structure to Intervals Adapter
 * 
 * Converts the new workout_structure JSON into C2-style intervals array
 * for use with calculateCanonicalName().
 */

import type { WorkoutStructure } from '../types/workoutStructure.types';
import type { C2Interval } from '../api/concept2.types';
import { getMainBlock } from './workoutAnalysis';
import { calculateCanonicalName } from './workoutNaming';

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

/**
 * Convert only the main-block work steps of a WorkoutStructure to C2Interval objects.
 * Strips warmup ([w]) and cooldown ([c]) blocks before conversion.
 * Use this for canonical name generation and template matching.
 */
export function mainBlockToIntervals(structure: WorkoutStructure): C2Interval[] {
    const mainSteps = getMainBlock(structure);
    
    // If no explicit block types are set, all steps are main — use full conversion
    if (mainSteps.length === 0) {
        return structureToIntervals(structure);
    }
    
    // Convert main-block WorkoutSteps to C2Interval format
    const intervals: C2Interval[] = [];
    
    for (let i = 0; i < mainSteps.length; i++) {
        const step = mainSteps[i];
        if (step.type !== 'work') continue;
        
        intervals.push({
            type: step.duration_type || 'distance',
            distance: step.duration_type === 'distance' ? step.value : 0,
            time: step.duration_type === 'time' ? step.value * 10 : 0, // C2 deciseconds
            stroke_rate: 0,
            rest_time: 0,
            calories_total: step.duration_type === 'calories' ? step.value : 0
        });
    }
    
    // Attach rest times from the original structure's pattern
    // For interval types, all work pieces share the same rest
    if (structure.type === 'interval' && intervals.length > 0) {
        const restDeciSeconds = structure.rest.value * 10;
        intervals.forEach(interval => {
            interval.rest_time = restDeciSeconds;
        });
    }
    
    // For variable types, reconstruct rest from step sequence
    if (structure.type === 'variable') {
        let intervalIdx = 0;
        for (let i = 0; i < structure.steps.length; i++) {
            const step = structure.steps[i];
            if (step.type === 'work') {
                const isMain = !step.blockType || step.blockType === 'main';
                if (isMain) intervalIdx++;
            } else if (step.type === 'rest' && intervalIdx > 0 && intervalIdx <= intervals.length) {
                // Only attach rest if previous work step was main
                const prevStep = structure.steps[i - 1];
                if (prevStep?.type === 'work' && (!prevStep.blockType || prevStep.blockType === 'main')) {
                    intervals[intervalIdx - 1].rest_time = step.value * 10;
                }
            }
        }
    }
    
    return intervals;
}

/**
 * Compute the normalized canonical name for a WorkoutStructure.
 * Uses only main-block intervals (strips warmup/cooldown).
 * This is the canonical name that should be stored on templates.
 */
export function computeCanonicalName(structure: WorkoutStructure): string {
    const intervals = mainBlockToIntervals(structure);
    if (intervals.length === 0) return '';
    return calculateCanonicalName(intervals);
}
