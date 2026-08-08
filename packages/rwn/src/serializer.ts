/**
 * Convert WorkoutStructure to canonical RWN string
 * This is the "trinity" regeneration function: Structure → RWN
 */

import type { WorkoutStructure, BlockType, IntervalStructure, VariableStructure, SessionExtension } from './types';

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

function formatDistance(meters: number): string {
    return `${meters}m`;
}

function formatCalories(calories: number): string {
    return `${calories}c`;
}

function formatDuration(value: number, type?: string): string {
    if (type === 'distance') return formatDistance(value);
    if (type === 'calories') return formatCalories(value);
    return formatTime(value);
}

function formatOptionalDuration(value: number | undefined, type?: string): string | null {
    if (typeof value !== 'number') return null;
    return formatDuration(value, type);
}

function formatModalityPrefix(modality?: WorkoutStructure['modality']): string {
    if (!modality || modality === 'row') return '';
    return `${modality.charAt(0).toUpperCase()}${modality.slice(1)}: `;
}

function formatGuidance(step: {
    target_rate?: number;
    target_rate_max?: number;
    target_pace?: string;
    target_pace_max?: string;
}): string {
    const parts: string[] = [];
    if (step.target_pace) {
        parts.push(step.target_pace_max ? `${step.target_pace}..${step.target_pace_max}` : step.target_pace);
    }
    if (step.target_rate) {
        parts.push(step.target_rate_max ? `r${step.target_rate}..${step.target_rate_max}` : `r${step.target_rate}`);
    }
    return parts.map((part) => `@${part}`).join('');
}

// Serialize a SessionExtension back to orchestration syntax
function serializeSessionExtension(ext: SessionExtension, coreRWN: string): string {
    switch (ext.kind) {
        case 'partner': {
            const parts: string[] = [];
            parts.push(`on=${ext.on ?? coreRWN}`);
            if (ext.off && ext.off !== 'wait') parts.push(`off=${ext.off}`);
            if (ext.switch && ext.switch !== 'piece_end') parts.push(`switch=${ext.switch}`);
            return `partner(${parts.join(', ')})`;
        }
        case 'relay': {
            const parts: string[] = [];
            if (ext.leg) parts.push(`leg=${formatDistance(ext.leg)}`);
            if (ext.total) parts.push(`total=${formatDistance(ext.total)}`);
            if (ext.team_size) parts.push(`team_size=${ext.team_size}`);
            if (ext.order && ext.order !== 'round_robin') parts.push(`order=${ext.order}`);
            if (ext.off_task && ext.off_task !== 'wait') parts.push(`off_task=${ext.off_task}`);
            return `relay(${parts.join(', ')})`;
        }
        case 'rotate': {
            const parts: string[] = [];
            if (ext.stations) parts.push(`stations=${ext.stations}`);
            if (ext.switch) parts.push(`switch=${ext.switch}`);
            if (ext.rounds) parts.push(`rounds=${ext.rounds}`);
            if (ext.plan && ext.plan.length > 0) parts.push(`plan=[${ext.plan.join(',')}]`);
            return `rotate(${parts.join(', ')})`;
        }
        case 'circuit': {
            const items = ext.items ?? [];
            return `circuit(${items.join(', ')})`;
        }
        default:
            return coreRWN;
    }
}

export function structureToRWN(structure: WorkoutStructure): string {
    if (!structure) {
        return '';
    }

    // Build core RWN first, then wrap with orchestration if needed
    const coreRWN = structureToCoreRWN(structure);

    if (structure.sessionExtension) {
        return serializeSessionExtension(structure.sessionExtension, coreRWN);
    }

    const modalityPrefix = formatModalityPrefix(structure.modality);
    return `${modalityPrefix}${coreRWN}`;
}

function structureToCoreRWN(structure: WorkoutStructure): string {

    if (structure.type === 'steady_state') {
        const steadyStruct = structure as unknown as { blockType?: BlockType; value: number; unit: string; zone?: string; target_rate?: number; target_rate_max?: number; target_pace?: string; target_pace_max?: string; splitValue?: number; splitUnit?: string; subSegments?: { value: number; duration_type: string; target_rate?: number; target_rate_max?: number; target_pace?: string; target_pace_max?: string }[] };
        const prefix = getBlockTagPrefix(steadyStruct);
        
        let base: string;
        if (steadyStruct.unit === 'meters') {
            const zone = steadyStruct.zone ? `@${steadyStruct.zone}` : '';
            base = `${prefix}${steadyStruct.value}m${zone}${formatGuidance(steadyStruct)}`;
        } else if (steadyStruct.unit === 'calories') {
            const zone = steadyStruct.zone ? `@${steadyStruct.zone}` : '';
            base = `${prefix}${formatCalories(steadyStruct.value)}${zone}${formatGuidance(steadyStruct)}`;
        } else {
            const zone = steadyStruct.zone ? `@${steadyStruct.zone}` : '';
            base = `${prefix}${formatTime(steadyStruct.value)}${zone}${formatGuidance(steadyStruct)}`;
        }

        // Append sub-segments or split notation
        if (steadyStruct.subSegments && steadyStruct.subSegments.length > 0) {
            const segs = steadyStruct.subSegments.map(s => {
                const val = s.duration_type === 'distance' ? formatDistance(s.value) : formatTime(s.value);
                const parts = [val];
                if (s.target_pace) parts.push(`@${s.target_pace}`);
                if (s.target_rate) parts.push(`@r${s.target_rate}`);
                return parts.join('');
            });
            return `${base}[${segs.join(' + ')}]`;
        } else if (steadyStruct.splitValue) {
            const splitStr = steadyStruct.splitUnit === 'meters'
                ? formatDistance(steadyStruct.splitValue)
                : formatTime(steadyStruct.splitValue);
            return `${base} [${splitStr}]`;
        }

        return base;
    }

    if (structure.type === 'interval') {
        const intervalStruct = structure as IntervalStructure;
        const prefix = getBlockTagPrefix(intervalStruct.work as unknown as { blockType?: BlockType });
        
        const workBase = formatDuration(intervalStruct.work.value, intervalStruct.work.type);
        const workPart = `${workBase}${formatGuidance(intervalStruct.work)}`;
        
        const restPart = formatOptionalDuration(intervalStruct.rest.value, intervalStruct.rest.type);
        
        return restPart
            ? `${prefix}${intervalStruct.repeats}x${workPart}/${restPart}r`
            : `${prefix}${intervalStruct.repeats}x${workPart}`;
    }

    if (structure.type === 'variable') {
        const varStruct = structure as VariableStructure;
        const parts: string[] = [];
        let currentPrefix = '';
        
        for (let i = 0; i < varStruct.steps.length; i++) {
            const step = varStruct.steps[i];
            const stepPrefix = getBlockTagPrefix(step);
            
            if (step.type === 'work') {
                let workStr = `${formatDuration(step.value, step.duration_type)}${formatGuidance(step)}`;
                
                // Only add prefix if it changed from previous block
                if (stepPrefix && stepPrefix !== currentPrefix) {
                    workStr = stepPrefix + workStr;
                    currentPrefix = stepPrefix;
                }
                
                // Check if next step is rest to form "work/rest" pair
                if (i + 1 < varStruct.steps.length && varStruct.steps[i + 1].type === 'rest') {
                    const restStep = varStruct.steps[i + 1];
                    const restStr = formatOptionalDuration(restStep.value, restStep.duration_type);
                    parts.push(restStr ? `${workStr}/${restStr}r` : workStr);
                    i++; // Skip the rest step since we consumed it
                } else {
                    parts.push(workStr);
                }
            } else if (step.type === 'rest') {
                // Standalone rest (not part of work/rest pair)
                const restStr = formatOptionalDuration(step.value, step.duration_type);
                if (restStr) {
                    parts.push(`${restStr}r`);
                }
            }
        }
        
        return parts.join(' + ');
    }

    return '';
}
