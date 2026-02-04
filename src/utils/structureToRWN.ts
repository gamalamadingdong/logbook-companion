/**
 * Convert WorkoutStructure to canonical RWN string
 * This is the "trinity" regeneration function: Structure → RWN
 */

import type { WorkoutStructure, BlockType, IntervalStructure, VariableStructure } from '../types/workoutStructure.types';

// Helper: Format block tag prefix from blockType
function getBlockTagPrefix(step: { blockType?: BlockType }): string {
    if (step.blockType === 'warmup') return '[w]';
    if (step.blockType === 'cooldown') return '[c]';
    if (step.blockType === 'test') return '[t]';
    return '';
}

function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${mins}:00`;
}

export function structureToRWN(structure: WorkoutStructure): string {
    if (!structure) {
        return '';
    }

    if (structure.type === 'steady_state') {
        const steadyStruct = structure as unknown as { blockType?: BlockType; value: number; unit: string; zone?: string };
        const prefix = getBlockTagPrefix(steadyStruct);
        
        if (steadyStruct.unit === 'meters') {
            const zone = steadyStruct.zone ? `@${steadyStruct.zone}` : '';
            return `${prefix}${steadyStruct.value}m${zone}`;
        } else {
            const zone = steadyStruct.zone ? `@${steadyStruct.zone}` : '';
            return `${prefix}${formatTime(steadyStruct.value)}${zone}`;
        }
    }

    if (structure.type === 'interval') {
        const intervalStruct = structure as IntervalStructure;
        const prefix = getBlockTagPrefix(intervalStruct.work as unknown as { blockType?: BlockType });
        
        const workPart = intervalStruct.work.type === 'distance'
            ? `${intervalStruct.work.value}m`
            : formatTime(intervalStruct.work.value);
        
        // Rest is always time-based on PM5
        const restPart = formatTime(intervalStruct.rest.value);
        
        return `${prefix}${intervalStruct.repeats}x${workPart}/${restPart}r`;
    }

    if (structure.type === 'variable') {
        const varStruct = structure as VariableStructure;
        const parts: string[] = [];
        let currentPrefix = '';
        
        for (let i = 0; i < varStruct.steps.length; i++) {
            const step = varStruct.steps[i];
            const stepPrefix = getBlockTagPrefix(step);
            
            if (step.type === 'work') {
                let workStr = step.duration_type === 'distance'
                    ? `${step.value}m`
                    : formatTime(step.value);
                
                // Only add prefix if it changed from previous block
                if (stepPrefix && stepPrefix !== currentPrefix) {
                    workStr = stepPrefix + workStr;
                    currentPrefix = stepPrefix;
                }
                
                // Check if next step is rest to form "work/rest" pair
                if (i + 1 < varStruct.steps.length && varStruct.steps[i + 1].type === 'rest') {
                    const restStep = varStruct.steps[i + 1];
                    const restStr = restStep.duration_type === 'distance'
                        ? `${restStep.value}m`
                        : formatTime(restStep.value);
                    parts.push(`${workStr}/${restStr}r`);
                    i++; // Skip the rest step since we consumed it
                } else {
                    parts.push(workStr);
                }
            } else if (step.type === 'rest') {
                // Standalone rest (not part of work/rest pair)
                const restStr = step.duration_type === 'distance'
                    ? `${step.value}m`
                    : formatTime(step.value);
                parts.push(`${restStr}r`);
            }
        }
        
        return parts.join(' + ');
    }

    return '';
}
