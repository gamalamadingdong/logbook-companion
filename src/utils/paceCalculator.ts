import type { WorkoutStructure } from '../types/workoutStructure.types';
import type { SupabaseClient } from '@supabase/supabase-js';

// Broad rowing-zone bands anchored to recent 2k watts.
// These intentionally reflect common rowing practice with enough room for day-to-day variance.
export const TRAINING_ZONE_CONFIG = {
    UT2: {
        min: 0.55,
        max: 0.70,
        defaultOffsetSeconds: 24,
        label: 'Utilization 2',
        subtitle: 'Easy aerobic / recovery',
        guidance: 'Long easy meters, technical rows, and recovery work.',
    },
    UT1: {
        min: 0.68,
        max: 0.80,
        defaultOffsetSeconds: 14,
        label: 'Utilization 1',
        subtitle: 'Steady endurance',
        guidance: 'Firm aerobic work you can hold with control for a while.',
    },
    AT: {
        min: 0.78,
        max: 0.88,
        defaultOffsetSeconds: 7,
        label: 'Anaerobic Threshold',
        subtitle: 'Threshold',
        guidance: 'Comfortably hard work near lactate threshold.',
    },
    TR: {
        min: 0.88,
        max: 1.00,
        defaultOffsetSeconds: 2,
        label: 'Transport',
        subtitle: 'VO2 / race-support',
        guidance: 'Hard interval work building oxygen transport and race support.',
    },
    AN: {
        min: 1.00,
        max: 1.15,
        defaultOffsetSeconds: -3,
        label: 'Anaerobic',
        subtitle: 'Sprint / power',
        guidance: 'Short maximal work above 2k pace where feel and power matter most.',
    },
} as const;

export type TrainingZone = keyof typeof TRAINING_ZONE_CONFIG;

/**
 * Calculate watts from 500m split time (in seconds)
 */
export function calculateWattsFromSplit(splitSeconds: number): number {
    // Watts = 2.80 / (split / 500)^3
    return 2.8 / Math.pow(splitSeconds / 500, 3);
}

/**
 * Calculate 500m split from watts  
 * Formula: split = 500 * (2.8 / watts)^(1/3)
 */
export function calculateSplitFromWatts(watts: number): number {
    if (watts <= 0) return 0;
    // split = 500 * (2.8 / watts)^(1/3)
    const ratio = 2.8 / watts;
    const cubeRoot = Math.pow(ratio, 1/3);
    const split = 500 * cubeRoot;
    return split;
}

/**
 * Format split time in MM:SS.s format
 */
export function formatSplit(seconds: number): string {
    const roundedSeconds = Math.round(seconds * 10) / 10;
    const mins = Math.floor(roundedSeconds / 60);
    const secs = (roundedSeconds - mins * 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
}

/**
 * Parse a pace/time string to seconds
 * Handles formats: "1:45.0", "105.0", "7:00.0"
 * STRICT: Only accepts pure numeric formats, not "2k+10" or "UT2"
 */
export function parsePaceToSeconds(pace: string): number | null {
    const trimmed = pace.trim();
    
    // Check if it contains non-numeric characters (except : and .)
    // This prevents "2k+20" from being parsed as 2
    if (/[^\d:.]/.test(trimmed)) {
        return null;
    }
    
    const parts = trimmed.split(':');
    if (parts.length === 2) {
        // MM:SS.s format
        const mins = parseInt(parts[0]);
        const secs = parseFloat(parts[1]);
        if (!isNaN(mins) && !isNaN(secs)) {
            return mins * 60 + secs;
        }
    } else if (parts.length === 1) {
        // SS.s format
        const secs = parseFloat(parts[0]);
        if (!isNaN(secs) && parts[0].length > 0) {
            return secs;
        }
    }
    return null;
}

/**
 * Get zone-based time adjustment for a training zone
 */
export function getZoneTimeAdjustment(zone: string): number {
    const upperZone = zone.toUpperCase() as TrainingZone;
    return TRAINING_ZONE_CONFIG[upperZone]?.defaultOffsetSeconds ?? 22;
}

/**
 * Calculate target pace range for a training zone based on 2k baseline watts
 * Returns { low: split in seconds, high: split in seconds }
 */
export function calculateZonePaceRange(
    zone: string,
    baseline2kWatts: number
): { low: number; high: number; lowFormatted: string; highFormatted: string; minWatts: number; maxWatts: number } | null {
    const upperZone = zone.toUpperCase() as TrainingZone;
    const range = TRAINING_ZONE_CONFIG[upperZone];
    
    if (!range) return null;

    const minWatts = baseline2kWatts * range.min;
    const maxWatts = baseline2kWatts * range.max;
    const minSplit = calculateSplitFromWatts(maxWatts); // Lower watts = slower split (higher time)
    const maxSplit = calculateSplitFromWatts(minWatts); // Higher watts = faster split (lower time)
    
    return {
        low: minSplit,
        high: maxSplit,
        minWatts,
        maxWatts,
        lowFormatted: formatSplit(minSplit),
        highFormatted: formatSplit(maxSplit)
    };
}

/**
 * Calculate target pace from 2k-relative notation (e.g., "2k+10", "2k-5")
 * Returns split in seconds
 */
export function calculate2kRelativePace(
    offset: number,
    baseline2kWatts: number
): { split: number; formatted: string } {
    const baseline2kSplit = calculateSplitFromWatts(baseline2kWatts);
    const targetSplit = baseline2kSplit + offset;
    
    return {
        split: targetSplit,
        formatted: formatSplit(targetSplit)
    };
}

/**
 * Calculate target pace with confidence range
 * Returns { target: seconds, low: seconds, high: seconds, confidencePercent: number }
 */
export function calculatePaceWithConfidence(
    targetSplit: number,
    confidencePercent: number = 2
): { target: number; low: number; high: number; targetFormatted: string; lowFormatted: string; highFormatted: string } {
    const range = targetSplit * (confidencePercent / 100);
    
    return {
        target: targetSplit,
        low: targetSplit - range,
        high: targetSplit + range,
        targetFormatted: formatSplit(targetSplit),
        lowFormatted: formatSplit(targetSplit - range),
        highFormatted: formatSplit(targetSplit + range)
    };
}

/**
 * Extract all pace targets from workout structure
 */
export function extractPaceTargets(structure: WorkoutStructure): string[] {
    const targets: Set<string> = new Set();

    if (structure.type === 'steady_state') {
        if (structure.target_pace) targets.add(structure.target_pace);
    } else if (structure.type === 'interval') {
        if (structure.work.target_pace) targets.add(structure.work.target_pace);
    } else if (structure.type === 'variable') {
        structure.steps.forEach(step => {
            if (step.target_pace) targets.add(step.target_pace);
        });
    }

    return Array.from(targets);
}

/**
 * Calculate actual pace from a target pace string (e.g., "@2k", "@2k+10", "@UT2")
 * Returns split in seconds, or null if can't calculate
 */
export function calculateActualPace(
    targetPace: string,
    baseline2kWatts: number
): { split: number; label: string; isRange?: boolean; splitMax?: number } | null {
    // Remove @ prefix if present
    const pace = targetPace.replace(/^@/, '');

    // Check for absolute pace (e.g., "1:45.0" or "105.0")
    const absoluteSplit = parsePaceToSeconds(pace);
    if (absoluteSplit !== null) {
        return { split: absoluteSplit, label: formatSplit(absoluteSplit) };
    }

    // Check for range (e.g., "1:45-1:50")
    const rangeMatch = pace.match(/^(\d+):(\d+\.?\d*)-(\d+):(\d+\.?\d*)$/);
    if (rangeMatch) {
        const [, min1, sec1, min2, sec2] = rangeMatch;
        const split1 = parseInt(min1) * 60 + parseFloat(sec1);
        const split2 = parseInt(min2) * 60 + parseFloat(sec2);
        return {
            split: split1,
            splitMax: split2,
            label: `${formatSplit(split1)}-${formatSplit(split2)}`,
            isRange: true
        };
    }

    // Check for training zone (e.g., "UT2")
    const zone = pace.toUpperCase();
    if (zone in TRAINING_ZONE_CONFIG) {
        const zoneRange = calculateZonePaceRange(zone, baseline2kWatts);
        if (zoneRange) {
            return {
                split: zoneRange.low,
                splitMax: zoneRange.high,
                label: `${zoneRange.lowFormatted}-${zoneRange.highFormatted} (${zone})`,
                isRange: true
            };
        }
    }

    // Check for 2k-relative pace (e.g., "2k", "2k+10", "2k-5")
    const relativeMatch = pace.match(/^2k([+-]\d+)?$/i);
    if (relativeMatch) {
        const offset = relativeMatch[1] ? parseInt(relativeMatch[1]) : 0;
        const result = calculate2kRelativePace(offset, baseline2kWatts);
        const label = offset === 0 ? '2k pace' : `2k${offset > 0 ? '+' : ''}${offset}`;
        return {
            split: result.split,
            label: `${result.formatted} (${label})`
        };
    }

    // Can't parse
    return null;
}

/**
 * Get user's 2k baseline watts from profile
 * Priority: working_baseline from preferences → pr_2k_watts from baseline_metrics → default
 */
export async function getUserBaseline2kWatts(
    userId: string,
    supabase: SupabaseClient
): Promise<number> {
    const defaultWatts = 202; // ~2:00 split

    // Fetch user profile
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('benchmark_preferences')
        .eq('user_id', userId)
        .single();

    if (profile?.benchmark_preferences?.['2k']?.working_baseline) {
        const timeStr = profile.benchmark_preferences['2k'].working_baseline;
        const totalSeconds = parsePaceToSeconds(timeStr);

        if (totalSeconds) {
            // Convert 2k total time to 500m split, then to watts
            const pace500m = (totalSeconds / 2000) * 500;
            return calculateWattsFromSplit(pace500m);
        }
    }

    // Fallback to legacy baseline_metrics
    const { data: baseline } = await supabase
        .from('user_baseline_metrics')
        .select('pr_2k_watts')
        .eq('user_id', userId)
        .single();

    return baseline?.pr_2k_watts || defaultWatts;
}
