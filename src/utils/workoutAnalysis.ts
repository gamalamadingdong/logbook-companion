import type { WorkoutStructure, WorkoutStep } from '../types/workoutStructure.types';
import type { C2Interval } from '../api/concept2.types';
import { calculateCanonicalName, roundToStandardDistance } from './workoutNaming';

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

// ─── Warmup / Cooldown Detection from Raw C2 Intervals ─────────────────────

export interface WarmupCooldownDetection {
    /** Whether a likely warmup/cooldown pattern was detected */
    detected: boolean;
    /** Indices of intervals identified as warmup (typically [0]) */
    warmupIndices: number[];
    /** Indices of intervals identified as cooldown (typically [last]) */
    cooldownIndices: number[];
    /** Indices of the main work block */
    mainIndices: number[];
    /** Canonical name of the main work block only */
    mainCanonicalName: string;
    /** Suggested RWN string with [w]/[c] tags */
    suggestedRWN: string;
    /** Human-readable description of what was detected */
    description: string;
}

// ─── Standard Test Distances & Times ────────────────────────────────────────

/**
 * Standard rowing test/race distances (meters).
 * Used for single-piece warmup/cooldown detection.
 * Deliberately excludes very short distances like 100m/250m which are
 * unlikely to be a standalone "main piece" with warmup/cooldown.
 */
const STANDARD_TEST_DISTANCES = [
    500, 1000, 2000, 5000, 6000, 10000, 21097, 42195
];

/**
 * Standard rowing test/training times (deciseconds).
 * Excludes 10:00 (6000ds) and 5:00 (3000ds) because those are far too
 * common as warmup/cooldown pieces themselves.
 */
const STANDARD_TEST_TIMES = [
    600,    // 1:00 — max power test
    2400,   // 4:00 — short test
    12000,  // 20:00
    18000,  // 30:00
    27000,  // 45:00
    36000,  // 60:00
];

/** Check if a distance matches a standard rowing test distance (±10m) */
function isStandardTestDistance(meters: number): boolean {
    return STANDARD_TEST_DISTANCES.some(d => Math.abs(meters - d) <= 10);
}

/** Check if a time matches a standard rowing test time (±1s = ±10ds) */
function isStandardTestTime(deciseconds: number): boolean {
    return STANDARD_TEST_TIMES.some(t => Math.abs(deciseconds - t) <= 10);
}

/**
 * Format an interval as an RWN segment string.
 * Returns e.g. "10:00", "2000m", "500cal"
 */
function intervalToRWNSegment(interval: C2Interval): string {
    const isTime = interval.type === 'time' || (interval.time > 0 && interval.distance === 0);
    
    if (isTime) {
        const totalSec = interval.time / 10;
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return s === 0 ? `${m}:00` : `${m}:${Math.round(s).toString().padStart(2, '0')}`;
    }
    
    if (interval.distance > 0) {
        return `${roundToStandardDistance(interval.distance)}m`;
    }
    
    if (interval.calories_total) {
        return `${interval.calories_total}cal`;
    }
    
    return '?';
}

/**
 * Detect likely warmup and cooldown intervals from a raw C2 interval array.
 * 
 * Pattern: A uniform middle block (N identical intervals) bookended by
 * 1-2 single steady pieces that differ in type/duration from the middle.
 * 
 * Rules:
 * - Middle block must have ≥2 uniform intervals (same distance or same time)
 * - Warmup: first interval differs from middle block (different type or value)
 * - Cooldown: last interval differs from middle block
 * - Only detects single-interval warmup/cooldown (not multi-interval warmups)
 * - Returns detected=false if the workout looks uniform or genuinely variable
 */
export function detectWarmupCooldown(intervals: C2Interval[]): WarmupCooldownDetection {
    const noDetection: WarmupCooldownDetection = {
        detected: false,
        warmupIndices: [],
        cooldownIndices: [],
        mainIndices: [],
        mainCanonicalName: '',
        suggestedRWN: '',
        description: ''
    };
    
    // Filter out rest-type intervals
    const workIntervals = intervals.filter(i => i.type !== 'rest');
    
    // Need at least 2 intervals for any detection:
    // - Multi-interval strategies need ≥3 (1 bookend + 2 uniform work)
    // - Single-piece strategies need ≥2 (1 standard piece + 1 bookend)
    if (workIntervals.length < 2) return noDetection;
    
    // Try different combinations: warmup+cooldown, warmup-only, cooldown-only
    const results: WarmupCooldownDetection[] = [];
    
    // Strategy 1: Both warmup AND cooldown (need ≥4: 1w + 2main + 1c)
    if (workIntervals.length >= 4) {
        const candidate = tryDetection(workIntervals, true, true);
        if (candidate) results.push(candidate);
    }
    
    // Strategy 2: Warmup only (need ≥3: 1w + 2main)
    if (workIntervals.length >= 3) {
        const candidate = tryDetection(workIntervals, true, false);
        if (candidate) results.push(candidate);
    }
    
    // Strategy 3: Cooldown only (need ≥3: 2main + 1c)
    if (workIntervals.length >= 3) {
        const candidate = tryDetection(workIntervals, false, true);
        if (candidate) results.push(candidate);
    }
    
    // Strategy 4-6: Single standard piece bookended by warmup/cooldown
    // (e.g. 10:00 warmup + 6000m test + 5:00 cooldown)
    if (workIntervals.length >= 3) {
        const candidate = trySinglePieceDetection(workIntervals, true, true);
        if (candidate) results.push(candidate);
    }
    if (workIntervals.length >= 2) {
        const candidate = trySinglePieceDetection(workIntervals, true, false);
        if (candidate) results.push(candidate);
    }
    if (workIntervals.length >= 2) {
        const candidate = trySinglePieceDetection(workIntervals, false, true);
        if (candidate) results.push(candidate);
    }
    
    // Pick the best detection (prefer both warmup+cooldown, then largest main block)
    if (results.length === 0) return noDetection;
    
    // Prefer the detection with both warmup and cooldown, then largest main block
    results.sort((a, b) => {
        const aHasBoth = a.warmupIndices.length > 0 && a.cooldownIndices.length > 0 ? 1 : 0;
        const bHasBoth = b.warmupIndices.length > 0 && b.cooldownIndices.length > 0 ? 1 : 0;
        if (aHasBoth !== bHasBoth) return bHasBoth - aHasBoth;
        return b.mainIndices.length - a.mainIndices.length;
    });
    
    return results[0];
}

function tryDetection(
    workIntervals: C2Interval[],
    checkWarmup: boolean,
    checkCooldown: boolean
): WarmupCooldownDetection | null {
    const startIdx = checkWarmup ? 1 : 0;
    const endIdx = checkCooldown ? workIntervals.length - 1 : workIntervals.length;
    
    // Main block candidates
    const mainCandidates = workIntervals.slice(startIdx, endIdx);
    
    // Need at least 2 intervals in the main block
    if (mainCandidates.length < 2) return null;
    
    // Check if main block is uniform (same distance or same time)
    const first = mainCandidates[0];
    const distUniform = first.distance > 0 && mainCandidates.every(
        i => Math.abs(i.distance - first.distance) < 5
    );
    const timeUniform = first.time > 0 && mainCandidates.every(
        i => Math.abs(i.time - first.time) < 10 // 1s tolerance
    );
    
    if (!distUniform && !timeUniform) return null;
    
    // Verify warmup/cooldown intervals actually differ from the main block
    if (checkWarmup) {
        const warmup = workIntervals[0];
        const sameAsMain = distUniform
            ? Math.abs(warmup.distance - first.distance) < 5
            : Math.abs(warmup.time - first.time) < 10;
        if (sameAsMain) return null; // Warmup looks identical to main — not a warmup
    }
    
    if (checkCooldown) {
        const cooldown = workIntervals[workIntervals.length - 1];
        const sameAsMain = distUniform
            ? Math.abs(cooldown.distance - first.distance) < 5
            : Math.abs(cooldown.time - first.time) < 10;
        if (sameAsMain) return null; // Cooldown looks identical to main — not a cooldown
    }
    
    // Detection succeeded — build the result
    const warmupIndices = checkWarmup ? [0] : [];
    const cooldownIndices = checkCooldown ? [workIntervals.length - 1] : [];
    const mainIndices = mainCandidates.map((_, i) => i + startIdx);
    
    // Generate canonical name for main block
    const mainCanonicalName = calculateCanonicalName(mainCandidates);
    
    // Build suggested RWN
    const rwnParts: string[] = [];
    
    if (checkWarmup) {
        rwnParts.push(`[w]${intervalToRWNSegment(workIntervals[0])}`);
    }
    
    // Main block RWN — use the canonical name (it's already in RWN-like format)
    rwnParts.push(mainCanonicalName);
    
    if (checkCooldown) {
        rwnParts.push(`[c]${intervalToRWNSegment(workIntervals[workIntervals.length - 1])}`);
    }
    
    const suggestedRWN = rwnParts.join(' + ');
    
    // Build description
    const parts: string[] = [];
    if (checkWarmup) parts.push(`${intervalToRWNSegment(workIntervals[0])} warmup`);
    parts.push(mainCanonicalName);
    if (checkCooldown) parts.push(`${intervalToRWNSegment(workIntervals[workIntervals.length - 1])} cooldown`);
    const description = parts.join(' → ');
    
    return {
        detected: true,
        warmupIndices,
        cooldownIndices,
        mainIndices,
        mainCanonicalName,
        suggestedRWN,
        description
    };
}

/**
 * Check if two intervals are meaningfully different.
 * Different type (time vs distance) OR different distance OR different time.
 * Used to verify bookends aren't just duplicates of the main piece.
 */
function intervalsDiffer(a: C2Interval, b: C2Interval): boolean {
    if (a.type !== b.type) return true;
    if (a.distance > 0 && b.distance > 0 && Math.abs(a.distance - b.distance) >= 5) return true;
    if (a.time > 0 && b.time > 0 && Math.abs(a.time - b.time) >= 10) return true;
    return false;
}

/**
 * Detect warmup/cooldown around a single standard-distance or standard-time piece.
 * 
 * Example: [10:00 time] + [6000m distance] + [5:00 time]
 *   → The 6000m is a known test distance, bookended by different pieces.
 * Example: [20:00 time] + [500m distance] + [5:00 time]
 *   → The 500m is a known test distance; warmup can be MUCH longer than the piece.
 * 
 * Validation:
 * 1. Main piece must match a known standard test distance or time
 * 2. Bookends must differ from main (different type OR different distance/time)
 *    Size doesn't matter — a 20:00 warmup before a 500m test is normal.
 */
function trySinglePieceDetection(
    workIntervals: C2Interval[],
    checkWarmup: boolean,
    checkCooldown: boolean
): WarmupCooldownDetection | null {
    const startIdx = checkWarmup ? 1 : 0;
    const endIdx = checkCooldown ? workIntervals.length - 1 : workIntervals.length;
    
    const mainCandidates = workIntervals.slice(startIdx, endIdx);
    
    // This function handles ONLY the single-main-piece case
    if (mainCandidates.length !== 1) return null;
    
    const main = mainCandidates[0];
    
    // Main piece must be a standard test distance or standard test time
    const isStdDist = main.distance > 0 && isStandardTestDistance(main.distance);
    const isStdTime = main.time > 0 && isStandardTestTime(main.time);
    
    if (!isStdDist && !isStdTime) return null;
    
    // Validate warmup bookend differs from main (type or value — NOT size)
    if (checkWarmup) {
        if (!intervalsDiffer(workIntervals[0], main)) return null;
    }
    
    // Validate cooldown bookend differs from main
    if (checkCooldown) {
        if (!intervalsDiffer(workIntervals[workIntervals.length - 1], main)) return null;
    }
    
    // Build result (same structure as tryDetection)
    const warmupIndices = checkWarmup ? [0] : [];
    const cooldownIndices = checkCooldown ? [workIntervals.length - 1] : [];
    const mainIndices = [startIdx];
    
    const mainCanonicalName = calculateCanonicalName(mainCandidates);
    
    const rwnParts: string[] = [];
    if (checkWarmup) {
        rwnParts.push(`[w]${intervalToRWNSegment(workIntervals[0])}`);
    }
    rwnParts.push(mainCanonicalName);
    if (checkCooldown) {
        rwnParts.push(`[c]${intervalToRWNSegment(workIntervals[workIntervals.length - 1])}`);
    }
    const suggestedRWN = rwnParts.join(' + ');
    
    const parts: string[] = [];
    if (checkWarmup) parts.push(`${intervalToRWNSegment(workIntervals[0])} warmup`);
    parts.push(mainCanonicalName);
    if (checkCooldown) parts.push(`${intervalToRWNSegment(workIntervals[workIntervals.length - 1])} cooldown`);
    const description = parts.join(' → ');
    
    return {
        detected: true,
        warmupIndices,
        cooldownIndices,
        mainIndices,
        mainCanonicalName,
        suggestedRWN,
        description
    };
}
