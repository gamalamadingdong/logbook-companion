import type { WorkoutStructure, WorkoutStep } from '../types/workoutStructure.types';

/**
 * RWN Parser
 * Parses Rowers Workout Notation strings into WorkoutStructure objects.
 */

// Key mapping for Steady State units
function mapToSteadyUnit(type: 'distance' | 'time' | 'calories'): 'meters' | 'seconds' | 'calories' {
    if (type === 'distance') return 'meters';
    if (type === 'time') return 'seconds';
    return 'calories';
}

// Helper: Parse Duration ("30:00", "1:30", "45") -> seconds
function parseTime(str: string): number | null {
    if (!str) return null;
    const parts = str.split(':');
    if (parts.length === 2) {
        return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
    } else if (parts.length === 1) {
        return parseFloat(parts[0]);
    }
    return null;
}

// Helper: Parse Component ("2000m", "30:00", "500cal")
interface ParsedComponent {
    type: 'distance' | 'time' | 'calories';
    value: number;
    guidance?: {
        target_rate?: number;
        target_pace?: string;
    };
}

function parseComponent(str: string): ParsedComponent | null {
    const clean = str.trim();

    // Extract guidance first (@r20, @2:00)
    let guidanceText = '';
    let coreText = clean;

    const atIndex = clean.indexOf('@');
    if (atIndex !== -1) {
        coreText = clean.substring(0, atIndex).trim();
        guidanceText = clean.substring(atIndex + 1).trim();
    }

    // Parse Guidance
    const guidance: ParsedComponent['guidance'] = {};
    if (guidanceText) {
        // Rate: r20, 20spm, or just 20 (if ambiguous, prefer rate if integer < 100?)
        // Pace: 2:00

        // Regex for Rate: r(\d+) or (\d+)spm
        const rateMatch = guidanceText.match(/(?:^|r)(\d+)(?:spm)?$/i);
        if (rateMatch) {
            guidance.target_rate = parseInt(rateMatch[1]);
        }

        // Regex for Relative Pace: 2k+10, 6k-5, 2k + 18
        // Matches: (Start or space)(Base)(+/-)(Seconds)
        const relPaceMatch = guidanceText.match(/(?:^|\s)((?:2k|5k|6k|30m|60m)\s*[+-]\s*\d+(?:\.\d+)?)/i);
        if (relPaceMatch) {
            guidance.target_pace = relPaceMatch[1].replace(/\s+/g, ''); // Normalize to "2k+18"
        }

        // Regex for Time Pace: (\d+:\d+) - only if we didn't find relative pace
        const paceMatch = guidanceText.match(/(\d+:\d+(?:\.\d+)?)/);
        if (paceMatch && !guidance.target_rate && !guidance.target_pace) {
            guidance.target_pace = paceMatch[1];
        }
    }

    // Parse Modality/Unit
    // Distance: 2000m
    if (/^\d+m$/i.test(coreText)) {
        return {
            type: 'distance',
            value: parseInt(coreText.replace(/m/i, '')),
            guidance
        };
    }

    // Calories: 500cal or 500c
    if (/^\d+(?:cal|c)$/i.test(coreText)) {
        return {
            type: 'calories',
            value: parseInt(coreText.replace(/(?:cal|c)/i, '')),
            guidance
        };
    }

    // Time: 30:00 or 120s
    if (coreText.includes(':')) {
        const sec = parseTime(coreText);
        if (sec !== null) {
            return { type: 'time', value: sec, guidance };
        }
    }

    // Bare number defaults? Avoid for now strictly.
    // 3000 -> assume meters?
    // rwn spec says [Number]m is required for distance.

    return null;
}

// Helper: Parse Rest ("2:00r", "90s", "1:00")
function parseRest(str: string): number {
    const clean = str.toLowerCase().replace(/r$/, '').replace(/s$/, '').trim(); // Remove trailing 'r' or 's'
    const val = parseTime(clean);
    return val !== null ? val : 0;
}

export function parseRWN(input: string): WorkoutStructure | null {
    if (!input || !input.trim()) return null;

    let text = input.trim();
    let modality: WorkoutStructure['modality'] = undefined;

    // 0. Check for Modality Prefix (e.g., "Bike: 4x500m")
    const modalityMatch = text.match(/^(Row|Bike|Ski|Run|Other):\s*(.+)$/i);
    if (modalityMatch) {
        modality = modalityMatch[1].toLowerCase() as any;
        text = modalityMatch[2].trim();
    }

    // 1. Check for Complex/Segmented (contains '+')
    if (text.includes('+')) {
        const variableStruct = parseVariableWorkout(text, modality);

        // Safety: If it resulted in just 1 Work step, treat as Steady State
        if (variableStruct.type === 'variable' && variableStruct.steps.length === 1 && variableStruct.steps[0].type === 'work') {
            const step = variableStruct.steps[0];
            return {
                type: 'steady_state',
                modality,
                value: step.value,
                unit: mapToSteadyUnit(step.duration_type),
                target_rate: step.target_rate,
                target_pace: step.target_pace
            };
        }

        return variableStruct;
    }

    // 2. Check for Intervals (contains 'x' AND 'r') - strict check for repeats
    // Regex: (\d+)x\s*(.+)
    const intervalMatch = text.match(/^(\d+)\s*x\s*(.+)$/i);

    if (intervalMatch) {
        const repeats = parseInt(intervalMatch[1]);
        const remainder = intervalMatch[2].trim();

        // Split remainder into Work and Rest
        // Standard syntax: Work/Rest
        const parts = remainder.split('/');

        if (parts.length >= 1) {
            const workStr = parts[0].trim();
            const restStr = parts.length > 1 ? parts[1].trim() : '0r';

            const workComp = parseComponent(workStr);
            if (workComp) {
                // Determine if strict Interval or standard Rest logic
                const restVal = parseRest(restStr);

                return {
                    type: 'interval',
                    modality,
                    repeats,
                    work: {
                        type: workComp.type,
                        value: workComp.value,
                        target_rate: workComp.guidance?.target_rate,
                        target_pace: workComp.guidance?.target_pace
                    },
                    rest: {
                        type: 'time',
                        value: restVal
                    }
                };
            }
        }
    }

    // 3. Steady State (Single component)
    const singleComp = parseComponent(text);
    if (singleComp) {
        return {
            type: 'steady_state',
            modality,
            value: singleComp.value,
            unit: mapToSteadyUnit(singleComp.type),
            target_rate: singleComp.guidance?.target_rate,
            target_pace: singleComp.guidance?.target_pace
        };
    }

    // Fallback: Try parsing as single component if it failed regex but might be valid?

    return null;
}

function parseVariableWorkout(text: string, modality?: WorkoutStructure['modality']): WorkoutStructure {
    // 2000m + 1000m + ...
    const segments = text.split('+').map(s => s.trim());
    const steps: WorkoutStep[] = [];

    segments.forEach(seg => {
        // Handle parenthesis grouping? (Future)
        // Check for Work/Rest syntax: "2000m/2:00r" or "1000m/2r"

        let workStr = seg;
        let restStr = null;

        if (seg.includes('/')) {
            const parts = seg.split('/');
            if (parts.length >= 2) {
                workStr = parts[0].trim();
                restStr = parts[1].trim();
            }
        }

        // Parse Work Component
        const comp = parseComponent(workStr);
        if (comp) {
            steps.push({
                type: 'work',
                duration_type: comp.type,
                value: comp.value,
                target_rate: comp.guidance?.target_rate,
                target_pace: comp.guidance?.target_pace
            });

            // If we found a specific rest string, add it
            if (restStr) {
                const restVal = parseRest(restStr);
                // Even if 0, if explicitly stated '0r', maybe we should add it? 
                // Usually 0 rest in variable means undefined/continuous.
                // But parseRest returns 0 if invalid or empty.
                // Let's assume if it parsed > 0, we add it.
                if (restVal > 0) {
                    steps.push({
                        type: 'rest',
                        duration_type: 'time',
                        value: restVal
                    });
                }
            }
        } else {
            // Failed to parse work part? 
            // Maybe it was just "1:00r"? (Invalid as standalone segment usually)
            // Ignore/Log?
        }
    });

    return {
        type: 'variable',
        modality,
        steps
    };
}
