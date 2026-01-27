import type { C2ResultDetail, C2Interval, C2Stroke } from '../api/concept2.types';

// Standard rowing distances to track PRs for
export const PR_DISTANCES = [
    { meters: 500, label: '500m', shortLabel: '500' },
    { meters: 1000, label: '1k', shortLabel: '1k' },
    { meters: 2000, label: '2k', shortLabel: '2k' },
    { meters: 5000, label: '5k', shortLabel: '5k' },
    { meters: 6000, label: '6k', shortLabel: '6k' },
    { meters: 10000, label: '10k', shortLabel: '10k' },
    { meters: 21097, label: 'Half Marathon', shortLabel: 'HM' },
    { meters: 42195, label: 'Marathon', shortLabel: 'FM' },
];

/**
 * Standard interval patterns or "Benchmark Workouts"
 * that we want to explicitly highlight regardless of auto-detection.
 */
export const BENCHMARK_PATTERNS = [
    '4x500m', '8x500m', '4x1000m', '5x1500m', '4x2000m', '30:00'
];

export interface PRRecord {
    distance: number;
    label: string;
    shortLabel: string;
    time: number; // seconds
    pace: number; // seconds per 500m
    date: string;
    workoutId: string;
    isInterval?: boolean;
    intervalPattern?: string;
    source?: 'distance' | 'interval_split' | 'interval_session';
}

/**
 * Format seconds to MM:SS.t
 */
export function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
}

/**
 * Format pace (500m split)
 */
export function formatPace(paceSeconds: number): string {
    const mins = Math.floor(paceSeconds / 60);
    const secs = paceSeconds % 60;
    return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
}

/**
 * Calculate Watts from Pace (seconds/500m)
 * Formula: Watts = 2.80 / ((pace/500)^3)
 */
export function calculateWatts(paceSeconds: number): number {
    if (!paceSeconds) return 0;
    const pacePerMeter = paceSeconds / 500;
    // C2 formula: Watts = 2.80 / (pace_per_meter ^ 3)
    return Math.round(2.80 / Math.pow(pacePerMeter, 3));
}

// Inverse: Watts to Pace (seconds per 500m)
export function calculatePaceFromWatts(watts: number): number {
    if (!watts) return 0;
    // watts = 2.80 / (pace/500)^3
    // (pace/500)^3 = 2.80 / watts
    // pace/500 = (2.80 / watts)^(1/3)
    // pace = 500 * (2.80/watts)^(1/3)
    return 500 * Math.pow(2.80 / watts, 1.0 / 3.0);
}


/**
 * Format Watts
 */
export function formatWatts(watts: number): string {
    return `${Math.round(watts)}w`;
}

/**
 * Format rest time (seconds) to readable string (e.g. 5:00, 30s)
 */
export function formatRest(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m > 0 && s === 0) return `${m}:00`;
    if (m === 0) return `${s}s`;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Generate a canonical name for an interval workout based on its structure.
 * Verified to handle "4x1000m", "8x500m/3:30r", etc.
 */
export function calculateCanonicalName(intervals: C2Interval[]): string {
    if (!intervals || intervals.length === 0) return 'Unknown';

    // Remove Rest Intervals (type='rest')
    const workIntervals = intervals.filter(i => i.type !== 'rest');
    if (workIntervals.length === 0) return 'Rest Only';

    const count = workIntervals.length;
    const first = workIntervals[0];

    // Check if identifying by Distance or Time
    const distVariance = workIntervals.every(i => Math.abs(i.distance - first.distance) < 5);
    const timeVariance = workIntervals.every(i => Math.abs(i.time - first.time) < 10); // 1s tolerance for time

    // Check for Watts or Calories consistency
    const firstWatts = first.watts;
    const wattsVariance = firstWatts ? workIntervals.every(i => i.watts && Math.abs(i.watts - firstWatts) <= 5) : false;
    const firstCalories = first.calories_total;
    const calVariance = firstCalories ? workIntervals.every(i => i.calories_total && Math.abs(i.calories_total - firstCalories) <= 2) : false;

    // Calculate Rest (Look at rest_time from first INT, assuming consistent)
    // Concept2 API rest_time is in DECISECONDS (same as time).
    const restTimeDeci = first.rest_time || 0;
    const restSeconds = restTimeDeci / 10;

    const restString = restSeconds > 0 ? `/${formatRest(restSeconds)}r` : '';

    if (distVariance) {
        return `${count}x${Math.round(first.distance)}m${restString}`;
    }

    if (timeVariance) {
        // Time is deciseconds in C2Interval
        const timeSec = first.time / 10;
        const m = Math.floor(timeSec / 60);
        const s = timeSec % 60;
        const timeLabel = s === 0 ? `${m}:00` : `${m}:${s}`;
        return `${count}x${timeLabel}${restString}`;
    }

    if (calVariance && first.calories_total) {
        return `${count}x${first.calories_total}cal${restString}`;
    }

    if (wattsVariance && first.watts) {
        // Interval at fixed watts usually implies a specific time/dist duration too, but maybe that varies?
        // Canonical name: 10x200W/2:00r ? 
        // If distance/time varied but watts stayed same, it's a "Watts Interval".
        return `${count}x${Math.round(first.watts)}W${restString}`;
    }

    // Variable / Pyramid
    const dists = workIntervals.map(i => Math.round(i.distance));

    // CHECK FOR REPEATING PATTERNS (Generic)
    // Try chunk sizes from 2 up to count/2
    for (let k = 2; k <= count / 2; k++) {
        if (count % k === 0) {
            // Potential pattern of length k
            const chunk = dists.slice(0, k);
            let matches = true;

            // Verify all subsequent chunks match the first chunk
            for (let i = k; i < count; i += k) {
                for (let j = 0; j < k; j++) {
                    if (dists[i + j] !== chunk[j]) {
                        matches = false;
                        break;
                    }
                }
                if (!matches) break;
            }

            if (matches) {
                const sets = count / k;
                return `${sets}x ${chunk.join('/')}m${restString}`;
            }
        }
    }

    // Check Pyramid (A, B, C, B, A)
    const isPyramid = count >= 3 && dists[0] === dists[count - 1] && dists[Math.floor(count / 2)] > dists[0];
    if (isPyramid) return `v${dists[0]}m... Pyramid`;

    // Check for "Clean" intervals to determine formatting
    const isCleanDist = dists.every(d => d % 10 === 0);
    const isCleanTime = workIntervals.every(i => (i.time / 10) % 1 === 0);

    // Short variable list
    if (count > 0 && count < 8) {
        if (isCleanDist) {
            return `v${dists.join('/')}m`;
        }
        if (isCleanTime) {
            // Format times
            const times = workIntervals.map(i => {
                const totalSec = i.time / 10;
                const m = Math.floor(totalSec / 60);
                const s = totalSec % 60;
                return s === 0 ? `${m}:00` : `${m}:${Math.round(s).toString().padStart(2, '0')}`;
            });
            return `v${times.join('/')}`;
        }
    }

    // Fallback for "Unknown" or Messy Variable
    // If we have intervals but they aren't clean, give a summary
    // User requested these be "Unstructured" so they don't show up as benchmarks.
    return 'Unstructured';

    return 'Variable Intervals';
}

/**
 * Reconstruct intervals from stroke data if explicit intervals are missing.
 * Looks for distance/time resets.
 */
export function detectIntervalsFromStrokes(strokes: C2Stroke[]): C2Interval[] {
    if (!strokes || strokes.length === 0) return [];

    const reconstructed: C2Interval[] = [];
    let currentChunkStrokes: C2Stroke[] = [];

    // Helper to process a completed chunk
    const processChunk = (chunk: C2Stroke[]) => {
        if (chunk.length < 2) return;

        const last = chunk[chunk.length - 1];
        const distanceMeters = last.d / 10;
        const timeSeconds = last.t / 10;

        reconstructed.push({
            distance: distanceMeters,
            time: timeSeconds * 10,
            type: 'distance', // Default assumption
            stroke_rate: 0
        } as C2Interval);
    };

    let prevT = strokes[0].t;
    let prevD = strokes[0].d;

    currentChunkStrokes.push(strokes[0]);

    for (let i = 1; i < strokes.length; i++) {
        const s = strokes[i];
        // Detect Reset (Distance or Time drops)
        if (s.d < prevD || s.t < prevT) {
            processChunk(currentChunkStrokes);
            currentChunkStrokes = [];
        }
        currentChunkStrokes.push(s);
        prevT = s.t;
        prevD = s.d;
    }
    processChunk(currentChunkStrokes);

    return reconstructed;
}

/**
 * Calculate PRs from an array of workout objects.
 * PURE FUNCTION - No Supabase dependencies.
 */
export function calculatePRs(workouts: any[]): PRRecord[] {
    const prs: PRRecord[] = [];

    // 2. Find best time for each standard distance (Single Piece)
    const distanceBests: Map<number, { workout: any; time: number }> = new Map();
    // 3. Find best interval sessions (Average Pace/Power)
    const intervalBests: Map<string, { workout: any; avgSplit: number; date: string }> = new Map();

    for (const workout of workouts) {
        const totalDistance = workout.distance_meters;
        const totalTime = workout.duration_seconds || (workout.duration_minutes * 60);
        const workoutDate = workout.completed_at;

        // Skip invalid data 
        if (totalDistance > 100 && totalTime > 0) {
            const pace = (totalTime / totalDistance) * 500;
            if (pace < 50) continue; // Skip impossible workouts
        }

        // --- A. Whole Workout Analysis ---
        if (totalDistance && totalTime) {
            // Check if this matches a standard distance
            for (const stdDist of PR_DISTANCES) {
                if (Math.abs(totalDistance - stdDist.meters) / stdDist.meters < 0.01) {
                    const existing = distanceBests.get(stdDist.meters);
                    if (!existing || totalTime < existing.time) {
                        distanceBests.set(stdDist.meters, { workout, time: totalTime });
                    }
                    break;
                }
            }
        }

        // --- B. Interval Pattern Analysis ---
        let patternLabel: string | null = null;
        let sessionAvgSplit: number | null = null;

        let intervals: C2Interval[] = [];

        if (workout.raw_data) {
            let data: C2ResultDetail = workout.raw_data;
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch (e) { }
            }

            if (data.workout?.intervals) {
                intervals = data.workout.intervals;
            } else if (data.strokes) {
                intervals = detectIntervalsFromStrokes(data.strokes);
            }
            else if ((data as any).strokes) {
                intervals = detectIntervalsFromStrokes((data as any).strokes);
            }

            // Identify Pattern using Robust Canonical Name
            if (intervals.length > 0) {
                const name = calculateCanonicalName(intervals);
                // Only treat as a "Pattern" if it looks like one (contains 'x' or 'Pyramid')
                // And isn't 'Unknown' or 'Single Distance'.
                if (name && name !== 'Unknown' && name !== 'Rest Only') {
                    // Filter out just single pieces masquerading as intervals if needed?
                    // Actually, if it's "1x2000m", that IS a valid interval workout too.
                    // But for PRs, we usually care about multi-interval like "4x500".
                    // However, "1x2000m" will be caught by the Standard Distance check above usually.
                    // Let's use it.

                    // Filter out single pieces from Interval Bests? 
                    // Users might want to see "8x500m" PRs.
                    // "1x2000m" is redundant with 2k PR.
                    if (name.includes('x') || name.includes('v') || name.includes('Pyramid')) {
                        // Ensure it's not 1x something?
                        if (!name.startsWith('1x')) {
                            patternLabel = name;
                        }
                    }
                }

                // Calculate Session Avg Split for this pattern
                const workIntervals = intervals.filter(i => i.type !== 'rest');
                const totalWorkTimeDeci = workIntervals.reduce((sum, i) => sum + i.time, 0);
                const totalWorkDist = workIntervals.reduce((sum, i) => sum + i.distance, 0);

                if (totalWorkDist > 0) {
                    sessionAvgSplit = (totalWorkTimeDeci / 10 / totalWorkDist) * 500;
                }
            }
        }

        // Store Interval Best
        if (patternLabel && sessionAvgSplit) {
            if (sessionAvgSplit > 50) {
                const existing = intervalBests.get(patternLabel);
                if (!existing || sessionAvgSplit < existing.avgSplit) {
                    intervalBests.set(patternLabel, { workout, avgSplit: sessionAvgSplit, date: workoutDate });
                }
            }
        }

        // --- C. Interval Split Analysis (Best Split inside a workout) ---
        if (intervals.length > 0) {
            for (const interval of intervals) {
                const dist = interval.distance;
                const timeSeconds = interval.time / 10;

                if (!dist || !timeSeconds || interval.type === 'rest') continue;

                const pace = (timeSeconds / dist) * 500;
                if (pace < 50) continue;

                // Check if this split is a PR distance
                for (const stdDist of PR_DISTANCES) {
                    // Match within 1% or EXACTLY matches e.g. 500m
                    if (Math.abs(dist - stdDist.meters) < 5) {
                        const existing = distanceBests.get(stdDist.meters);

                        if (!existing || timeSeconds < existing.time) {
                            // Only count split as PR if it beats the generic one? 
                            // Or do we overwrite? Usually we want "Fastest 500m ever" (even if part of intervals).
                            distanceBests.set(stdDist.meters, {
                                workout: { ...workout, is_split_pr: true },
                                time: timeSeconds
                            });
                        }
                        break;
                    }
                }
            }
        }
    }

    // Convert to PRRecord array
    for (const [meters, { workout, time }] of distanceBests) {
        const distInfo = PR_DISTANCES.find(d => d.meters === meters);
        if (distInfo) {
            prs.push({
                distance: meters,
                label: distInfo.label,
                shortLabel: distInfo.shortLabel,
                time,
                pace: (time / meters) * 500,
                date: workout.completed_at,
                workoutId: workout.id,
                source: workout.is_split_pr ? 'interval_split' : 'distance'
            });
        }
    }

    // Convert interval bests to PRRecord
    for (const [label, { workout, avgSplit }] of intervalBests) {
        prs.push({
            distance: workout.distance_meters,
            label,
            shortLabel: label,
            time: workout.duration_seconds || (workout.duration_minutes * 60),
            pace: avgSplit,
            date: workout.completed_at,
            workoutId: workout.id,
            isInterval: true,
            intervalPattern: label,
            source: 'interval_session'
        });
    }

    // Sort
    prs.sort((a, b) => {
        if (a.isInterval && !b.isInterval) return 1;
        if (!a.isInterval && b.isInterval) return -1;
        return a.distance - b.distance;
    });

    return prs;
}
