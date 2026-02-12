import { describe, it, expect } from 'vitest';
import {
    calculateWatts,
    calculatePaceFromWatts,
    formatTime,
    formatPace,
    formatWatts,
    calculatePRs,
    PR_DISTANCES,
    BENCHMARK_PATTERNS,
} from './prCalculator';

describe('prCalculator', () => {
    describe('calculateWatts', () => {
        it('converts 2:00 split (120s) to integer watts', () => {
            const watts = calculateWatts(120);
            // 2.8 / (120/500)^3 = 2.8 / 0.013824 ≈ 202.55 → rounds to 203
            expect(watts).toBe(203);
            expect(Number.isInteger(watts)).toBe(true);
        });

        it('converts 1:45 split (105s) to integer watts', () => {
            const watts = calculateWatts(105);
            // 2.8 / (105/500)^3 ≈ 302.3 → 302
            expect(watts).toBe(302);
        });

        it('handles zero input', () => {
            expect(calculateWatts(0)).toBe(0);
        });

        it('always returns an integer', () => {
            const testSplits = [90, 100, 110, 120, 130, 140, 150];
            for (const split of testSplits) {
                expect(Number.isInteger(calculateWatts(split))).toBe(true);
            }
        });
    });

    describe('calculatePaceFromWatts', () => {
        it('rounds-trips with calculateWatts approximately', () => {
            const originalPace = 120;
            const watts = calculateWatts(originalPace);
            const recoveredPace = calculatePaceFromWatts(watts);
            // Won't be exact due to rounding in calculateWatts, but should be close
            expect(recoveredPace).toBeCloseTo(originalPace, 0);
        });

        it('handles zero watts', () => {
            expect(calculatePaceFromWatts(0)).toBe(0);
        });
    });

    describe('formatTime', () => {
        it('formats 420 seconds as 7:00.0', () => {
            expect(formatTime(420)).toBe('7:00.0');
        });

        it('formats 125.5 seconds as 2:05.5', () => {
            expect(formatTime(125.5)).toBe('2:05.5');
        });
    });

    describe('formatPace', () => {
        it('formats 120 as 2:00.0', () => {
            expect(formatPace(120)).toBe('2:00.0');
        });
    });

    describe('formatWatts', () => {
        it('formats with w suffix', () => {
            expect(formatWatts(203)).toBe('203w');
        });

        it('rounds before formatting', () => {
            expect(formatWatts(202.7)).toBe('203w');
        });
    });

    describe('PR_DISTANCES', () => {
        it('has 8 standard distances', () => {
            expect(PR_DISTANCES).toHaveLength(8);
        });

        it('includes all required distances', () => {
            const meters = PR_DISTANCES.map(d => d.meters);
            expect(meters).toEqual([500, 1000, 2000, 5000, 6000, 10000, 21097, 42195]);
        });
    });

    describe('BENCHMARK_PATTERNS', () => {
        it('includes standard C2 benchmarks', () => {
            expect(BENCHMARK_PATTERNS).toContain('8x500m');
            expect(BENCHMARK_PATTERNS).toContain('4x2000m');
            expect(BENCHMARK_PATTERNS).toContain('30:00');
        });
    });

    describe('calculatePRs', () => {
        it('returns empty for no workouts', () => {
            expect(calculatePRs([])).toEqual([]);
        });

        it('detects a 2k PR from a single workout', () => {
            const workouts = [{
                id: 'w1',
                distance_meters: 2000,
                duration_seconds: 420, // 7:00.0
                completed_at: '2026-01-15',
                raw_data: null,
            }];

            const prs = calculatePRs(workouts);
            const twok = prs.find(p => p.distance === 2000);
            expect(twok).toBeDefined();
            expect(twok!.time).toBe(420);
            expect(twok!.label).toBe('2k');
            expect(twok!.source).toBe('distance');
        });

        it('picks the faster of two workouts at same distance', () => {
            const workouts = [
                {
                    id: 'w1',
                    distance_meters: 2000,
                    duration_seconds: 430,
                    completed_at: '2026-01-10',
                    raw_data: null,
                },
                {
                    id: 'w2',
                    distance_meters: 2000,
                    duration_seconds: 420,
                    completed_at: '2026-01-15',
                    raw_data: null,
                },
            ];

            const prs = calculatePRs(workouts);
            const twok = prs.find(p => p.distance === 2000);
            expect(twok!.time).toBe(420);
            expect(twok!.workoutId).toBe('w2');
        });

        it('detects PRs from interval splits', () => {
            const workouts = [{
                id: 'w1',
                distance_meters: 4000,
                duration_seconds: 900,
                completed_at: '2026-01-15',
                raw_data: {
                    workout: {
                        intervals: [
                            { type: 'distance', distance: 2000, time: 4200, stroke_rate: 28 }, // 420s → 2k
                            { type: 'rest', distance: 0, time: 600, stroke_rate: 0 },
                            { type: 'distance', distance: 2000, time: 4300, stroke_rate: 27 }, // 430s → 2k  
                        ]
                    }
                },
            }];

            const prs = calculatePRs(workouts);
            const twok = prs.find(p => p.distance === 2000 && !p.isInterval);
            expect(twok).toBeDefined();
            // Should pick the faster split (420s)
            expect(twok!.time).toBe(420);
            expect(twok!.source).toBe('interval_split');
        });

        it('calculates pace correctly (seconds per 500m)', () => {
            const workouts = [{
                id: 'w1',
                distance_meters: 2000,
                duration_seconds: 420,
                completed_at: '2026-01-15',
                raw_data: null,
            }];

            const prs = calculatePRs(workouts);
            const twok = prs.find(p => p.distance === 2000);
            // pace = (420 / 2000) * 500 = 105
            expect(twok!.pace).toBe(105);
        });

        it('sorts distance PRs before interval PRs', () => {
            const workouts = [
                {
                    id: 'w1',
                    distance_meters: 2000,
                    duration_seconds: 420,
                    completed_at: '2026-01-15',
                    raw_data: null,
                },
                {
                    id: 'w2',
                    distance_meters: 4000,
                    duration_seconds: 860,
                    completed_at: '2026-01-20',
                    raw_data: {
                        workout: {
                            intervals: [
                                { type: 'distance', distance: 500, time: 950, stroke_rate: 30 },
                                { type: 'rest', distance: 0, time: 1800, stroke_rate: 0 },
                                { type: 'distance', distance: 500, time: 960, stroke_rate: 30 },
                                { type: 'rest', distance: 0, time: 1800, stroke_rate: 0 },
                                { type: 'distance', distance: 500, time: 940, stroke_rate: 30 },
                                { type: 'rest', distance: 0, time: 1800, stroke_rate: 0 },
                                { type: 'distance', distance: 500, time: 970, stroke_rate: 30 },
                                { type: 'rest', distance: 0, time: 1800, stroke_rate: 0 },
                                { type: 'distance', distance: 500, time: 950, stroke_rate: 30 },
                                { type: 'rest', distance: 0, time: 1800, stroke_rate: 0 },
                                { type: 'distance', distance: 500, time: 955, stroke_rate: 30 },
                                { type: 'rest', distance: 0, time: 1800, stroke_rate: 0 },
                                { type: 'distance', distance: 500, time: 945, stroke_rate: 30 },
                                { type: 'rest', distance: 0, time: 1800, stroke_rate: 0 },
                                { type: 'distance', distance: 500, time: 960, stroke_rate: 30 },
                            ]
                        }
                    },
                },
            ];

            const prs = calculatePRs(workouts);
            const distancePRs = prs.filter(p => !p.isInterval);
            const intervalPRs = prs.filter(p => p.isInterval);

            if (distancePRs.length > 0 && intervalPRs.length > 0) {
                const lastDistIdx = prs.indexOf(distancePRs[distancePRs.length - 1]);
                const firstIntIdx = prs.indexOf(intervalPRs[0]);
                expect(lastDistIdx).toBeLessThan(firstIntIdx);
            }
        });
    });
});
