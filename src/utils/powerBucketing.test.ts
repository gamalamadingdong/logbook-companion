import { describe, it, expect } from 'vitest';
import { paceToWatts, calculatePowerBuckets } from './powerBucketing';
import type { C2Stroke } from '../api/concept2.types';

describe('powerBucketing', () => {
    describe('paceToWatts', () => {
        it('converts decisecond pace to watts (1200 = 2:00.0 → ~203W)', () => {
            // 1200 deciseconds = 120 seconds per 500m
            // 120/500 = 0.24, 0.24^3 = 0.013824, 2.8/0.013824 ≈ 202.55
            const watts = paceToWatts(1200);
            expect(watts).toBe(Math.round(202.546));
            expect(watts).toBe(203);
        });

        it('converts 1050 deciseconds (1:45.0 → ~302W)', () => {
            // 1050/10 = 105 seconds, 105/500 = 0.21, 0.21^3 = 0.009261
            // 2.8/0.009261 ≈ 302.3
            const watts = paceToWatts(1050);
            expect(watts).toBe(302);
        });

        it('handles zero', () => {
            expect(paceToWatts(0)).toBe(0);
        });

        it('handles negative', () => {
            expect(paceToWatts(-100)).toBe(0);
        });

        it('rounds result to integer', () => {
            const watts = paceToWatts(1179); // 1:57.9
            expect(Number.isInteger(watts)).toBe(true);
        });

        it('returns same result as manual C2 formula', () => {
            // Manual: 1500 deciseconds = 150 seconds = 2:30.0
            // 150/500 = 0.30, 0.30^3 = 0.027, 2.80/0.027 ≈ 103.7 → round = 104
            expect(paceToWatts(1500)).toBe(104);
        });
    });

    describe('calculatePowerBuckets', () => {
        it('returns empty for empty strokes', () => {
            expect(calculatePowerBuckets([])).toEqual({});
        });

        it('buckets strokes by 5W floor', () => {
            const strokes: C2Stroke[] = [
                { t: 0, d: 0, p: 200, spm: 28, hr: 150 },  // 200W direct
                { t: 21, d: 10, p: 203, spm: 28, hr: 150 }, // 203W → bucket 200
                { t: 43, d: 20, p: 207, spm: 28, hr: 150 }, // 207W → bucket 205
            ];
            const result = calculatePowerBuckets(strokes);
            // 200W bucket: 2 strokes × (60/28) ≈ 2 × 2.14 ≈ 4.3s
            // 205W bucket: 1 stroke × (60/28) ≈ 2.14s
            expect(result['200']).toBeGreaterThan(0);
            expect(result['205']).toBeGreaterThan(0);
        });

        it('handles pace values (p > 300) by converting with paceToWatts', () => {
            // p=1200 → paceToWatts(1200) = 203W → bucket 200
            const strokes: C2Stroke[] = [
                { t: 0, d: 0, p: 1200, spm: 28, hr: 150 },
            ];
            const result = calculatePowerBuckets(strokes);
            // 203W → bucket 200 (floor to 5)
            expect(result['200']).toBeGreaterThan(0);
        });

        it('skips strokes with no SPM', () => {
            const strokes: C2Stroke[] = [
                { t: 0, d: 0, p: 200, spm: 0, hr: 150 },
            ];
            const result = calculatePowerBuckets(strokes);
            expect(Object.keys(result).length).toBe(0);
        });
    });
});
