import type { C2Stroke, C2ResultDetail } from '../api/concept2.types';

export const stitchWorkStrokes = (strokes: C2Stroke[], detail: C2ResultDetail): C2Stroke[] => {
    if (!strokes || strokes.length === 0) return [];

    // 1. Segment strokes into "Raw Segments" based on distance resets
    const rawSegments: C2Stroke[][] = [];
    let currentRawSegment: C2Stroke[] = [];

    strokes.forEach((s, i) => {
        // If distance drops significantly (reset), start new segment
        // We use strict less than previous to detect reset
        if (i > 0 && s.d < strokes[i - 1].d) {
            rawSegments.push(currentRawSegment);
            currentRawSegment = [];
        }
        currentRawSegment.push(s);
    });
    if (currentRawSegment.length > 0) {
        rawSegments.push(currentRawSegment);
    }

    // 2. Refine into Work vs Rest based on definitions
    const intervalsData = rawSegments.map((segment, i) => {
        const def = detail.workout?.intervals?.[i];
        if (!def) {
            // Treat entire segment as work if no definition
            return { work: segment };
        }

        const isTime = def.type === 'time';
        const isDist = def.type === 'distance';

        let work: C2Stroke[] = [];

        if (isTime) {
            work = segment.filter(s => s.t <= def.time);
        } else if (isDist) {
            const targetDm = def.distance * 10;
            work = segment.filter(s => s.d <= targetDm);
        } else {
            work = segment;
        }
        return { work };
    });

    // 3. Stitch Work segments
    let visibleStrokes: C2Stroke[] = [];
    let cumulativeDist = 0;
    // For time-based stitching, we might need cumulative time instead.
    // But for Comparison Chart, we usually stick to Distance X-Axis for rowing.
    // (If it was a pure time workout, we might want time x-axis, but let's assume distance for now).

    intervalsData.forEach((item) => {
        const stitched = item.work.map(s => ({
            ...s,
            d: s.d + cumulativeDist
        }));
        visibleStrokes = visibleStrokes.concat(stitched);

        if (item.work.length > 0) {
            cumulativeDist += item.work[item.work.length - 1].d;
        }
    });

    // Fallback: If no intervals detected/stitched properly, return original
    // (e.g. single piece workout)
    if (visibleStrokes.length === 0 && strokes.length > 0) return strokes;

    return visibleStrokes;
};
