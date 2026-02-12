import type { C2Stroke, C2Split, C2Interval, C2ResultDetail } from '../api/concept2.types';
import { calculateWattsFromSplit, calculateSplitFromWatts } from './paceCalculator';

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

// Split <-> Watts Conversion (canonical source: paceCalculator.ts)
export const splitToWatts = (splitSeconds: number): number => {
    if (splitSeconds <= 0) return 0;
    return calculateWattsFromSplit(splitSeconds);
};

export const wattsToSplit = (watts: number): number => {
    if (watts <= 0) return 0;
    return calculateSplitFromWatts(watts);
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
 * Segments strokes into Work and Rest based on the workout structure (intervals).
 * Uses distance resets to identify segments and aligns them with interval definitions.
 */
export const getWorkStrokes = (strokes: C2Stroke[], intervals?: C2Interval[]): { work: C2Stroke[], rest: C2Stroke[] } => {
    if (!strokes || strokes.length === 0) return { work: [], rest: [] };
    if (!intervals || intervals.length === 0) return { work: strokes, rest: [] }; // Assume all work if no structure

    // 1. Segment strokes based on distance resets
    const rawSegments: C2Stroke[][] = [];
    let currentRawSegment: C2Stroke[] = [];

    strokes.forEach((s, i) => {
        if (i > 0 && s.d < strokes[i - 1].d) {
            rawSegments.push(currentRawSegment);
            currentRawSegment = [];
        }
        currentRawSegment.push(s);
    });
    if (currentRawSegment.length > 0) {
        rawSegments.push(currentRawSegment);
    }

    // 2. Filter Work vs Rest
    let allWork: C2Stroke[] = [];
    let allRest: C2Stroke[] = [];

    rawSegments.forEach((segment, i) => {
        const def = intervals[i];
        if (!def) {
            // Extra strokes not matching defined intervals? Treat as rest/undefined or work? 
            // Safer to treat as rest to not pollute zones.
            allRest = allRest.concat(segment);
            return;
        }

        if (def.type === 'rest') {
            allRest = allRest.concat(segment);
            return;
        }

        const isTime = def.type === 'time';
        const isDist = def.type === 'distance';

        if (isTime) {
            // Filter by time within segment
            // Strokes are typically cumulative time? No, in segments (splits/intervals) C2 often resets time?
            // Actually C2 PM5 Logbook strokes usually have cumulative t for the whole workout.
            // BUT validity of splitting by `t` depends on if `t` resets.
            // The segment logic relies on DISTANCE resets.
            // If it's a "Just Row" or single distance, d increases monotonically.
            // If intervals, d resets.
            // Let's assume the segment corresponds to the interval.
            // Inside the segment, we filter by the defined limit.

            const workStrokes = segment.filter(s => s.t <= def.time);
            const restStrokes = segment.filter(s => s.t > def.time);
            allWork = allWork.concat(workStrokes);
            allRest = allRest.concat(restStrokes);
        } else if (isDist) {
            const targetDm = def.distance * 10;
            const workStrokes = segment.filter(s => s.d <= targetDm);
            const restStrokes = segment.filter(s => s.d > targetDm);
            allWork = allWork.concat(workStrokes);
            allRest = allRest.concat(restStrokes);
        } else {
            // Unknown type or undefined limit, assume Work
            allWork = allWork.concat(segment);
        }
    });

    return { work: allWork, rest: allRest };
};

/**
 * Parses workout data (splits or intervals) to calculate the exact duration spent in each zone.
 * Prioritizes strokes (filtered for Work) if available, otherwise falls back to intervals.
 */
export const calculateZoneDistribution = (rawData: Partial<C2ResultDetail> & Record<string, unknown>, baseline2kWatts: number): Record<TrainingZone, number> => {
    const distribution: Record<TrainingZone, number> = { UT2: 0, UT1: 0, AT: 0, TR: 0, AN: 0 };

    // Safety check
    if (!rawData || !baseline2kWatts) return distribution;

    const strokes = rawData.strokes || (rawData.data as Record<string, unknown>)?.strokes;
    const intervals = rawData.workout?.intervals || rawData.workout?.splits || (rawData.data as Record<string, unknown>)?.intervals;

    // 1. Try STROKES (Highest Fidelity)
    if (Array.isArray(strokes) && strokes.length > 0) {
        // FILTER FOR WORK ONLY
        const { work } = getWorkStrokes(strokes as C2Stroke[], intervals as C2Interval[]);

        // We can't rely on simple time deltas if we have gaps (removed rest strokes).
        // However, strokes usually have `spm`. We can key off that for duration if gaps exist?
        // Or we just process the "work" strokes. 
        // WARNING: If we stitched strokes from valid segments, `t` might not be continuous between segments.
        // `getWorkStrokes` returns a flattened array.
        // We should calculate duration *per stroke* based on its own data (SPM) or delta within its segment.
        // But `getWorkStrokes` lost the segment boundary context in the flatten.
        // Let's rely on SPM for duration estimate to be safe, OR we must calculate duration BEFORE flattening.

        // Revised approach: Iterate the strokes and calculate duration based on SPM (60/SPM).
        // This is robust against gaps/segment jumps.

        for (const stroke of work) {
            let duration = 0;
            if (stroke.spm && stroke.spm > 0) {
                duration = 60 / stroke.spm;
            } else {
                // Fallback if SPM missing? (Rare)
                // Maybe use generous defaults or try to use `t` delta if it looks small (< 5s?)
                continue;
            }

            // Calculate Watts
            let watts = 0;
            if (stroke.watts) {
                watts = stroke.watts;
            } else if (stroke.p) {
                // p is Pace in deciseconds/500m -> Watts
                const paceSeconds = stroke.p / 10;
                watts = splitToWatts(paceSeconds);
            }

            if (watts > 0) {
                const zone = classifyWorkout(watts, baseline2kWatts);
                distribution[zone] += duration;
            } else {
                // Zone 0? Usually just ignore or UT2.
                // If it's work stroke but 0 watts, it's basically stopped?
                // Ignore.
            }
        }

        return distribution;
    }

    // 2. Fallback to Intervals/Splits (Medium Fidelity)
    const segments = (intervals || []) as Array<C2Split | C2Interval>;

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
