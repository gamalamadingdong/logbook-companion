import type { C2ResultDetail, C2Interval } from '../api/concept2.types';
import { calculateCanonicalName, detectIntervalsFromStrokes, formatRest } from './workoutNaming';

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
    return 500 * Math.pow(2.80 / watts, 1.0 / 3.0);
}


/**
 * Format Watts
 */
export function formatWatts(watts: number): string {
    return `${Math.round(watts)}w`;
}

// Re-export formatRest for compatibility if needed (though we import it)
export { formatRest };


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
