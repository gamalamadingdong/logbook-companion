
import type { C2Interval, C2Stroke } from '../api/concept2.types';
import { getWorkStrokes } from './zones';
import { calculateWattsFromSplit } from './paceCalculator';

export interface PowerBucket {
    watts: number; // Floor of bucket (150, 155, 160)
    seconds: number;
}

/**
 * Convert C2 stroke pace (deciseconds per 500m) to watts.
 * NOTE: C2 API stroke.p is in deciseconds (e.g. 1179 = 1:57.9).
 * The /10 conversion happens here at the boundary.
 * Canonical formula lives in paceCalculator.ts.
 */
export const paceToWatts = (paceVal: number): number => {
    if (paceVal <= 0) return 0;
    return Math.round(calculateWattsFromSplit(paceVal / 10));
};

export const calculatePowerBuckets = (strokes: C2Stroke[], intervals?: C2Interval[]): Record<string, number> => {
    const buckets: Record<string, number> = {};

    if (!strokes || strokes.length === 0) return {};

    // Filter for WORK strokes
    const { work } = getWorkStrokes(strokes, intervals);

    for (const stroke of work) {
        // Calculate Watts
        let watts = 0;
        if (stroke.watts) {
            watts = stroke.watts;
        } else if (stroke.p) {
            // C2Stroke.p can be watts or pace.
            // Heuristic matching zones.ts/WorkoutDetail.ts
            if (stroke.p > 300) {
                watts = paceToWatts(stroke.p);
            } else {
                watts = stroke.p;
            }
        }

        if (watts <= 0) continue;

        // Calculate Duration
        // Since we have filtered strokes, time deltas might be discontinuous.
        // Use SPM to estimate stroke duration.
        let durationSeconds = 0;
        if (stroke.spm && stroke.spm > 0) {
            durationSeconds = 60 / stroke.spm;
        } else {
            // Fallback? If no SPM, we can't accurately gauge duration of a single stroke easily without context.
            // Ignore stroke or assume ~2-3s?
            // Safer to ignore to prevent data spikes 
            continue;
        }

        // Bucket (Floor to nearest 5)
        const bucketFloor = Math.floor(watts / 5) * 5;

        // Add to bucket
        if (!buckets[bucketFloor]) {
            buckets[bucketFloor] = 0;
        }
        buckets[bucketFloor] += durationSeconds;
    }

    // Round all seconds to 1 decimal place for cleanliness
    Object.keys(buckets).forEach(k => {
        buckets[k] = Math.round(buckets[k] * 10) / 10;
    });

    return buckets;
};
