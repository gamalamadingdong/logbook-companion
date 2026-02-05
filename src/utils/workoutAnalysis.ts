import type { WorkoutStructure, WorkoutStep } from '../types/workoutStructure.types';

/**
 * flattens a nested workout structure into a linear list of steps
 */
export function flattenWorkoutSteps(structure: WorkoutStructure): WorkoutStep[] {
    if (structure.type === 'steady_state') {
        return [{
            type: 'work',
            modality: structure.modality,
            duration_type: structure.unit === 'seconds' ? 'time' : (structure.unit === 'meters' ? 'distance' : 'calories'),
            value: structure.value,
            target_rate: structure.target_rate,
            target_rate_max: structure.target_rate_max,
            target_pace: structure.target_pace,
            target_pace_max: structure.target_pace_max,
            blockType: structure.blockType,
            tags: structure.tags
        }];
    }

    if (structure.type === 'interval') {
        const steps: WorkoutStep[] = [];
        for (let i = 0; i < structure.repeats; i++) {
            steps.push({
                type: 'work',
                modality: structure.modality,
                duration_type: structure.work.type,
                value: structure.work.value,
                target_rate: structure.work.target_rate,
                target_rate_max: structure.work.target_rate_max,
                target_pace: structure.work.target_pace,
                target_pace_max: structure.work.target_pace_max,
                blockType: structure.work.blockType,
                tags: structure.work.tags
            });
            steps.push({
                type: 'rest',
                duration_type: 'time',
                value: structure.rest.value
            });
        }
        return steps;
    }

    // Variable
    if (structure.type === 'variable') {
        return structure.steps;
    }

    return [];
}

/**
 * Extracts the "main block" of a workout, filtering out warmup and cooldown steps.
 * This is useful for analyzing performance stats on the core part of the workout.
 */
export function getMainBlock(structure: WorkoutStructure): WorkoutStep[] {
    // If the top-level structure is explicitly marked as non-main, return empty
    if (structure.type === 'steady_state' && structure.blockType && structure.blockType !== 'main') {
        return [];
    }

    // Flatten and filter steps
    return flattenWorkoutSteps(structure).filter(step => {
        const type = step.blockType;
        return (!type || type === 'main') && step.type === 'work';
    });
}

/**
 * Checks if a workout has any warmup or cooldown blocks
 */
export function hasAuxiliaryBlocks(structure: WorkoutStructure): boolean {
    const steps = flattenWorkoutSteps(structure);
    return steps.some(s => s.blockType === 'warmup' || s.blockType === 'cooldown');
}

/**
 * Returns the indices of the intervals that belong to the "main block".
 * These indices correspond to the array returned by structureToIntervals().
 */
export function getMainBlockIndices(structure: WorkoutStructure): number[] {
    const indices: number[] = [];
    let currentIndex = 0;

    if (structure.type === 'steady_state') {
        const isMain = !structure.blockType || structure.blockType === 'main';
        if (isMain) indices.push(0);
        return indices;
    }

    if (structure.type === 'interval') {
        const isMain = !structure.work?.blockType || structure.work.blockType === 'main';
        for (let i = 0; i < structure.repeats; i++) {
            if (isMain) indices.push(currentIndex);
            currentIndex++;
        }
        return indices;
    }

    if (structure.type === 'variable') {
        structure.steps.forEach(step => {
            if (step.type === 'work') {
                const isMain = !step.blockType || step.blockType === 'main';
                if (isMain) indices.push(currentIndex);
                currentIndex++;
            }
            // Rest steps don't increment index, they attach to previous interval in vector
        });
        return indices;
    }

    return indices;
}
