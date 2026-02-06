
import type { C2Interval, C2Stroke } from '../api/concept2.types';
import { getWorkStrokes } from './zones'; // Import the new helper

export interface PowerBucket {
    watts: number; // Floor of bucket (150, 155, 160)
    seconds: number;
}

export const paceToWatts = (paceVal: number): number => {
    // paceVal is "time per 500m" in 0.1s units (e.g. 1179 = 1:57.9)
    if (paceVal <= 0) return 0;

    const paceSeconds = paceVal / 10; // 117.9
    const timePerMeter = paceSeconds / 500;
    // C2 Formula: Watts = 2.80 / (sec/m)^3
    const watts = 2.80 / Math.pow(timePerMeter, 3);

    return Math.round(watts);
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
