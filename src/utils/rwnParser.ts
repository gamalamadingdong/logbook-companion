import type { WorkoutStructure, WorkoutStep, BlockType } from '../types/workoutStructure.types';

/**
 * RWN Parser
 * Parses Rowers Workout Notation strings into WorkoutStructure objects.
 * 
 * Block Tag Notation (Preferred):
 *   [w]10:00 + 5x500m/1:00r + [c]5:00
 *   [w] = warmup, [c] = cooldown, [t] = test
 * 
 * Inline Tag Notation (Legacy, still supported):
 *   10:00#warmup + 5x500m/1:00r + 5:00#cooldown
 */

// Block tag mapping: [w] -> warmup, [c] -> cooldown, [t] -> test
const BLOCK_TAG_MAP: Record<string, BlockType> = {
    'w': 'warmup',
    'c': 'cooldown',
    't': 'test'
};

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

// Helper: Parse Component ("2000m", "30:00", "500cal", "[w]10:00")
interface ParsedComponent {
    type: 'distance' | 'time' | 'calories';
    value: number;
    guidance?: {
        target_rate?: number;
        target_rate_max?: number;  // If present, target_rate is min, this is max
        target_pace?: string;
        target_pace_max?: string;  // If present, target_pace is min, this is max
    };
    blockType?: BlockType;  // Semantic block type from [w], [c], [t] prefix
    tags?: string[];        // Legacy inline tags (#warmup, #cooldown, #test)
}

function parseComponent(str: string): ParsedComponent | null {
    let rawClean = str.trim();

    // Extract Block Tag prefix: [w], [c], [t]
    let blockType: BlockType | undefined;
    const blockTagMatch = rawClean.match(/^\[([wct])\]/i);
    if (blockTagMatch) {
        const tagChar = blockTagMatch[1].toLowerCase();
        blockType = BLOCK_TAG_MAP[tagChar];
        rawClean = rawClean.substring(blockTagMatch[0].length).trim();
    }

    // Extract inline Tags (#warmup, #test) - legacy support
    const tags: string[] = [];
    const tagMatches = rawClean.matchAll(/#([\w-]+)/g);
    for (const m of tagMatches) {
        const tag = m[1].toLowerCase();
        tags.push(tag);
        // Also set blockType from inline tags if not already set
        if (!blockType) {
            if (tag === 'warmup') blockType = 'warmup';
            else if (tag === 'cooldown') blockType = 'cooldown';
            else if (tag === 'test' || tag === 'benchmark') blockType = 'test';
        }
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
            // Regex for Rate Range: r20-24 or r20..24 or 20-24spm or 20..24spm
            if (!guidance.target_rate) {
                const rateRangeMatch = part.match(/^(?:r)?(\d+)(?:-|\.\.)(\d+)(?:spm)?$/i);
                if (rateRangeMatch) {
                    guidance.target_rate = parseInt(rateRangeMatch[1]);
                    guidance.target_rate_max = parseInt(rateRangeMatch[2]);
                    continue;
                }
            }

            // Regex for Rate (single value): r(\d+) or (\d+)spm
            if (!guidance.target_rate) {
                const rateMatch = part.match(/^(?:r)?(\d+)(?:spm)?$/i);
                if (rateMatch) {
                    guidance.target_rate = parseInt(rateMatch[1]);
                    continue;
                }
            }

            // Regex for Absolute Pace Range: 1:48-1:52 or 1:48..1:52
            if (!guidance.target_pace) {
                const paceRangeMatch = part.match(/^(\d+:\d+(?:\.\d+)?)(?:-|\.\.)(\d+:\d+(?:\.\d+)?)$/);
                if (paceRangeMatch) {
                    guidance.target_pace = paceRangeMatch[1];
                    guidance.target_pace_max = paceRangeMatch[2];
                    continue;
                }
            }

            // Regex for Relative Pace Range: 2k+5-2k+10 or 2k+5..2k+10 or 2k-1..2k-5
            if (!guidance.target_pace) {
                const relPaceRangeMatch = part.match(/^((?:2k|5k|6k|30m|60m)\s*[+-]\s*\d+(?:\.\d+)?)(?:-|\.\.)((?:2k|5k|6k|30m|60m)\s*[+-]\s*\d+(?:\.\d+)?)$/i);
                if (relPaceRangeMatch) {
                    guidance.target_pace = relPaceRangeMatch[1].replace(/\s+/g, '');
                    guidance.target_pace_max = relPaceRangeMatch[2].replace(/\s+/g, '');
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
            blockType,
            tags
        };
    }

    // Calories: 500cal or 500c
    if (/^\d+(?:cal|c)$/i.test(coreText)) {
        return {
            type: 'calories',
            value: parseInt(coreText.replace(/(?:cal|c)/i, '')),
            guidance,
            blockType,
            tags
        };
    }

    // Time: 30:00 or 120s
    if (coreText.includes(':')) {
        const sec = parseTime(coreText);
        if (sec !== null) {
            return { type: 'time', value: sec, guidance, blockType, tags };
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
                target_rate_max: struct.target_rate_max,
                target_pace: struct.target_pace,
                target_pace_max: struct.target_pace_max,
                blockType: struct.blockType,
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
                    target_rate_max: struct.work.target_rate_max,
                    target_pace: struct.work.target_pace,
                    target_pace_max: struct.work.target_pace_max,
                    blockType: struct.work.blockType,
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
        modality = modalityMatch[1].toLowerCase() as 'row' | 'bike' | 'ski' | 'run' | 'other';
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
                        target_rate_max: workComp.guidance?.target_rate_max,
                        target_pace: workComp.guidance?.target_pace,
                        target_pace_max: workComp.guidance?.target_pace_max,
                        blockType: workComp.blockType,
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

    // 2. Check for single interval with rest (e.g., "15:00@UT1/2:00r" without "1x" prefix)
    // This handles cases like "Work/Rest" without the multiplier
    if (text.includes('/') && !text.includes('(')) {
        const parts = text.split('/');
        if (parts.length === 2) {
            const workStr = parts[0].trim();
            const restStr = parts[1].trim();
            
            const workComp = parseComponent(workStr);
            if (workComp) {
                const restVal = parseRest(restStr);
                
                return {
                    type: 'interval',
                    modality,
                    repeats: 1,
                    work: {
                        type: workComp.type,
                        value: workComp.value,
                        target_rate: workComp.guidance?.target_rate,
                        target_rate_max: workComp.guidance?.target_rate_max,
                        target_pace: workComp.guidance?.target_pace,
                        target_pace_max: workComp.guidance?.target_pace_max,
                        blockType: workComp.blockType,
                        tags: workComp.tags
                    },
                    rest: {
                        type: 'time',
                        value: restVal
                    },
                    tags: workComp.tags
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
            target_rate_max: singleComp.guidance?.target_rate_max,
            target_pace: singleComp.guidance?.target_pace,
            target_pace_max: singleComp.guidance?.target_pace_max,
            blockType: singleComp.blockType,
            tags: singleComp.tags
        } as WorkoutStructure;
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
            segModality = segModalityMatch[1].toLowerCase() as 'row' | 'bike' | 'ski' | 'run' | 'other';
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
                    target_rate_max: subStruct.target_rate_max,
                    target_pace: subStruct.target_pace,
                    target_pace_max: subStruct.target_pace_max,
                    blockType: subStruct.blockType,
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
                        target_rate_max: subStruct.work.target_rate_max,
                        target_pace: subStruct.work.target_pace,
                        target_pace_max: subStruct.work.target_pace_max,
                        blockType: subStruct.work.blockType,
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
                    target_rate_max: workComp.guidance?.target_rate_max,
                    target_pace: workComp.guidance?.target_pace,
                    target_pace_max: workComp.guidance?.target_pace_max,
                    blockType: workComp.blockType,
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

/**
 * Validation result with detailed error messages
 */
export interface RWNValidationResult {
    valid: boolean;
    errors: string[];
    warnings?: string[];
    structure?: WorkoutStructure;
}

/**
 * Validate RWN string and return detailed errors
 */
export function validateRWN(input: string): RWNValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input || input.trim() === '') {
        return { valid: false, errors: ['RWN cannot be empty'] };
    }

    // Try to parse
    const structure = parseRWN(input);

    if (!structure) {
        // Generic parsing failure - try to give specific hints
        const trimmed = input.trim();
        
        // Check for common mistakes
        if (trimmed.includes('x') && !trimmed.match(/\d+x/)) {
            errors.push("Missing repeat count before 'x' (e.g., '4x500m')");
        }
        
        if (trimmed.includes('/') && !trimmed.match(/\/\d/)) {
            errors.push("Missing rest time after '/' (e.g., '/1:30r')");
        }

        if (trimmed.match(/\d+k\b/)) {
            errors.push("Use full distance in meters (e.g., '5000m' instead of '5k')");
        }

        if (!trimmed.match(/\d+m\b/) && !trimmed.match(/\d+:\d+/) && !trimmed.match(/\d+cal\b/)) {
            errors.push("No valid distance (m), time (mm:ss), or calories (cal) found");
        }

        // If no specific error found, generic message
        if (errors.length === 0) {
            errors.push("Could not parse RWN. Check syntax (e.g., '4x500m/1:00r' or '5000m')");
        }

        return { valid: false, errors, warnings };
    }

    // Successful parse - check for warnings
    if (structure.type === 'interval' && structure.repeats > 50) {
        warnings.push(`High repeat count (${structure.repeats}x) - is this intended?`);
    }

    if (structure.type === 'steady_state' && structure.unit === 'meters' && structure.value > 50000) {
        warnings.push(`Long distance (${structure.value}m) - verify this is correct`);
    }

    if (structure.type === 'steady_state' && structure.unit === 'seconds' && structure.value > 7200) {
        warnings.push(`Long duration (${Math.floor(structure.value / 60)} min) - verify this is correct`);
    }

    return {
        valid: true,
        errors: [],
        warnings: warnings.length > 0 ? warnings : undefined,
        structure
    };
}

/**
 * Duration estimation result
 */
export interface DurationEstimate {
    workDistance: number;  // Total meters of work (excludes rest)
    workTime: number;      // Total seconds of work
    restTime: number;      // Total seconds of rest
    totalTime: number;     // workTime + restTime
    estimateMethod: 'explicit_pace' | 'explicit_time' | 'default_pace' | 'no_estimate' | 'needs_baseline';
    paceUsed?: string;     // Pace used for calculation (e.g., "2:00/500m")
    requiresBaseline?: boolean; // True if workout uses training zones but user has no baseline data
}

/**
 * Estimate workout duration and work distance from RWN
 * @param input RWN string
 * @param defaultPace Default pace to use if none specified (e.g., "2:05")
 */
export function estimateDuration(input: string, defaultPace: string = '2:05'): DurationEstimate | null {
    const structure = parseRWN(input);
    
    if (!structure) {
        return null;
    }

    let workDistance = 0;
    let workTime = 0;
    let restTime = 0;
    let estimateMethod: DurationEstimate['estimateMethod'] = 'no_estimate';
    let paceUsed: string | undefined;
    let requiresBaseline = false;

    // Helper: Convert pace string "2:05" to seconds per 500m
    // Returns null for training zones (UT1, AT, etc.) that need user baseline
    const parsePaceToSeconds = (pace: string): number | null => {
        // Skip training zones - these need user baseline data
        if (/^(UT2|UT1|AT|TR|AN)$/i.test(pace)) {
            return null;
        }
        
        // Skip relative paces like "2k+5" - these need user baseline
        if (/^(2k|5k|6k|30m|60m)/i.test(pace)) {
            return null;
        }
        
        // Parse absolute pace "2:05" format
        const parts = pace.split(':');
        if (parts.length === 2) {
            return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
        }
        
        // Single number (seconds)
        return parseFloat(pace);
    };

    // Helper: Calculate time for distance at pace
    const timeForDistance = (meters: number, paceSeconds: number): number => {
        return (meters / 500) * paceSeconds;
    };

    if (structure.type === 'steady_state') {
        if (structure.unit === 'meters') {
            workDistance = structure.value;
            
            // Use explicit pace if provided
            if (structure.target_pace) {
                const paceSeconds = parsePaceToSeconds(structure.target_pace);
                if (paceSeconds) {
                    paceUsed = structure.target_pace;
                    workTime = timeForDistance(workDistance, paceSeconds);
                    estimateMethod = 'explicit_pace';
                } else {
                    // Training zone or relative pace - can't estimate without baseline
                    requiresBaseline = true;
                    estimateMethod = 'needs_baseline';
                }
            } else {
                // Use default pace
                paceUsed = defaultPace;
                workTime = timeForDistance(workDistance, parsePaceToSeconds(defaultPace)!);
                estimateMethod = 'default_pace';
            }
        } else if (structure.unit === 'seconds') {
            workTime = structure.value;
            estimateMethod = 'explicit_time';
            
            // Estimate distance if we have pace
            if (structure.target_pace) {
                paceUsed = structure.target_pace;
                const paceSeconds = parsePaceToSeconds(structure.target_pace);
                if (paceSeconds !== null) {
                    workDistance = (workTime / paceSeconds) * 500;
                }
            } else {
                // Use default pace to estimate distance
                paceUsed = defaultPace;
                const paceSeconds = parsePaceToSeconds(defaultPace);
                if (paceSeconds !== null) {
                    workDistance = (workTime / paceSeconds) * 500;
                }
            }
        } else if (structure.unit === 'calories') {
            // Can't estimate time from calories without power data
            estimateMethod = 'no_estimate';
        }
    } else if (structure.type === 'interval') {
        const { repeats, work, rest } = structure;
        
        // Calculate work per interval
        if (work.type === 'distance') {
            workDistance = work.value * repeats;
            
            if (work.target_pace) {
                paceUsed = work.target_pace;
                const paceSeconds = parsePaceToSeconds(work.target_pace);
                if (paceSeconds !== null) {
                    workTime = timeForDistance(work.value, paceSeconds) * repeats;
                    estimateMethod = 'explicit_pace';
                }
            } else {
                paceUsed = defaultPace;
                const paceSeconds = parsePaceToSeconds(defaultPace);
                if (paceSeconds !== null) {
                    workTime = timeForDistance(work.value, paceSeconds) * repeats;
                    estimateMethod = 'default_pace';
                }
            }
        } else if (work.type === 'time') {
            workTime = work.value * repeats;
            estimateMethod = 'explicit_time';
            
            if (work.target_pace) {
                paceUsed = work.target_pace;
                const paceSeconds = parsePaceToSeconds(work.target_pace);
                if (paceSeconds !== null) {
                    workDistance = ((work.value / paceSeconds) * 500) * repeats;
                }
            } else {
                paceUsed = defaultPace;
                const paceSeconds = parsePaceToSeconds(defaultPace);
                if (paceSeconds !== null) {
                    workDistance = ((work.value / paceSeconds) * 500) * repeats;
                }
            }
        } else if (work.type === 'calories') {
            estimateMethod = 'no_estimate';
        }
        
        // Rest is always time (already in seconds)
        restTime = rest.value * (repeats - 1); // N intervals = N-1 rest periods
    } else if (structure.type === 'variable') {
        // Sum up all work steps
        for (const step of structure.steps) {
            if (step.type === 'work') {
                if (step.duration_type === 'distance') {
                    workDistance += step.value;
                    
                    if (step.target_pace) {
                        paceUsed = step.target_pace;
                        const paceSeconds = parsePaceToSeconds(step.target_pace);
                        if (paceSeconds !== null) {
                            workTime += timeForDistance(step.value, paceSeconds);
                            estimateMethod = 'explicit_pace';
                        }
                    } else {
                        paceUsed = paceUsed || defaultPace;
                        const paceSeconds = parsePaceToSeconds(defaultPace);
                        if (paceSeconds !== null) {
                            workTime += timeForDistance(step.value, paceSeconds);
                            if (estimateMethod !== 'explicit_pace') {
                                estimateMethod = 'default_pace';
                            }
                        }
                    }
                } else if (step.duration_type === 'time') {
                    workTime += step.value;
                    
                    if (step.target_pace) {
                        paceUsed = step.target_pace;
                        const paceSeconds = parsePaceToSeconds(step.target_pace);
                        if (paceSeconds !== null) {
                            workDistance += (step.value / paceSeconds) * 500;
                            if (estimateMethod !== 'explicit_pace') {
                                estimateMethod = 'explicit_pace';
                            }
                        }
                    } else {
                        paceUsed = paceUsed || defaultPace;
                        const paceSeconds = parsePaceToSeconds(defaultPace);
                        if (paceSeconds !== null) {
                            workDistance += (step.value / paceSeconds) * 500;
                            if (estimateMethod !== 'explicit_pace') {
                                estimateMethod = 'explicit_time';
                            }
                        }
                    }
                }
            } else if (step.type === 'rest') {
                restTime += step.value;
            }
        }
    }

    return {
        workDistance: Math.round(workDistance),
        workTime: Math.round(workTime),
        restTime: Math.round(restTime),
        totalTime: Math.round(workTime + restTime),
        estimateMethod,
        paceUsed,
        requiresBaseline
    };
}

/**
 * Format seconds to MM:SS
 */
export function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
