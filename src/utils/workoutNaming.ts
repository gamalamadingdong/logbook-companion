import type { C2Interval, C2Stroke } from '../api/concept2.types';

/**
 * Standard rowing distances in meters
 */
const STANDARD_DISTANCES = [
    100, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000,
    7500, 10000, 15000, 21097, 30000, 42195
];

/**
 * Round to nearest standard distance if close enough (within 20m or 1%)
 */
export function roundToStandardDistance(meters: number): number {
    const threshold = Math.max(20, meters * 0.01); // 20m or 1%, whichever is larger
    
    for (const standard of STANDARD_DISTANCES) {
        if (Math.abs(meters - standard) <= threshold) {
            return standard;
        }
    }
    
    return Math.round(meters);
}

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

    // SPECIAL CASE: Single Interval
    // Return simple "5000m" or "30:00" without "1x"
    if (count === 1) {
        // Exact Type Priority if available (useful for templates with 0 dist or 0 time)
        const type = first.type;

        // 1. Time-based
        // If explicitly 'time', or inferred (time > 0 and dist == 0)
        // OR if it's a Standard Time (e.g. 30:00) regardless of distance
        const timeSec = first.time / 10;
        const isStandardTime = [1200, 1800, 2400, 3600].includes(timeSec);

        if (type === 'time' || (first.time > 0 && first.distance === 0) || isStandardTime) {
            const m = Math.floor(timeSec / 60);
            const s = timeSec % 60;
            const timeLabel = s === 0 ? `${m}:00` : `${m}:${s.toString().padStart(2, '0')}`;
            return timeLabel;
        }

        // 2. Distance-based
        if (type === 'distance' || first.distance > 0) {
            return `${roundToStandardDistance(first.distance)}m`;
        }

        // 3. Calorie-based
        if (type === 'calorie' || type === 'calories' || first.calories_total) {
            return `${first.calories_total}cal`;
        }

        // Fallback
        if (first.time > 0) {
            const m = Math.floor(timeSec / 60);
            const s = timeSec % 60;
            return s === 0 ? `${m}:00` : `${m}:${s.toString().padStart(2, '0')}`;
        }
        return `${Math.round(first.distance)}m`;
    }

    // BLOCK STRUCTURE DETECTION (before uniform checks)
    // Detect repeating rest patterns that indicate block structures
    // Example: [90s, 90s, 90s, 90s, 360s] repeated 4 times = 4 blocks of 5 intervals
    const restTimes = workIntervals.map(i => (i.rest_time || 0) / 10); // Convert to seconds
    
    if (restTimes.length >= 4) { // Need at least 4 intervals to detect blocks
        // Try different block sizes (minimum 2 intervals per block)
        for (let blockSize = 2; blockSize <= restTimes.length / 2; blockSize++) {
            if (restTimes.length % blockSize !== 0) continue;
            
            const pattern = restTimes.slice(0, blockSize);
            const blockCount = restTimes.length / blockSize;
            
            // Check if this pattern repeats throughout
            let matches = true;
            for (let i = blockSize; i < restTimes.length; i++) {
                if (Math.abs(restTimes[i] - pattern[i % blockSize]) > 2) { // 2s tolerance
                    matches = false;
                    break;
                }
            }
            
            if (matches && blockCount >= 2) {
                // Check if there's a longer rest at the end of each block
                const lastRest = pattern[pattern.length - 1];
                const firstRest = pattern[0];
                
                // Block rest should be significantly longer than intra-block rest
                if (lastRest > firstRest * 1.5) {
                    // Check if work intervals within block are uniform
                    const blockWorkIntervals = workIntervals.slice(0, blockSize);
                    const blockDists = blockWorkIntervals.map(i => i.distance);
                    const blockTimes = blockWorkIntervals.map(i => i.time);
                    
                    const blockDistUniform = blockDists.every(d => Math.abs(d - blockDists[0]) < 5);
                    const blockTimeUniform = blockTimes.every(t => Math.abs(t - blockTimes[0]) < 100);
                    
                    if (blockDistUniform || blockTimeUniform) {
                        // Generate block canonical name
                        const first = blockWorkIntervals[0];
                        const isDistBased = first.type === 'distance' || (first.distance > 0 && first.type !== 'time');
                        
                        if (isDistBased) {
                            const workSig = `${roundToStandardDistance(first.distance)}m`;
                            return `${blockCount}x${blockSize}x${workSig}`;
                        } else {
                            const timeSec = first.time / 10;
                            const m = Math.floor(timeSec / 60);
                            const s = timeSec % 60;
                            const workSig = s === 0 ? `${m}:00` : `${m}:${s.toString().padStart(2, '0')}`;
                            return `${blockCount}x${blockSize}x${workSig}`;
                        }
                    }
                }
            }
        }
    }

    if (distVariance) {
        const avgDist = workIntervals.reduce((s, i) => s + i.distance, 0) / count;
        return `${count}x${roundToStandardDistance(avgDist)}m${restString}`;
    }

    if (timeVariance) {
        const timeSec = first.time / 10;
        const m = Math.floor(timeSec / 60);
        const s = timeSec % 60;
        const timeLabel = s === 0 ? `${m}:00` : `${m}:${s.toString().padStart(2, '0')}`;
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
    // Only apply these labels for 5+ intervals; smaller counts are clearer when listed explicitly
    const isAllDist = workIntervals.every(i => i.type === 'distance' || (i.distance > 0 && i.time === 0));
    const isAllTime = workIntervals.every(i => i.type === 'time' || (i.time > 0 && i.distance === 0));

    if (isAllDist || isAllTime) {
        const values = workIntervals.map(i => isAllDist ? Math.round(i.distance) : i.time / 10);

        // Pyramid (only for 5+ intervals)
        const isPyramid = count >= 5 && values[0] === values[count - 1] && values[Math.floor(count / 2)] > values[0];
        if (isPyramid) {
            const startLabel = signatures[0];
            return `v${startLabel}... Pyramid`;
        }

        // Ladder (only for 5+ intervals)
        if (count >= 5) {
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
