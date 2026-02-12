import { describe, it, expect } from 'vitest';
import {
    calculateWattsFromSplit,
    calculateSplitFromWatts,
    formatSplit,
    parsePaceToSeconds,
} from './paceCalculator';

describe('paceCalculator', () => {
    describe('calculateWattsFromSplit', () => {
        it('converts 2:00.0 split to ~203W', () => {
            // 2:00.0 = 120 seconds per 500m
            // 120/500 = 0.24, 0.24^3 = 0.013824, 2.8/0.013824 ≈ 202.55
            const watts = calculateWattsFromSplit(120);
            expect(watts).toBeCloseTo(202.55, 0);
        });

        it('converts 1:45.0 split to ~290W', () => {
            // 1:45.0 = 105 seconds per 500m
            const watts = calculateWattsFromSplit(105);
            // 2.8 / (105/500)^3 = 2.8 / (0.21)^3 = 2.8 / 0.009261 ≈ 302.3
            expect(watts).toBeCloseTo(302.3, 0);
        });

        it('converts 2:05.0 split', () => {
            // 2:05.0 = 125 seconds per 500m
            const watts = calculateWattsFromSplit(125);
            // 2.8 / (125/500)^3 = 2.8 / (0.25)^3 = 2.8 / 0.015625 = 179.2
            expect(watts).toBeCloseTo(179.2, 1);
        });

        it('handles very fast split (1:30)', () => {
            const watts = calculateWattsFromSplit(90);
            // 2.8 / (90/500)^3 = 2.8 / (0.18)^3 = 2.8 / 0.005832 ≈ 480.1
            expect(watts).toBeCloseTo(480.1, 0);
        });

        it('handles slow split (2:30)', () => {
            const watts = calculateWattsFromSplit(150);
            // 2.8 / (150/500)^3 = 2.8 / (0.3)^3 = 2.8 / 0.027 ≈ 103.7
            expect(watts).toBeCloseTo(103.7, 0);
        });

        it('returns raw float (no rounding)', () => {
            const watts = calculateWattsFromSplit(120);
            // Should NOT be exactly 200 if the formula doesn't round
            // 2.8 / (0.24)^3 = 2.8 / 0.013824 = 202.546...
            // Wait — 120/500 = 0.24, 0.24^3 = 0.013824, 2.8/0.013824 ≈ 202.546
            expect(watts).not.toBe(Math.round(watts));
        });
    });

    describe('calculateSplitFromWatts', () => {
        it('roundtrips with calculateWattsFromSplit', () => {
            const original = 120; // 2:00 split
            const watts = calculateWattsFromSplit(original);
            const recovered = calculateSplitFromWatts(watts);
            expect(recovered).toBeCloseTo(original, 6);
        });

        it('converts 200W to ~2:00 split', () => {
            const split = calculateSplitFromWatts(200);
            // 500 * (2.8/200)^(1/3) = 500 * (0.014)^(1/3) = 500 * 0.2410... ≈ 120.5
            // Actually: (2.8/200) = 0.014, cbrt(0.014) ≈ 0.24101, * 500 ≈ 120.5
            expect(split).toBeCloseTo(120.5, 0);
        });

        it('handles zero watts', () => {
            expect(calculateSplitFromWatts(0)).toBe(0);
        });

        it('handles negative watts', () => {
            expect(calculateSplitFromWatts(-10)).toBe(0);
        });
    });

    describe('formatSplit', () => {
        it('formats 120 seconds as 2:00.0', () => {
            expect(formatSplit(120)).toBe('2:00.0');
        });

        it('formats 105.5 seconds as 1:45.5', () => {
            expect(formatSplit(105.5)).toBe('1:45.5');
        });

        it('formats 90 seconds as 1:30.0', () => {
            expect(formatSplit(90)).toBe('1:30.0');
        });

        it('formats sub-minute correctly', () => {
            expect(formatSplit(45.2)).toBe('0:45.2');
        });
    });

    describe('parsePaceToSeconds', () => {
        it('parses "2:00.0" to 120', () => {
            expect(parsePaceToSeconds('2:00.0')).toBe(120);
        });

        it('parses "1:45.5" to 105.5', () => {
            expect(parsePaceToSeconds('1:45.5')).toBe(105.5);
        });

        it('rejects "2k+10" (not a pure pace)', () => {
            expect(parsePaceToSeconds('2k+10')).toBeNull();
        });

        it('rejects "UT2" (zone label)', () => {
            expect(parsePaceToSeconds('UT2')).toBeNull();
        });

        it('parses pure decimal "105.0" to 105', () => {
            expect(parsePaceToSeconds('105.0')).toBe(105);
        });
    });
});
