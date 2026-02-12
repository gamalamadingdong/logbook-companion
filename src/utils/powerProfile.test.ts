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
        workout_name: 'Test',
        workout_type: 'FixedDistance',
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
            distance_meters: 4000,
            duration_seconds: 900,
            raw_data: {
                workout: {
                    intervals: [
                        { type: 'distance', distance: 2000, time: 4100, stroke_rate: 28 }, // 410s → better than whole workout
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
