import type { C2Stroke, C2Split, C2Interval, C2ResultDetail } from '../api/concept2.types';

export type TrainingZone = 'UT2' | 'UT1' | 'AT' | 'TR' | 'AN';

export interface ZoneDefinition {
    id: TrainingZone;
    label: string;
    minPct: number; // Percentage of 2k Watts
    maxPct: number;
    color: string;
    description: string;
}

// Based on "Liberal" bands from zones-and-pacing.md, but discretized for classification
export const ZONES: ZoneDefinition[] = [
    { id: 'UT2', label: 'UT2 (Steady)', minPct: 0, maxPct: 0.60, color: '#10b981', description: 'Long steady distance, recovery' }, // < 60%
    { id: 'UT1', label: 'UT1 (Hard Steady)', minPct: 0.60, maxPct: 0.75, color: '#3b82f6', description: 'Intense aerobic endurance' }, // 60-75%
    { id: 'AT', label: 'AT (Threshold)', minPct: 0.75, maxPct: 0.90, color: '#f59e0b', description: 'Threshold work (2k + 10s)' },      // 75-90%
    { id: 'TR', label: 'TR (Transportation)', minPct: 0.90, maxPct: 1.05, color: '#f97316', description: 'VO2 Max intervals (2k pace)' },   // 90-105%
    { id: 'AN', label: 'AN (Anaerobic)', minPct: 1.05, maxPct: 2.00, color: '#ef4444', description: 'Sprints (Max effort)' }          // > 105%
];

// Split <-> Watts Conversion
export const splitToWatts = (splitSeconds: number): number => {
    if (splitSeconds <= 0) return 0;
    return 2.8 / Math.pow(splitSeconds / 500, 3);
};

export const wattsToSplit = (watts: number): number => {
    if (watts <= 0) return 0;
    return 500 * Math.pow(2.8 / watts, 1 / 3);
};

export const formatSplit = (seconds: number): string => {
    if (!seconds || seconds === Infinity) return "-";
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(1).padStart(4, '0');
    return `${m}:${s}`;
};

export const classifyWorkout = (avgWatts: number, baseline2kWatts: number): TrainingZone => {
    if (!baseline2kWatts || avgWatts <= 0) return 'UT2'; // Default to UT2/Unknown

    const pct = avgWatts / baseline2kWatts;

    if (pct < 0.60) return 'UT2';
    if (pct < 0.75) return 'UT1';
    if (pct < 0.90) return 'AT';
    if (pct < 1.05) return 'TR';
    return 'AN';
};

export const getTargetSplitRange = (zone: TrainingZone, baseline2kWatts: number): string => {
    const zoneDef = ZONES.find(z => z.id === zone);
    if (!zoneDef) return '';

    // Watts Range
    const minW = baseline2kWatts * zoneDef.minPct;
    const maxW = baseline2kWatts * (zoneDef.maxPct >= 2 ? 1.5 : zoneDef.maxPct); // Cap AN at 150% for display

    // Watt -> Split (Inverse relationship: Higher Watts = Lower Split)
    // So MaxWatts = Fastest Split (MinSplit), MinWatts = Slowest Split (MaxSplit)
    const fastSplit = wattsToSplit(maxW);
    const slowSplit = wattsToSplit(minW);

    return `${formatSplit(fastSplit)} - ${formatSplit(slowSplit)}`;
};

/**
 * Parses workout data (splits or intervals) to calculate the exact duration spent in each zone.
 * Prioritizes intervals if available (more semantic), otherwise falls back to splits.
 */
export const calculateZoneDistribution = (rawData: Partial<C2ResultDetail> & Record<string, unknown>, baseline2kWatts: number): Record<TrainingZone, number> => {
    const distribution: Record<TrainingZone, number> = { UT2: 0, UT1: 0, AT: 0, TR: 0, AN: 0 };

    // Safety check
    if (!rawData || !baseline2kWatts) return distribution;

    // 1. Try STROKES (Highest Fidelity)
    const strokes = rawData.strokes || (rawData.data as Record<string, unknown>)?.strokes;

    if (Array.isArray(strokes) && strokes.length > 0) {
        let lastTime = 0;
        // Sometimes the first stroke t starts > 0.
        // We can't trust the delta from 0 for the first stroke since we didn't row from 0 to t[0] in one stroke usually?
        // Actually, stroke data tracks cumulative time.
        // Let's iterate.

        for (let i = 0; i < strokes.length; i++) {
            const stroke = strokes[i];
            const t = stroke.t; // deciseconds (1/10s)

            // Calculate Duration of this stroke
            // For first stroke, assumes it took 't' time (from 0).
            const durationDeci = i === 0 ? t : (t - lastTime);
            lastTime = t;

            // Avoid negative or zero duration (data glitches)
            if (durationDeci <= 0) continue;

            // Parse Pace/Power
            let watts = 0;
            if (stroke.watts) {
                watts = stroke.watts;
            } else if (stroke.p) {
                // p is Pace in deciseconds/500m ? 
                // e.g. 1258 => 125.8s / 500m => 2:05.8
                const paceSeconds = stroke.p / 10;
                watts = splitToWatts(paceSeconds);
            }

            if (watts > 0) {
                const zone = classifyWorkout(watts, baseline2kWatts);
                distribution[zone] += (durationDeci / 10); // Convert deciseconds to seconds
            } else {
                // If we have time but no power, counts as UT2 (Recovery?) or skip?
                // Let's count as UT2 for time-fidelity
                distribution['UT2'] += (durationDeci / 10);
            }
        }

        // If we successfully processed strokes, return.
        const total = Object.values(distribution).reduce((a, b) => a + b, 0);
        if (total > 0) return distribution;
    }

    // 2. Fallback to Intervals/Splits (Medium Fidelity)
    const intervals = rawData.workout?.intervals || (rawData.data as Record<string, unknown>)?.intervals;
    const splits = rawData.workout?.splits || (rawData.data as Record<string, unknown>)?.splits;
    const segments = (intervals || splits || []) as Array<C2Split | C2Interval>;

    for (const segment of segments) {
        // Check if this is a rest interval (only C2Interval has type field)
        if ('type' in segment && segment.type === 'rest') continue;

        const watts = segment.watts || 0;
        const duration = segment.time ? segment.time / 10 : 0; // deciseconds -> seconds

        if (duration > 0 && watts > 0) {
            const zone = classifyWorkout(watts, baseline2kWatts);
            distribution[zone] += duration;
        } else if (duration > 0) {
            distribution['UT2'] += duration;
        }
    }

    return distribution;
};

/**
 * Aggregates 5-watt power buckets into training zones based on baseline watts.
 * Used for visualizing power distribution by zone in a donut chart.
 * 
 * @param buckets - Record of watts -> seconds (e.g., {"120": 230.4, "125": 483.9})
 * @param baseline2kWatts - User's 2k baseline in watts
 * @returns Zone distribution with seconds and metadata
 */
export const aggregateBucketsByZone = (
    buckets: Record<string, number>,
    baseline2kWatts: number
): Array<{ zone: TrainingZone; seconds: number; color: string; label: string; wattsRange: string }> => {
    const distribution: Record<TrainingZone, number> = { UT2: 0, UT1: 0, AT: 0, TR: 0, AN: 0 };

    // Aggregate buckets into zones
    Object.entries(buckets).forEach(([wattsStr, seconds]) => {
        const watts = Number(wattsStr);
        const zone = classifyWorkout(watts, baseline2kWatts);
        distribution[zone] += seconds;
    });

    // Convert to array with metadata
    return ZONES.map(zoneDef => {
        const minW = Math.round(baseline2kWatts * zoneDef.minPct);
        const maxW = zoneDef.maxPct >= 2
            ? '∞'
            : Math.round(baseline2kWatts * zoneDef.maxPct).toString();

        return {
            zone: zoneDef.id,
            seconds: distribution[zoneDef.id],
            color: zoneDef.color,
            label: zoneDef.label,
            wattsRange: maxW === '∞' ? `> ${minW}W` : `${minW}-${maxW}W`
        };
    }).filter(z => z.seconds > 0); // Only include zones with data
};

/**
 * Calculates 5-watt power buckets directly from stroke data.
 * Used for client-side distribution analysis of specific intervals (Work only).
 */
export const calculateBucketsFromStrokes = (strokes: C2Stroke[]): Record<string, number> => {
    const buckets: Record<string, number> = {};

    strokes.forEach(s => {
        // Calculate Watts
        let watts = 0;
        // C2Stroke.p can be watts or pace depending on context
        // Heuristic: if p > 300, assume pace in deciseconds/500m
        if (s.p > 300) {
            watts = splitToWatts(s.p / 10);
        } else {
            watts = s.p;
        }

        // Calculate Duration (approximate from stroke data if not available, usually use difference in time)
        // But s.t is cumulative time. We don't have per-stroke duration easily without next/prev.
        // Wait, calculateZoneDistribution iterates and diffs `t`. We can do the same if we have the list.
        // The `strokes` passed here might be "stitched" or filtered, so `t` might not be continuous?
        // Actually `intervalsData` stitching (lines 203-206 in WorkoutDetail) modifies `d`. It keeps `t` as is?
        // No, `t` is relative to the start of the workout usually.
        // If we filter intervals, we lose the 'next' stroke to calc duration.
        // HOWEVER, Concept2 strokes usually represent ONE stroke cycle. 
        // We can estimate duration from SPM? 60 / SPM = Duration (seconds).

        let duration = 0;
        if (s.spm && s.spm > 0) {
            duration = 60 / s.spm;
        }

        if (watts > 0 && duration > 0) {
            // Round to nearest 5
            const bucket = Math.floor(watts / 5) * 5;
            buckets[bucket] = (buckets[bucket] || 0) + duration;
        }
    });

    return buckets;
};
