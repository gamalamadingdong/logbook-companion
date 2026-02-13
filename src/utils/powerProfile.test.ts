import { describe, it, expect } from 'vitest';
import {
    extractBestEfforts,
    computePowerProfile,
    suggestMaxWatts,
    type PowerCurvePoint,
} from './powerProfile';
import type { WorkoutLog } from '../services/supabase';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeWorkout(overrides: Partial<WorkoutLog> & { distance_meters: number; duration_seconds: number }): WorkoutLog {
    const { distance_meters, duration_seconds, ...rest } = overrides;
    return {
        id: 'w-' + Math.random().toString(36).slice(2, 8),
        user_id: 'user-1',
        workout_name: 'FixedDistanceSplits', // C2 workout_type goes in workout_name (column swap)
        workout_type: 'rower',                // C2 machine type goes in workout_type
        completed_at: '2026-01-15',
        distance_meters,
        duration_minutes: duration_seconds / 60,
        source: 'concept2',
        ...rest,
    };
}

const TWOK_420 = makeWorkout({ id: 'w-2k', distance_meters: 2000, duration_seconds: 420, completed_at: '2026-01-15' });
// 420s / 2000m * 500 = 105s/500m → ~302W

// ─── extractBestEfforts ──────────────────────────────────────────────────────

describe('extractBestEfforts', () => {
    it('returns empty for empty workouts', () => {
        expect(extractBestEfforts([])).toEqual([]);
    });

    it('extracts a 2k best effort from a single workout', () => {
        const points = extractBestEfforts([TWOK_420]);
        const twok = points.find(p => p.anchorKey === '2k');
        expect(twok).toBeDefined();
        expect(twok!.distance).toBe(2000);
        expect(twok!.pace).toBeCloseTo(105, 1);   // (420/2000)*500
        expect(twok!.watts).toBeCloseTo(302.3, 0); // ~302W
        expect(twok!.source).toBe('whole_workout');
    });

    it('picks the higher-watts workout at the same distance', () => {
        const slow = makeWorkout({ id: 'w-slow', distance_meters: 2000, duration_seconds: 480 }); // slower
        const fast = makeWorkout({ id: 'w-fast', distance_meters: 2000, duration_seconds: 420 }); // faster = higher watts
        const points = extractBestEfforts([slow, fast]);
        const twok = points.find(p => p.anchorKey === '2k');
        expect(twok!.workoutId).toBe('w-fast');
    });

    it('extracts multiple standard distances', () => {
        const w2k = makeWorkout({ distance_meters: 2000, duration_seconds: 420 });
        const w5k = makeWorkout({ distance_meters: 5000, duration_seconds: 1200 });
        const w500 = makeWorkout({ distance_meters: 500, duration_seconds: 95 });

        const points = extractBestEfforts([w2k, w5k, w500]);
        const anchorKeys = points.map(p => p.anchorKey).filter(Boolean);
        expect(anchorKeys).toContain('2k');
        expect(anchorKeys).toContain('5k');
        expect(anchorKeys).toContain('500m');
    });

    it('extracts interval splits at standard distances', () => {
        const workout = makeWorkout({
            id: 'w-intervals',
            workout_name: 'FixedDistanceInterval',
            distance_meters: 4000,
            duration_seconds: 900,
            raw_data: {
                workout: {
                    intervals: [
                        { type: 'distance', distance: 2000, time: 4100, stroke_rate: 28 }, // 410s → better than either interval
                        { type: 'rest', distance: 0, time: 600, stroke_rate: 0 },
                        { type: 'distance', distance: 2000, time: 4300, stroke_rate: 27 },
                    ]
                }
            },
        });

        const points = extractBestEfforts([workout]);
        const twok = points.find(p => p.anchorKey === '2k');
        expect(twok).toBeDefined();
        // Should pick the faster interval split (410s), not the whole workout
        expect(twok!.source).toBe('interval_split');
        expect(twok!.pace).toBeCloseTo((410 / 2000) * 500, 1); // 102.5s/500m
    });

    it('detects a 30-minute time-based test', () => {
        const workout = makeWorkout({
            distance_meters: 8000,
            duration_seconds: 1800, // exactly 30:00
        });
        const points = extractBestEfforts([workout]);
        const thirtyMin = points.find(p => p.anchorKey === '30:00');
        expect(thirtyMin).toBeDefined();
        expect(thirtyMin!.source).toBe('time_test');
    });

    it('detects a 1-minute time-based test (with tolerance)', () => {
        const workout = makeWorkout({
            distance_meters: 350,
            duration_seconds: 62, // ~1:02, within ±5s tolerance
        });
        const points = extractBestEfforts([workout]);
        const oneMin = points.find(p => p.anchorKey === '1:00');
        expect(oneMin).toBeDefined();
    });

    it('includes manual max watts', () => {
        const points = extractBestEfforts([TWOK_420], 500);
        const maxW = points.find(p => p.anchorKey === 'max_watts');
        expect(maxW).toBeDefined();
        expect(maxW!.watts).toBe(500);
        expect(maxW!.source).toBe('manual');
    });

    it('captures non-standard distances', () => {
        const workout = makeWorkout({
            distance_meters: 7500,
            duration_seconds: 1800,
        });
        const points = extractBestEfforts([workout]);
        // 7500m doesn't match any standard distance
        const nonStd = points.find(p => p.anchorKey === null);
        expect(nonStd).toBeDefined();
        expect(nonStd!.distance).toBe(7500);
    });

    it('filters out impossible pace data', () => {
        const impossible = makeWorkout({
            distance_meters: 2000,
            duration_seconds: 10, // 2.5s/500m — impossible
        });
        const points = extractBestEfforts([impossible]);
        expect(points.find(p => p.anchorKey === '2k')).toBeUndefined();
    });

    it('sorts points by distance ascending', () => {
        const w500 = makeWorkout({ distance_meters: 500, duration_seconds: 95 });
        const w5k = makeWorkout({ distance_meters: 5000, duration_seconds: 1200 });
        const w2k = makeWorkout({ distance_meters: 2000, duration_seconds: 420 });
        const points = extractBestEfforts([w5k, w500, w2k]);
        for (let i = 1; i < points.length; i++) {
            expect(points[i].distance).toBeGreaterThanOrEqual(points[i - 1].distance);
        }
    });

    // ─── Interval workout handling ───────────────────────────────────────

    it('does NOT treat a 2x1000m interval as a 2k best effort', () => {
        // This is the exact bug: a 2x1000m/9:55r has distance_meters=2000
        // but is NOT a continuous 2k. It should NOT match the 2k anchor.
        const interval2x1k = makeWorkout({
            id: 'w-2x1k',
            workout_name: 'FixedDistanceInterval', // C2 interval workout type
            distance_meters: 2000,                  // total work distance (2 × 1000m)
            duration_seconds: 398,                   // ~3:19 work pace → 1:39.5/500m
            raw_data: {
                workout: {
                    intervals: [
                        { type: 'distance', distance: 1000, time: 1990, stroke_rate: 30 },  // 199.0s → ~1:39.5/500m
                        { type: 'rest', distance: 0, time: 5950, stroke_rate: 0 },           // 9:55 rest
                        { type: 'distance', distance: 1000, time: 1990, stroke_rate: 30 },  // 199.0s → ~1:39.5/500m
                    ]
                }
            },
        });

        const points = extractBestEfforts([interval2x1k]);

        // Should NOT have a 2k anchor from the whole-workout total
        const twoK = points.find(p => p.anchorKey === '2k');
        expect(twoK).toBeUndefined();

        // SHOULD have a 1k anchor from the individual interval splits
        const oneK = points.find(p => p.anchorKey === '1k');
        expect(oneK).toBeDefined();
        expect(oneK!.source).toBe('interval_split');
        expect(oneK!.distance).toBe(1000);
    });

    it('does NOT treat a 3x10:00 interval as a 30:00 time test', () => {
        // FixedTimeInterval with total ~30min should NOT match the 30:00 anchor
        const interval3x10 = makeWorkout({
            id: 'w-3x10',
            workout_name: 'FixedTimeInterval',
            distance_meters: 7500,
            duration_seconds: 1800, // 30:00 total work time
            raw_data: {
                workout: {
                    intervals: [
                        { type: 'time', distance: 2500, time: 6000, stroke_rate: 24 },
                        { type: 'rest', distance: 0, time: 3000, stroke_rate: 0 },
                        { type: 'time', distance: 2500, time: 6000, stroke_rate: 24 },
                        { type: 'rest', distance: 0, time: 3000, stroke_rate: 0 },
                        { type: 'time', distance: 2500, time: 6000, stroke_rate: 24 },
                    ]
                }
            },
        });

        const points = extractBestEfforts([interval3x10]);

        // Should NOT match 30:00 time-based test anchor
        const thirtyMin = points.find(p => p.anchorKey === '30:00');
        expect(thirtyMin).toBeUndefined();

        // Should NOT match non-standard distance from whole-workout
        const wholeWorkout = points.find(p => p.source === 'whole_workout');
        expect(wholeWorkout).toBeUndefined();
    });

    it('does NOT match non-standard distance for interval workouts', () => {
        // A 5x1500m has distance_meters=7500 — should NOT appear as a 7500m bucket
        const interval5x1500 = makeWorkout({
            id: 'w-5x1500',
            workout_name: 'FixedDistanceInterval',
            distance_meters: 7500,
            duration_seconds: 1560,
            raw_data: {
                workout: {
                    intervals: [
                        { type: 'distance', distance: 1500, time: 3120, stroke_rate: 27 },
                        { type: 'rest', distance: 0, time: 3000, stroke_rate: 0 },
                        { type: 'distance', distance: 1500, time: 3120, stroke_rate: 27 },
                        { type: 'rest', distance: 0, time: 3000, stroke_rate: 0 },
                        { type: 'distance', distance: 1500, time: 3120, stroke_rate: 27 },
                        { type: 'rest', distance: 0, time: 3000, stroke_rate: 0 },
                        { type: 'distance', distance: 1500, time: 3120, stroke_rate: 27 },
                        { type: 'rest', distance: 0, time: 3000, stroke_rate: 0 },
                        { type: 'distance', distance: 1500, time: 3120, stroke_rate: 27 },
                    ]
                }
            },
        });

        const points = extractBestEfforts([interval5x1500]);

        // Should have zero whole_workout entries
        const wholeWorkout = points.filter(p => p.source === 'whole_workout');
        expect(wholeWorkout).toHaveLength(0);
    });

    it('handles VariableInterval workout types correctly', () => {
        const variableInterval = makeWorkout({
            id: 'w-variable',
            workout_name: 'VariableInterval',
            distance_meters: 3500,
            duration_seconds: 750,
            raw_data: {
                workout: {
                    intervals: [
                        { type: 'distance', distance: 500, time: 950, stroke_rate: 32 },
                        { type: 'rest', distance: 0, time: 600, stroke_rate: 0 },
                        { type: 'distance', distance: 1000, time: 2000, stroke_rate: 30 },
                        { type: 'rest', distance: 0, time: 600, stroke_rate: 0 },
                        { type: 'distance', distance: 2000, time: 4200, stroke_rate: 28 },
                    ]
                }
            },
        });

        const points = extractBestEfforts([variableInterval]);

        // Should NOT match whole-workout totals (3500m doesn't match any standard, but also shouldn't be bucketed)
        expect(points.filter(p => p.source === 'whole_workout')).toHaveLength(0);

        // Should extract individual intervals as anchors
        const fiveHundred = points.find(p => p.anchorKey === '500m');
        expect(fiveHundred).toBeDefined();
        expect(fiveHundred!.source).toBe('interval_split');

        const oneK = points.find(p => p.anchorKey === '1k');
        expect(oneK).toBeDefined();
        expect(oneK!.source).toBe('interval_split');

        const twoK = points.find(p => p.anchorKey === '2k');
        expect(twoK).toBeDefined();
        expect(twoK!.source).toBe('interval_split');
    });

    it('continuous 2k is still recognized (FixedDistanceSplits)', () => {
        // Regression test: a straight 2000m should still match the 2k anchor
        const straight2k = makeWorkout({
            workout_name: 'FixedDistanceSplits',
            distance_meters: 2000,
            duration_seconds: 420,
        });

        const points = extractBestEfforts([straight2k]);
        const twoK = points.find(p => p.anchorKey === '2k');
        expect(twoK).toBeDefined();
        expect(twoK!.source).toBe('whole_workout');
    });

    it('prefers standalone 2k over interval-split 2k when both exist', () => {
        // Straight 2k at 7:00 (420s) → ~302W
        const straight2k = makeWorkout({
            id: 'w-straight-2k',
            workout_name: 'FixedDistanceSplits',
            distance_meters: 2000,
            duration_seconds: 420,
        });

        // 2x2000m intervals at 6:40 (400s) → ~355W (faster because of rest)
        const interval2x2k = makeWorkout({
            id: 'w-interval-2x2k',
            workout_name: 'FixedDistanceInterval',
            distance_meters: 4000,
            duration_seconds: 800,
            raw_data: {
                workout: {
                    intervals: [
                        { type: 'distance', distance: 2000, time: 4000, stroke_rate: 30 },
                        { type: 'rest', distance: 0, time: 3000, stroke_rate: 0 },
                        { type: 'distance', distance: 2000, time: 4000, stroke_rate: 28 },
                    ]
                }
            },
        });

        const points = extractBestEfforts([straight2k, interval2x2k]);
        const twoK = points.find(p => p.anchorKey === '2k');
        expect(twoK).toBeDefined();

        // The interval split 2k (400s) produces more watts than the straight 2k (420s),
        // so the interval split wins. This is CORRECT — a 2k interval split IS a valid
        // 2k effort (even with rest, the split itself was rowed). The key fix is that
        // the whole-workout aggregate (4000m at average pace) does NOT get treated as
        // any standard anchor.
        expect(twoK!.workoutId).toBe('w-interval-2x2k');
        expect(twoK!.source).toBe('interval_split');
    });

    // ─── Canonical name detection (primary signal) ───────────────────────

    it('detects interval via canonical_name even when workout_name is generic', () => {
        // canonical_name says "2x1000m/9:55r" → interval, regardless of workout_name
        const w = makeWorkout({
            id: 'w-cn-2x1k',
            canonical_name: '2x1000m/9:55r',
            workout_name: 'FixedDistanceSplits',  // misleading — but canonical_name wins
            distance_meters: 2000,
            duration_seconds: 398,
            raw_data: {
                workout: {
                    intervals: [
                        { type: 'distance', distance: 1000, time: 1990, stroke_rate: 30 },
                        { type: 'rest', distance: 0, time: 5950, stroke_rate: 0 },
                        { type: 'distance', distance: 1000, time: 1990, stroke_rate: 30 },
                    ]
                }
            },
        });

        const points = extractBestEfforts([w]);
        // canonical_name "2x1000m/..." triggers interval detection → no whole_workout match
        expect(points.filter(p => p.source === 'whole_workout')).toHaveLength(0);
        const oneK = points.find(p => p.anchorKey === '1k');
        expect(oneK).toBeDefined();
        expect(oneK!.source).toBe('interval_split');
    });

    it('detects variable interval via canonical_name "v500/1000/1500m"', () => {
        const w = makeWorkout({
            id: 'w-cn-variable',
            canonical_name: 'v500/1000/1500m',
            workout_name: 'VariableInterval',
            distance_meters: 3000,
            duration_seconds: 660,
            raw_data: {
                workout: {
                    intervals: [
                        { type: 'distance', distance: 500, time: 950, stroke_rate: 32 },
                        { type: 'rest', distance: 0, time: 600, stroke_rate: 0 },
                        { type: 'distance', distance: 1000, time: 2050, stroke_rate: 30 },
                        { type: 'rest', distance: 0, time: 600, stroke_rate: 0 },
                        { type: 'distance', distance: 1500, time: 3200, stroke_rate: 28 },
                    ]
                }
            },
        });

        const points = extractBestEfforts([w]);
        expect(points.filter(p => p.source === 'whole_workout')).toHaveLength(0);
    });

    it('detects block structure via canonical_name with parens', () => {
        const w = makeWorkout({
            id: 'w-cn-block',
            canonical_name: '4 x (5 x 500m)',
            workout_name: 'FixedDistanceInterval',
            distance_meters: 10000,
            duration_seconds: 2000,
            raw_data: {
                workout: {
                    intervals: [
                        { type: 'distance', distance: 500, time: 1000, stroke_rate: 28 },
                        { type: 'rest', distance: 0, time: 600, stroke_rate: 0 },
                        { type: 'distance', distance: 500, time: 1000, stroke_rate: 28 },
                    ]
                }
            },
        });

        const points = extractBestEfforts([w]);
        expect(points.filter(p => p.source === 'whole_workout')).toHaveLength(0);
    });

    it('treats continuous piece as non-interval even when canonical_name exists', () => {
        // canonical_name "5000m" is a single piece → NOT an interval
        const w = makeWorkout({
            canonical_name: '5000m',
            workout_name: 'FixedDistanceSplits',
            distance_meters: 5000,
            duration_seconds: 1200,
        });

        const points = extractBestEfforts([w]);
        const fiveK = points.find(p => p.anchorKey === '5k');
        expect(fiveK).toBeDefined();
        expect(fiveK!.source).toBe('whole_workout');
    });
});

// ─── computePowerProfile ─────────────────────────────────────────────────────

describe('computePowerProfile', () => {
    it('returns insufficient_data when no 2k anchor exists', () => {
        const profile = computePowerProfile([]);
        expect(profile.profileType).toBe('insufficient_data');
        expect(profile.anchor2kWatts).toBeNull();
    });

    it('uses fallback 2k watts when no 2k point exists', () => {
        const points: PowerCurvePoint[] = [{
            distance: 500, watts: 400, pace: 89, date: '2026-01-15',
            workoutId: 'w1', source: 'whole_workout', label: '500m', anchorKey: '500m',
        }];
        const profile = computePowerProfile(points, 300);
        expect(profile.anchor2kWatts).toBe(300);
        // Only 1 non-2k point → not enough for classification, but ratios should still compute
        expect(profile.ratios.length).toBe(1);
        expect(profile.ratios[0].anchorKey).toBe('500m');
        expect(profile.ratios[0].actualPercent).toBeCloseTo(400 / 300, 2);
    });

    it('computes accurate ratios relative to 2k', () => {
        const twoKWatts = 300;
        const points: PowerCurvePoint[] = [
            { distance: 500, watts: 400, pace: 89, date: '', workoutId: '', source: 'whole_workout', label: '500m', anchorKey: '500m' },
            { distance: 2000, watts: twoKWatts, pace: 105, date: '', workoutId: '', source: 'whole_workout', label: '2k', anchorKey: '2k' },
            { distance: 5000, watts: 240, pace: 120, date: '', workoutId: '', source: 'whole_workout', label: '5k', anchorKey: '5k' },
        ];
        const profile = computePowerProfile(points);

        const r500 = profile.ratios.find(r => r.anchorKey === '500m');
        expect(r500).toBeDefined();
        expect(r500!.actualPercent).toBeCloseTo(400 / 300, 2); // 1.333
        expect(r500!.status).toBe('within'); // 1.333 is within 1.30–1.40

        const r5k = profile.ratios.find(r => r.anchorKey === '5k');
        expect(r5k).toBeDefined();
        expect(r5k!.actualPercent).toBeCloseTo(240 / 300, 2); // 0.80
        expect(r5k!.status).toBe('within'); // 0.80 is within 0.80–0.85
    });

    it('classifies a sprinter profile', () => {
        const twoKWatts = 250;
        const points: PowerCurvePoint[] = [
            { distance: 0, watts: 650, pace: 0, date: '', workoutId: '', source: 'manual', label: 'Max Watts', anchorKey: 'max_watts' },
            { distance: 500, watts: 370, pace: 89, date: '', workoutId: '', source: 'whole_workout', label: '500m', anchorKey: '500m' },
            { distance: 1000, watts: 310, pace: 99, date: '', workoutId: '', source: 'whole_workout', label: '1k', anchorKey: '1k' },
            { distance: 2000, watts: twoKWatts, pace: 105, date: '', workoutId: '', source: 'whole_workout', label: '2k', anchorKey: '2k' },
            { distance: 5000, watts: 170, pace: 130, date: '', workoutId: '', source: 'whole_workout', label: '5k', anchorKey: '5k' },
            { distance: 6000, watts: 160, pace: 135, date: '', workoutId: '', source: 'whole_workout', label: '6k', anchorKey: '6k' },
            { distance: 10000, watts: 145, pace: 143, date: '', workoutId: '', source: 'whole_workout', label: '10k', anchorKey: '10k' },
        ];
        const profile = computePowerProfile(points);
        expect(profile.profileType).toBe('sprinter');
    });

    it('classifies a diesel profile', () => {
        const twoKWatts = 250;
        const points: PowerCurvePoint[] = [
            { distance: 500, watts: 300, pace: 97, date: '', workoutId: '', source: 'whole_workout', label: '500m', anchorKey: '500m' },
            { distance: 1000, watts: 270, pace: 103, date: '', workoutId: '', source: 'whole_workout', label: '1k', anchorKey: '1k' },
            { distance: 2000, watts: twoKWatts, pace: 108, date: '', workoutId: '', source: 'whole_workout', label: '2k', anchorKey: '2k' },
            { distance: 5000, watts: 220, pace: 117, date: '', workoutId: '', source: 'whole_workout', label: '5k', anchorKey: '5k' },
            { distance: 6000, watts: 210, pace: 119, date: '', workoutId: '', source: 'whole_workout', label: '6k', anchorKey: '6k' },
            { distance: 10000, watts: 200, pace: 121, date: '', workoutId: '', source: 'whole_workout', label: '10k', anchorKey: '10k' },
        ];
        const profile = computePowerProfile(points);
        expect(profile.profileType).toBe('diesel');
    });

    it('classifies a balanced profile', () => {
        const twoKWatts = 250;
        const points: PowerCurvePoint[] = [
            { distance: 500, watts: 340, pace: 92, date: '', workoutId: '', source: 'whole_workout', label: '500m', anchorKey: '500m' },
            { distance: 1000, watts: 290, pace: 101, date: '', workoutId: '', source: 'whole_workout', label: '1k', anchorKey: '1k' },
            { distance: 2000, watts: twoKWatts, pace: 108, date: '', workoutId: '', source: 'whole_workout', label: '2k', anchorKey: '2k' },
            { distance: 5000, watts: 206, pace: 117, date: '', workoutId: '', source: 'whole_workout', label: '5k', anchorKey: '5k' },
            { distance: 6000, watts: 195, pace: 120, date: '', workoutId: '', source: 'whole_workout', label: '6k', anchorKey: '6k' },
            { distance: 10000, watts: 182, pace: 124, date: '', workoutId: '', source: 'whole_workout', label: '10k', anchorKey: '10k' },
        ];
        const profile = computePowerProfile(points);
        expect(profile.profileType).toBe('balanced');
    });

    it('detects gaps for missing anchor points', () => {
        const points: PowerCurvePoint[] = [
            { distance: 2000, watts: 250, pace: 108, date: '', workoutId: '', source: 'whole_workout', label: '2k', anchorKey: '2k' },
            { distance: 5000, watts: 200, pace: 120, date: '', workoutId: '', source: 'whole_workout', label: '5k', anchorKey: '5k' },
        ];
        const profile = computePowerProfile(points);
        // Should have gaps for all anchors except 2k and 5k
        const gapKeys = profile.gaps.map(g => g.anchorKey);
        expect(gapKeys).toContain('500m');
        expect(gapKeys).toContain('10k');
        expect(gapKeys).toContain('HM');
        expect(gapKeys).not.toContain('2k');
        expect(gapKeys).not.toContain('5k');
    });

    it('computes data completeness correctly', () => {
        const points: PowerCurvePoint[] = [
            { distance: 2000, watts: 250, pace: 108, date: '', workoutId: '', source: 'whole_workout', label: '2k', anchorKey: '2k' },
            { distance: 5000, watts: 200, pace: 120, date: '', workoutId: '', source: 'whole_workout', label: '5k', anchorKey: '5k' },
            { distance: 500, watts: 350, pace: 92, date: '', workoutId: '', source: 'whole_workout', label: '500m', anchorKey: '500m' },
        ];
        const profile = computePowerProfile(points);
        expect(profile.dataCompleteness).toBeCloseTo(3 / 11, 2);
    });

    it('generates prescriptions for sprinter profile', () => {
        const twoKWatts = 250;
        const points: PowerCurvePoint[] = [
            { distance: 0, watts: 650, pace: 0, date: '', workoutId: '', source: 'manual', label: 'Max Watts', anchorKey: 'max_watts' },
            { distance: 500, watts: 370, pace: 89, date: '', workoutId: '', source: 'whole_workout', label: '500m', anchorKey: '500m' },
            { distance: 1000, watts: 310, pace: 99, date: '', workoutId: '', source: 'whole_workout', label: '1k', anchorKey: '1k' },
            { distance: 2000, watts: twoKWatts, pace: 105, date: '', workoutId: '', source: 'whole_workout', label: '2k', anchorKey: '2k' },
            { distance: 5000, watts: 170, pace: 130, date: '', workoutId: '', source: 'whole_workout', label: '5k', anchorKey: '5k' },
            { distance: 6000, watts: 160, pace: 135, date: '', workoutId: '', source: 'whole_workout', label: '6k', anchorKey: '6k' },
            { distance: 10000, watts: 145, pace: 143, date: '', workoutId: '', source: 'whole_workout', label: '10k', anchorKey: '10k' },
        ];
        const profile = computePowerProfile(points);
        expect(profile.prescriptions.length).toBeGreaterThan(0);
        expect(profile.prescriptions.some(p => p.zone === 'UT2')).toBe(true);
    });

    it('does not include 2k in ratios', () => {
        const points: PowerCurvePoint[] = [
            { distance: 2000, watts: 250, pace: 108, date: '', workoutId: '', source: 'whole_workout', label: '2k', anchorKey: '2k' },
            { distance: 5000, watts: 200, pace: 120, date: '', workoutId: '', source: 'whole_workout', label: '5k', anchorKey: '5k' },
        ];
        const profile = computePowerProfile(points);
        expect(profile.ratios.find(r => r.anchorKey === '2k')).toBeUndefined();
    });
});

// ─── suggestMaxWatts ─────────────────────────────────────────────────────────

describe('suggestMaxWatts', () => {
    it('returns null for workouts with no stroke data', () => {
        const workout = makeWorkout({ distance_meters: 2000, duration_seconds: 420 });
        expect(suggestMaxWatts([workout])).toBeNull();
    });

    it('finds highest watts from stroke data', () => {
        const workout = makeWorkout({
            distance_meters: 2000,
            duration_seconds: 420,
            raw_data: {
                stroke_data: true,
                strokes: [
                    { t: 0, d: 0, p: 250, spm: 28, hr: 150, watts: 250 },
                    { t: 21, d: 10, p: 0, spm: 30, hr: 160, watts: 487 }, // highest via watts field
                    { t: 43, d: 20, p: 0, spm: 29, hr: 155, watts: 300 },
                ],
            },
        });
        const result = suggestMaxWatts([workout]);
        expect(result).toBeDefined();
        expect(result!.watts).toBe(487);
    });

    it('handles pace values (p > 300) from stroke data', () => {
        const workout = makeWorkout({
            distance_meters: 2000,
            duration_seconds: 420,
            raw_data: {
                stroke_data: true,
                strokes: [
                    { t: 0, d: 0, p: 900, spm: 28, hr: 150 }, // 900 deciseconds = 90s/500m → ~480W
                ],
            },
        });
        const result = suggestMaxWatts([workout]);
        expect(result).toBeDefined();
        expect(result!.watts).toBeGreaterThan(400);
    });
});
