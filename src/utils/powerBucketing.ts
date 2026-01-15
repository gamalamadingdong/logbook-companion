
interface Stroke {
    d: number; // cumulative distance
    p: number; // pace per 500m (0.1s units)
    t: number; // cumulative time (0.1s units)
    hr?: number;
    spm?: number;
}

interface RawWorkoutData {
    id: number;
    strokes: Stroke[];
    // ... other fields
}

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

export const calculatePowerBuckets = (rawData: RawWorkoutData): Record<string, number> => {
    const buckets: Record<string, number> = {};
    const strokes = rawData.strokes;

    if (!strokes || strokes.length === 0) return {};

    for (let i = 0; i < strokes.length; i++) {
        const stroke = strokes[i];

        // Calculate Duration
        // For first stroke, use its time (assuming start at 0). 
        // For others, delta from previous.
        // t is in 0.1s units.
        const prevTime = i === 0 ? 0 : strokes[i - 1].t;
        const durationDeci = stroke.t - prevTime;
        const durationSeconds = durationDeci / 10;

        if (durationSeconds <= 0) continue;

        // Calculate Watts
        const watts = paceToWatts(stroke.p);

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
