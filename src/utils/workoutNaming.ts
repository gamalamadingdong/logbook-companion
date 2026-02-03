import type { C2Interval, C2Stroke } from '../api/concept2.types';

/**
 * Format rest time (seconds) to readable string matching RWN spec
 * RWN allows both `[M]:[SS]r` and `[S]sr`
 * Use shorter format when possible for readability
 */
export function formatRest(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    // Always use M:SS format to match Concept2 and avoid ambiguity with stroke rate
    // E.g., "20sr" could be confused with stroke rate, "0:20r" is unambiguous
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
    const distVariance = first.distance > 0 && workIntervals.every(i => Math.abs(i.distance - first.distance) < 5);
    const timeVariance = first.time > 0 && workIntervals.every(i => Math.abs(i.time - first.time) < 10); // 1s tolerance for time

    // Rest and Watts consistency
    const restTimeDeci = first.rest_time || 0;
    const restSeconds = restTimeDeci / 10;
    const restString = restSeconds > 0 ? `/${formatRest(restSeconds)}r` : '';

    const firstWatts = first.watts;
    const wattsVariance = firstWatts ? workIntervals.every(i => i.watts && Math.abs(i.watts - firstWatts) <= 5) : false;
    const firstCalories = first.calories_total;
    const calVariance = firstCalories ? workIntervals.every(i => i.calories_total && Math.abs(i.calories_total - firstCalories) <= 2) : false;

    // SPECIAL CASE: Single Interval (e.g. 30:00 or 2000m)
    // Both distVariance and timeVariance are TRUE.
    if (distVariance && timeVariance && count === 1) {
        const timeSec = first.time / 10;
        // e.g. 20:00=1200, 30:00=1800, 40:00=2400, 60:00=3600
        const isStandardTime = [1200, 1800, 2400, 3600].includes(timeSec);

        const isCleanTime = (timeSec % 1 === 0);
        const isStandardDist = [2000, 5000, 6000, 10000, 21097, 42195].includes(Math.round(first.distance));
        const isCleanDist = first.distance % 500 === 0;

        // Prioritize:
        // 1. If logic says it's a Standard Distance (e.g. 2000m), prefer Distance.
        if (isStandardDist) {
            return `${Math.round(first.distance)}m`;
        }

        // 2. Else if it's a Standard Time (30:00), prefer Time.
        // 3. Else if it's Clean Time but not Clean Distance, prefer Time.
        if (isStandardTime || (!isCleanDist && isCleanTime)) {
            const m = Math.floor(timeSec / 60);
            const s = timeSec % 60;
            const timeLabel = s === 0 ? `${m}:00` : `${m}:${s}`;
            return `${timeLabel}`;
        }

        // Fallback for single interval: just return the distance?
        return `${Math.round(first.distance)}m`;
    }

    if (distVariance) {
        const avgDist = workIntervals.reduce((s, i) => s + i.distance, 0) / count;
        return `${count}x${Math.round(avgDist)}m${restString}`;
    }

    if (timeVariance) {
        const timeSec = first.time / 10;
        const m = Math.floor(timeSec / 60);
        const s = timeSec % 60;
        const timeLabel = s === 0 ? `${m}:00` : `${m}:${s}`;
        return `${count}x${timeLabel}${restString}`;
    }



    // Variable / Pyramid / Ladder Logic
    // We generate a "Signature" for each interval to detect patterns regardless of mixed types.
    const signatures = workIntervals.map(i => {
        // Decide type priority for this step
        // If type is explicitly 'time', or if it has time and 0 distance
        const isTimeStep = i.type === 'time' || (i.time > 0 && i.distance === 0);

        // Explicit Type Priority
        if (i.type === 'time') {
            const totalSec = i.time / 10;
            const m = Math.floor(totalSec / 60);
            const s = totalSec % 60;
            return s === 0 ? `${m}:00` : `${m}:${Math.round(s).toString().padStart(2, '0')}`;
        }
        if (i.type === 'distance') {
            return `${Math.round(i.distance)}m`;
        }

        // Failover Inference
        if (isTimeStep) {
            const totalSec = i.time / 10;
            const m = Math.floor(totalSec / 60);
            const s = totalSec % 60;
            return s === 0 ? `${m}:00` : `${m}:${Math.round(s).toString().padStart(2, '0')}`;
        }
        return `${Math.round(i.distance)}m`;
    });

    // 1. Check for Repeating Patterns (Chunking)
    // Try chunk sizes from 1 (simple repeats, but that's handled by variance checks usually) to count/2
    // We start from k=2 because k=1 is handled by Simple Dist/Time Variance checks above.
    for (let k = 2; k <= count / 2; k++) {
        if (count % k === 0) {
            // Potential pattern of length k
            const chunk = signatures.slice(0, k);
            let matches = true;

            // Verify all subsequent chunks match the first chunk
            for (let i = k; i < count; i += k) {
                for (let j = 0; j < k; j++) {
                    if (signatures[i + j] !== chunk[j]) {
                        matches = false;
                        break;
                    }
                }
                if (!matches) break;
            }

            if (matches) {
                const sets = count / k;
                const chunkLabel = chunk.join('/');
                return `${sets}x ${chunkLabel}${restString}`;
            }
        }
    }

    // 2. Check Pyramid/Ladder (using numeric values if units match)
    const isAllDist = workIntervals.every(i => i.type === 'distance' || (i.distance > 0 && i.time === 0));
    const isAllTime = workIntervals.every(i => i.type === 'time' || (i.time > 0 && i.distance === 0));

    if (isAllDist || isAllTime) {
        const values = workIntervals.map(i => isAllDist ? Math.round(i.distance) : i.time / 10);

        // Pyramid
        const isPyramid = count >= 3 && values[0] === values[count - 1] && values[Math.floor(count / 2)] > values[0];
        if (isPyramid) {
            const startLabel = signatures[0];
            return `v${startLabel}... Pyramid`;
        }

        // Ladder
        if (count >= 3) {
            let isAscending = true;
            let isDescending = true;
            for (let i = 0; i < count - 1; i++) {
                if (values[i + 1] <= values[i]) isAscending = false;
                if (values[i + 1] >= values[i]) isDescending = false;
            }

            if (isAscending || isDescending) {
                const startLabel = signatures[0];
                const endLabel = signatures[count - 1];
                return `v${startLabel}...${endLabel} Ladder`;
            }
        }
    }

    // 3. Check for Uniform Watts / Calories (Intensity Workouts)
    // We check this AFTER pattern detection because "3x 750/500/250" is a more specific name than "9x 200W".
    // This catches "Random Dists/Times but Fixed Watts" scenarios.
    if (calVariance && first.calories_total) {
        return `${count}x${first.calories_total}cal${restString}`;
    }

    if (wattsVariance && first.watts) {
        return `${count}x${Math.round(first.watts)}W${restString}`;
    }

    // 4. Fallback: Variable List
    // Allow up to 16 items explicitly 
    if (count > 0 && count <= 16) {
        // If all match a pattern "v500m/..."
        // If all are meters, we can condense: v500/1000/500m
        const allMeters = signatures.every(s => s.endsWith('m'));
        if (allMeters) {
            const values = signatures.map(s => s.slice(0, -1));
            return `v${values.join('/')}m`;
        }

        // If mixed or time
        return `v${signatures.join('/')}`;
    }

    // Fallback for "Unknown" or Messy Variable
    return 'Unstructured';
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
