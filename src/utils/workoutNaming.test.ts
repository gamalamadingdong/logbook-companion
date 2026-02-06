import { describe, it, expect } from 'vitest';
import { calculateCanonicalName } from './workoutNaming';
import type { C2Interval } from '../api/concept2.types';

describe('workoutNaming logic', () => {

    it('identifies exact distance single interval', () => {
        const intervals: C2Interval[] = [
            { type: 'distance', distance: 2000, time: 4200, stroke_rate: 24 } as C2Interval
        ];
        expect(calculateCanonicalName(intervals)).toBe('2000m');
    });

    it('identifies exact time single interval', () => {
        const intervals: C2Interval[] = [
            { type: 'time', distance: 5000, time: 18000, stroke_rate: 22 } as C2Interval // 30:00
        ];
        expect(calculateCanonicalName(intervals)).toBe('30:00');
    });

    it('identifies repeating distance intervals', () => {
        const intervals: C2Interval[] = [
            { type: 'distance', distance: 500, time: 1100, rest_time: 600 } as C2Interval,
            { type: 'distance', distance: 500, time: 1100, rest_time: 600 } as C2Interval,
            { type: 'distance', distance: 500, time: 1100, rest_time: 600 } as C2Interval,
            { type: 'distance', distance: 500, time: 1100, rest_time: 0 } as C2Interval
        ];
        expect(calculateCanonicalName(intervals)).toBe('4x500m/1:00r');
    });

    it('identifies repeating time intervals', () => {
        const intervals: C2Interval[] = [
            { type: 'time', distance: 0, time: 1800, rest_time: 300 } as C2Interval, // 3:00 work, 30s rest? 300 = 30.0s
            { type: 'time', distance: 0, time: 1800, rest_time: 300 } as C2Interval,
            { type: 'time', distance: 0, time: 1800, rest_time: 300 } as C2Interval
        ];
        // 1800 / 10 = 180s = 3:00
        // 300 / 10 = 30s = 0:30r
        expect(calculateCanonicalName(intervals)).toBe('3x3:00/0:30r');
    });

    it('identifies variable intervals (pyramid)', () => {
        // v500m/1000m/1500m/1000m/500m Pyramid
        const intervals: C2Interval[] = [
            { type: 'distance', distance: 500, time: 1000 } as C2Interval,
            { type: 'distance', distance: 1000, time: 2000 } as C2Interval,
            { type: 'distance', distance: 1500, time: 3000 } as C2Interval,
            { type: 'distance', distance: 1000, time: 2000 } as C2Interval,
            { type: 'distance', distance: 500, time: 1000 } as C2Interval,
        ];
        expect(calculateCanonicalName(intervals)).toBe('v500m... Pyramid'); // As per current impl
    });

    it('identifies complex blocks', () => {
        // 2 x (4 x 500m)
        // 4 intervals of 500m with 1:00r, then long rest, then 4 more
        const block1 = Array(4).fill(null).map((_,) => ({
            type: 'distance', distance: 500, time: 1000, rest_time: 600 // 1:00r
        } as C2Interval));

        // Modify last rest of block 1 to be long (e.g. 5:00r = 3000 ds)
        block1[3].rest_time = 3000;

        const block2 = Array(4).fill(null).map((_,) => ({
            type: 'distance', distance: 500, time: 1000, rest_time: 600 // 1:00r
        } as C2Interval));
        block2[3].rest_time = 0; // End

        const intervals = [...block1, ...block2];
        expect(calculateCanonicalName(intervals)).toBe('2 x (4 x 500m)');
    });


    it('identifies short ladder (3 items)', () => {
        // 2000m, 1000m, 500m
        const intervals: C2Interval[] = [
            { type: 'distance', distance: 2000, time: 4200 } as C2Interval,
            { type: 'distance', distance: 1000, time: 2100 } as C2Interval,
            { type: 'distance', distance: 500, time: 1050 } as C2Interval,
        ];
        expect(calculateCanonicalName(intervals)).toContain('Ladder');
        expect(calculateCanonicalName(intervals)).toBe('v2000m...500m Ladder');
    });

    it('identifies short pyramid (3 items)', () => {
        // 500m, 1000m, 500m
        const intervals: C2Interval[] = [
            { type: 'distance', distance: 500, time: 1050 } as C2Interval,
            { type: 'distance', distance: 1000, time: 2100 } as C2Interval,
            { type: 'distance', distance: 500, time: 1050 } as C2Interval,
        ];
        expect(calculateCanonicalName(intervals)).toContain('Pyramid');
        expect(calculateCanonicalName(intervals)).toBe('v500m... Pyramid');
    });

});
