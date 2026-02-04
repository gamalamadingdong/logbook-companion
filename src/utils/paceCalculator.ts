import type { WorkoutStructure } from '../types/workoutStructure.types';
import type { SupabaseClient } from '@supabase/supabase-js';

// Training zone pace ranges (% of 2k watts)
const ZONE_RANGES = {
    UT2: { min: 0.55, max: 0.65 },  // 55-65% of 2k watts
    UT1: { min: 0.65, max: 0.75 },  // 65-75% of 2k watts
    AT: { min: 0.75, max: 0.85 },   // 75-85% of 2k watts
    TR: { min: 0.85, max: 0.95 },   // 85-95% of 2k watts
    AN: { min: 0.95, max: 1.05 }    // 95-105% of 2k watts
};

// Zone-based time adjustments (seconds added to 2k pace for 500m split)
const ZONE_TIME_ADJUSTMENTS = {
    UT2: 25,  // +25s (Slower/Easier)
    UT1: 18,  // +18s
    AT: 10,   // +10s
    TR: 2,    // +2s (Slightly slower than 2k)
    AN: -2    // -2s (Slightly faster than 2k)
};

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
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
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
    const upperZone = zone.toUpperCase() as keyof typeof ZONE_TIME_ADJUSTMENTS;
    return ZONE_TIME_ADJUSTMENTS[upperZone] ?? 22; // Default to safe middle value
}

/**
 * Calculate target pace range for a training zone based on 2k baseline watts
 * Returns { low: split in seconds, high: split in seconds }
 */
export function calculateZonePaceRange(
    zone: string,
    baseline2kWatts: number
): { low: number; high: number; lowFormatted: string; highFormatted: string } | null {
    const upperZone = zone.toUpperCase() as keyof typeof ZONE_RANGES;
    const range = ZONE_RANGES[upperZone];
    
    if (!range) return null;

    const minWatts = baseline2kWatts * range.min;
    const maxWatts = baseline2kWatts * range.max;
    const minSplit = calculateSplitFromWatts(maxWatts); // Lower watts = slower split (higher time)
    const maxSplit = calculateSplitFromWatts(minWatts); // Higher watts = faster split (lower time)
    
    return {
        low: minSplit,
        high: maxSplit,
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
    if (zone in ZONE_RANGES) {
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
