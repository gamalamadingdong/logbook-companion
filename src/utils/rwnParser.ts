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
    tags?: string[];
}

function parseComponent(str: string): ParsedComponent | null {
    const rawClean = str.trim();

    // Extract Tags (#warmup, #test)
    const tags: string[] = [];
    const tagMatches = rawClean.matchAll(/#([\w-]+)/g);
    for (const m of tagMatches) {
        tags.push(m[1].toLowerCase());
    }
    const clean = rawClean.replace(/#[\w-]+/g, '').trim();

    // If empty after stripping tags, return null
    if (!clean) return null;

    // Safety: A component should not contain '/', that's a structural separator
    if (clean.includes('/')) return null;

    // Extract guidance first (@r20, @2:00, @2k@32spm)
    let guidanceText = '';
    let coreText = clean;

    const atIndex = clean.indexOf('@');
    if (atIndex !== -1) {
        coreText = clean.substring(0, atIndex).trim();
        guidanceText = clean.substring(atIndex + 1).trim();
    }

    // Parse Guidance - split by @ to handle multiple chained parameters
    const guidance: ParsedComponent['guidance'] = {};
    if (guidanceText) {
        // Split guidance by @ to handle chained parameters like "2k@32spm"
        const guidanceParts = guidanceText.split('@').map(p => p.trim());

        for (const part of guidanceParts) {
            // Regex for Rate: r(\d+) or (\d+)spm
            if (!guidance.target_rate) {
                const rateMatch = part.match(/^(?:r)?(\d+)(?:spm)?$/i);
                if (rateMatch) {
                    guidance.target_rate = parseInt(rateMatch[1]);
                    continue;
                }
            }

            // Regex for Relative Pace: 2k+10, 6k-5, 2k + 18
            if (!guidance.target_pace) {
                const relPaceMatch = part.match(/^((?:2k|5k|6k|30m|60m)\s*[+-]\s*\d+(?:\.\d+)?)$/i);
                if (relPaceMatch) {
                    guidance.target_pace = relPaceMatch[1].replace(/\s+/g, ''); // Normalize to "2k+18"
                    continue;
                }
            }

            // Regex for Bare Reference Pace: 2k, 5k, 6k (without offset)
            if (!guidance.target_pace) {
                const barePaceMatch = part.match(/^(2k|5k|6k|30m|60m)$/i);
                if (barePaceMatch) {
                    guidance.target_pace = barePaceMatch[1].toLowerCase();
                    continue;
                }
            }

            // Regex for Training Zone Abbreviations: UT2, UT1, AT, TR, AN
            if (!guidance.target_pace) {
                const zoneMatch = part.match(/^(UT2|UT1|AT|TR|AN)$/i);
                if (zoneMatch) {
                    guidance.target_pace = zoneMatch[1].toUpperCase();
                    continue;
                }
            }

            // Regex for Time Pace: (\d+:\d+)
            if (!guidance.target_pace && !guidance.target_rate) {
                const paceMatch = part.match(/^(\d+:\d+(?:\.\d+)?)$/);
                if (paceMatch) {
                    guidance.target_pace = paceMatch[1];
                    continue;
                }
            }
        }
    }

    // Parse Modality/Unit
    // Distance: 2000m
    if (/^\d+m$/i.test(coreText)) {
        return {
            type: 'distance',
            value: parseInt(coreText.replace(/m/i, '')),
            guidance,
            tags
        };
    }

    // Calories: 500cal or 500c
    if (/^\d+(?:cal|c)$/i.test(coreText)) {
        return {
            type: 'calories',
            value: parseInt(coreText.replace(/(?:cal|c)/i, '')),
            guidance,
            tags
        };
    }

    // Time: 30:00 or 120s
    if (coreText.includes(':')) {
        const sec = parseTime(coreText);
        if (sec !== null) {
            return { type: 'time', value: sec, guidance, tags };
        }
    }

    return null;
}

// Helper: Parse Rest ("2:00r", "90s", "1:00")
function parseRest(str: string): number {
    const clean = str.toLowerCase().replace(/r$/, '').replace(/s$/, '').trim(); // Remove trailing 'r' or 's'
    const val = parseTime(clean);
    return val !== null ? val : 0;
}

// Helper: Split string by separator, respecting parenthesis grouping
function splitRefined(text: string, separator: string): string[] {
    const parts: string[] = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (char === '(') depth++;
        if (char === ')') depth--;

        // Check if we hit the separator at depth 0
        if (depth === 0 && text.substring(i, i + separator.length) === separator) {
            // Special handling for '+' separator: Ignore if it looks like pacing guidance (e.g., "2k+18")
            if (separator === '+') {
                const lookBehind = text.substring(Math.max(0, i - 5), i); // Check for 2k, 5k, etc.
                const lookAhead = text.substring(i + 1, Math.min(text.length, i + 6)); // Check for digits

                // Matches "2k", "5k", "6k", "30m", "60m" optionally followed by whitespace
                const isGuidancePrefix = /(?:2k|5k|6k|30m|60m)\s*$/i.test(lookBehind);
                // Matches optional whitespace followed by digit
                const isGuidanceSuffix = /^\s*\d/.test(lookAhead);

                if (isGuidancePrefix && isGuidanceSuffix) {
                    current += char;
                    continue; // Skip the split, treat as content
                }
            }

            parts.push(current);
            current = '';
            i += separator.length - 1; // Skip separator
        } else {
            current += char;
        }
    }
    parts.push(current);
    return parts.filter(p => p.trim() !== '');
}

// Helper: Parse a repeated group like "3 x ( ... )"
function parseRepeatedGroup(text: string, modality?: WorkoutStructure['modality']): WorkoutStructure | null {
    // Regex matches "N x (anything)" or "N x (anything) / rest r"
    // But regex is weak for nested parenthesis.
    // Let's assume the syntax is "N x " + Group

    // Find the first 'x'
    const xIndex = text.indexOf('x');
    if (xIndex === -1) return null;

    const repeatsStr = text.substring(0, xIndex).trim();
    if (!/^\d+$/.test(repeatsStr)) return null; // Not a number before x

    const repeats = parseInt(repeatsStr);
    const remainder = text.substring(xIndex + 1).trim();

    // Check if remainder starts with '('
    if (!remainder.startsWith('(')) return null;

    // Find matching closing parenthesis
    let depth = 0;
    let closeIndex = -1;
    for (let i = 0; i < remainder.length; i++) {
        if (remainder[i] === '(') depth++;
        if (remainder[i] === ')') depth--;

        if (depth === 0) {
            closeIndex = i;
            break;
        }
    }

    if (closeIndex === -1) return null; // Unbalanced?

    const groupContent = remainder.substring(1, closeIndex); // Inside ()
    const afterGroup = remainder.substring(closeIndex + 1).trim();

    // Check for trailing rest: "/ 2:00r"
    let groupRest = 0;
    if (afterGroup.startsWith('/')) {
        groupRest = parseRest(afterGroup.substring(1).trim());
    } else if (afterGroup !== '') {
        // If there's garbage after the group that isn't a rest, maybe this isn't a simple repeat group?
        // e.g. "3x(...) + 2000m" -> This would be handled by top-level variable parser first
        // But if we are called here, we are assuming we are checking for a SINGLE repeating group structure.
        return null;
    }

    // Parse the inner content. It could be "Work/Rest" or "A+B"
    // For "3x(750/3r + 500/3r)", inner is "750/3r + 500/3r" -> Variable
    // For "3x(2000m)", inner is "2000m" -> Steady
    const innerStruct = parseRWN(groupContent); // Recursive call!
    if (!innerStruct) return null;

    const unrolledSteps: WorkoutStep[] = [];

    // Helper to Convert Structure to Steps
    const extractSteps = (struct: WorkoutStructure): WorkoutStep[] => {
        if (struct.type === 'variable') return struct.steps;
        if (struct.type === 'steady_state') {
            return [{
                type: 'work',
                modality: struct.modality,
                duration_type: struct.unit === 'seconds' ? 'time' : (struct.unit === 'meters' ? 'distance' : 'calories'),

                value: struct.value,
                target_rate: struct.target_rate,
                target_pace: struct.target_pace,
                tags: struct.tags
            }];
        }
        if (struct.type === 'interval') {
            // An interval is already N x Work/Rest.
            // If we have 3 x (4x500m/1r), that's nested intervals.
            // Unroll the inner interval fully
            const steps: WorkoutStep[] = [];
            for (let i = 0; i < struct.repeats; i++) {
                steps.push({
                    type: 'work',
                    modality: struct.modality,
                    duration_type: struct.work.type,
                    value: struct.work.value,
                    target_rate: struct.work.target_rate,
                    target_pace: struct.work.target_pace,
                    tags: struct.work.tags
                });
                steps.push({
                    type: 'rest',
                    duration_type: 'time',
                    value: struct.rest.value
                });
            }
            return steps;
        }
        return [];
    };

    const baseSteps = extractSteps(innerStruct);

    // Unroll N times
    for (let r = 0; r < repeats; r++) {
        // Add base steps
        unrolledSteps.push(...baseSteps);

        // Add group rest if not the last set?
        // Usually "3x(A+B)/2r" means 2r after each set.
        // Even after the last one? Often yes in machine programming.
        if (groupRest > 0) {
            unrolledSteps.push({
                type: 'rest',
                duration_type: 'time',
                value: groupRest
            });
        }
    }

    // Optimization: If the groupRest is 0, AND baseSteps ends with a rest, we might have double rest? 
    // No, existing parsers handle rest inside segments.

    return {
        type: 'variable',
        modality,
        steps: unrolledSteps,
        tags: innerStruct.tags // Propagate tags?
    };
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

    // 0.5 Check for "Repeated Group" FIRST if it wraps the whole string
    // e.g. "3 x ( ... )"
    // This priority ensures we don't split "3 x (A + B)" into "3 x (A" and "B)" by mistake if we did + split first (won't happen with splitRefined, but still good to handle explicitly).
    // Actually, "3 x (A+B)" doesn't have a top level +.
    // But "3x(A) + 3x(B)" does.

    // Try parsing as a grouped repeat first IF it matches the pattern
    // Only if it doesn't have a top-level '+' (otherwise + takes precedence for "3x(A)+3x(B)")
    const topLevelParts = splitRefined(text, '+');

    if (topLevelParts.length > 1) {
        // Variable workout with multiple segments
        return parseVariableWorkout(topLevelParts, modality);
    }

    // No top level +, check for Group Repeat "N x (...)"
    if (text.includes('(')) {
        const groupStruct = parseRepeatedGroup(text, modality);
        if (groupStruct) return groupStruct;
    }

    // 1. Check for Intervals (contains 'x') - Standard "N x Work" or "N x Work/Rest"
    // Regex: (\d+)x\s*(.+)
    const intervalMatch = text.match(/^(\d+)\s*x\s*(.+)$/i);

    if (intervalMatch && !text.includes('(')) { // Ensure we don't aggressively capture complex groups failed above
        const repeats = parseInt(intervalMatch[1]);
        let remainder = intervalMatch[2].trim();

        // Extract Interval-level tags (e.g. at end of string or mixed in)
        const intervalTags: string[] = [];
        const tagMatches = remainder.matchAll(/#([\w-]+)/g);
        for (const m of tagMatches) {
            intervalTags.push(m[1].toLowerCase());
        }
        // Remove tags to clean up parsing
        remainder = remainder.replace(/#[\w-]+/g, '').trim();

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
                        target_pace: workComp.guidance?.target_pace,
                        tags: intervalTags.length > 0 ? intervalTags : workComp.tags
                    },
                    rest: {
                        type: 'time',
                        value: restVal
                    },
                    tags: intervalTags.length > 0 ? intervalTags : workComp.tags
                };
            }
        }
    }

    // 2. Steady State (Single component)
    const singleComp = parseComponent(text);
    if (singleComp) {
        return {
            type: 'steady_state',
            modality,
            value: singleComp.value,
            unit: mapToSteadyUnit(singleComp.type),
            target_rate: singleComp.guidance?.target_rate,
            target_pace: singleComp.guidance?.target_pace,
            tags: singleComp.tags
        };
    }

    // Fallback: Return null
    return null;
}

function parseVariableWorkout(parts: string[], modality?: WorkoutStructure['modality']): WorkoutStructure {
    const steps: WorkoutStep[] = [];

    parts.forEach(seg => {
        const cleanSeg = seg.trim();
        // Each segment could be a component or a sub-interval?
        // e.g. "2000m + 4x500m" -> Steady + Interval
        // We parse each segment using parseRWN recursively!
        // but avoid infinite loop if it returns a variable structure with same string (unlikely since we split by +)

        let segModality = modality;
        let cleanText = cleanSeg;

        // Handle local modality override?
        const segModalityMatch = cleanSeg.match(/^(Row|Bike|Ski|Run|Other):\s*(.+)$/i);
        if (segModalityMatch) {
            segModality = segModalityMatch[1].toLowerCase() as any;
            cleanText = segModalityMatch[2].trim();
        }

        const subStruct = parseRWN(cleanText) || parseLegacySegment(cleanText); // Fallback to legacy simplistic parsing if simple component

        if (subStruct) {
            // Flatten subStruct into steps
            if (subStruct.type === 'variable') {
                steps.push(...subStruct.steps);
            } else if (subStruct.type === 'steady_state') {
                steps.push({
                    type: 'work',
                    modality: subStruct.modality || segModality,
                    duration_type: subStruct.unit === 'seconds' ? 'time' : (subStruct.unit === 'meters' ? 'distance' : 'calories'),

                    value: subStruct.value,
                    target_rate: subStruct.target_rate,
                    target_pace: subStruct.target_pace,
                    tags: subStruct.tags
                });
            } else if (subStruct.type === 'interval') {
                // Expand interval
                for (let i = 0; i < subStruct.repeats; i++) {
                    steps.push({
                        type: 'work',
                        modality: subStruct.modality || segModality,
                        duration_type: subStruct.work.type,
                        value: subStruct.work.value,
                        target_rate: subStruct.work.target_rate,
                        target_pace: subStruct.work.target_pace,
                        tags: subStruct.work.tags
                    });
                    steps.push({
                        type: 'rest',
                        duration_type: 'time',
                        value: subStruct.rest.value
                    });
                }
            }
        }
    });

    return {
        type: 'variable',
        modality,
        steps
    };
}

// Fallback for simple "2000m/2:00r" strings that might not parse via parseRWN if they are partial?
// Actually parseRWN handles "2000m" (Steady) well.
// But "2000m/2:00r" isn't a valid WORKOUT by itself in our grammar unless it's "1x2000m/2:00r" or "2000m" (steady doesn't have rest).
// In a variable chain, "2000m/2:00r" implies Work+Rest.
// So we need to handle that specifically here if parseRWN returns null.
function parseLegacySegment(text: string): WorkoutStructure | null {
    // Check for Work/Rest
    const parts = text.split('/');
    if (parts.length >= 2) {
        const workStr = parts[0].trim();
        const restStr = parts[1].trim();

        const workComp = parseComponent(workStr);
        if (workComp) {
            const restVal = parseRest(restStr);
            // Construct a fake "1x" interval? Or just Variable steps?
            // Return as Interval 1x
            return {
                type: 'interval',
                repeats: 1,
                work: {
                    type: workComp.type,
                    value: workComp.value,
                    target_rate: workComp.guidance?.target_rate,
                    tags: workComp.tags
                },
                rest: {
                    type: 'time',
                    value: restVal
                }
            };
        }
    }
    return null;
}
